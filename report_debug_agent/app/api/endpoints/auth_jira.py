import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import requests
from app.db.database import get_db, User, UserIntegration
from app.api.endpoints.auth import get_current_user
import json
import urllib.parse
import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# Jira OAuth 2.0 (3LO) Scopes
JIRA_SCOPES = "read:jira-user read:jira-work write:jira-work offline_access"

def get_jira_client_config():
    client_id = os.getenv("JIRA_CLIENT_ID", "YOUR_JIRA_CLIENT_ID")
    client_secret = os.getenv("JIRA_CLIENT_SECRET", "YOUR_JIRA_CLIENT_SECRET")
    redirect_uri = os.getenv("JIRA_REDIRECT_URI", "http://localhost:8000/api/jira/auth/callback")
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "auth_uri": "https://auth.atlassian.com/authorize",
        "token_uri": "https://auth.atlassian.com/oauth/token",
        "audience": "api.atlassian.com"
    }

@router.get("/auth/jira/login")
async def jira_login(current_user: User = Depends(get_current_user)):
    """Initiates the Jira OAuth 2.0 flow"""
    config = get_jira_client_config()
    
    if config["client_id"] == "YOUR_JIRA_CLIENT_ID":
        raise HTTPException(status_code=500, detail="Jira Client ID not configured in backend.")

    params = {
        "audience": config["audience"],
        "client_id": config["client_id"],
        "scope": JIRA_SCOPES,
        "redirect_uri": config["redirect_uri"],
        "state": str(current_user.id),
        "response_type": "code",
        "prompt": "consent"
    }
    
    query_string = urllib.parse.urlencode(params)
    authorization_url = f"{config['auth_uri']}?{query_string}"
    
    return {"authorization_url": authorization_url}

@router.get("/api/jira/auth/callback")
async def jira_callback(request: Request, state: str, code: str, db: Session = Depends(get_db)):
    """Handles the Jira OAuth callback and stores tokens"""
    try:
        user_id = int(state)
        config = get_jira_client_config()
        
        # Exchange code for token
        token_response = requests.post(
            config["token_uri"],
            json={
                "grant_type": "authorization_code",
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "code": code,
                "redirect_uri": config["redirect_uri"]
            },
            headers={"Content-Type": "application/json"}
        )
        
        if not token_response.ok:
            logger.error(f"Jira token exchange failed: {token_response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange Jira token")
            
        token_data = token_response.json()
        
        # Get accessible resources (Cloud IDs)
        # Atlassian requires us to know WHICH Jira site the user wants to use.
        # We fetch the list of sites the user has granted us access to.
        resources_response = requests.get(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )
        
        if not resources_response.ok:
            raise HTTPException(status_code=400, detail="Failed to fetch Jira accessible resources")
            
        resources = resources_response.json()
        if not resources:
            raise HTTPException(status_code=400, detail="No accessible Jira sites found")
            
        # Store metadata (we'll just store all available resources in metadata_json)
        # Default to the first Jira site
        jira_sites = [r for r in resources if "jira" in r.get("scopes", [])]
        if not jira_sites:
            jira_sites = resources # Fallback if scopes aren't strictly formatted
            
        primary_cloud_id = jira_sites[0]["id"] if jira_sites else None
        
        metadata = {
            "cloud_id": primary_cloud_id,
            "sites": jira_sites
        }
        
        # Verify the user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Store or update the integration
        integration = db.query(UserIntegration).filter(
            UserIntegration.user_id == user_id, 
            UserIntegration.provider == "jira"
        ).first()
        
        if not integration:
            integration = UserIntegration(
                user_id=user_id,
                provider="jira"
            )
            db.add(integration)
            
        integration.access_token = token_data["access_token"]
        if "refresh_token" in token_data:
            integration.refresh_token = token_data["refresh_token"]
        if "expires_in" in token_data:
            integration.token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=token_data["expires_in"])
            
        integration.metadata_json = json.dumps(metadata)
            
        db.commit()
        
        # Redirect back to frontend
        return RedirectResponse(url="http://localhost:3000/dashboard?integration=success")
        
    except Exception as e:
        logger.exception("Error during Jira callback: %s", e)
        return RedirectResponse(url="http://localhost:3000/dashboard?integration=error")

@router.delete("/auth/jira/disconnect")
async def jira_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Removes the Jira integration for the user"""
    integration = db.query(UserIntegration).filter(
        UserIntegration.user_id == current_user.id,
        UserIntegration.provider == "jira"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    db.delete(integration)
    db.commit()
    return {"status": "success", "message": "Jira account disconnected"}
