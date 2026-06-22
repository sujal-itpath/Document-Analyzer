import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
from google.oauth2 import id_token
from app.db.database import get_db, User, UserIntegration
from app.api.endpoints.auth import get_current_user
from app.core.config import settings
import json

router = APIRouter()

# In-memory store for PKCE code verifiers
CODE_VERIFIERS = {}

# The scopes we request from Google
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.readonly'
]

# Provide fallback for credentials if not yet set
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1" # For local dev over HTTP
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1" # Allow scopes to be changed by Google without throwing exception
def get_google_client_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_GOOGLE_CLIENT_SECRET")
    return {
        "web": {
            "client_id": client_id,
            "project_id": "agentic-ai",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost:8000/auth/google/callback"]
        }
    }

@router.get("/google/login")
async def google_login(current_user: User = Depends(get_current_user)):
    """Initiates the Google OAuth 2.0 flow"""
    client_config = get_google_client_config()
    
    if client_config["web"]["client_id"] == "YOUR_GOOGLE_CLIENT_ID":
        raise HTTPException(status_code=500, detail="Google Client ID not configured in backend.")

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/auth/google/callback"
    )
    
    # We pass the user's ID in the state so we can link the account on callback
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=str(current_user.id)
    )
    
    # Store the PKCE code verifier so the callback can use it
    CODE_VERIFIERS[state] = getattr(flow, 'code_verifier', None)
    
    return {"authorization_url": authorization_url}

@router.get("/google/callback")
async def google_callback(request: Request, state: str, code: str, db: Session = Depends(get_db)):
    """Handles the Google OAuth 2.0 callback and stores tokens"""
    try:
        user_id = int(state)
        client_config = get_google_client_config()
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            state=state,
            redirect_uri="http://localhost:8000/auth/google/callback"
        )
        # Retrieve the code verifier from the initial request
        code_verifier = CODE_VERIFIERS.pop(state, None)
        if code_verifier:
            flow.code_verifier = code_verifier
            
        # Use the code to get credentials
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        
        # Verify the user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Store or update the integration
        integration = db.query(UserIntegration).filter(
            UserIntegration.user_id == user_id, 
            UserIntegration.provider == "google"
        ).first()
        
        if not integration:
            integration = UserIntegration(
                user_id=user_id,
                provider="google"
            )
            db.add(integration)
            
        integration.access_token = credentials.token
        if credentials.refresh_token:
            integration.refresh_token = credentials.refresh_token
        if credentials.expiry:
            integration.token_expiry = credentials.expiry
            
        db.commit()
        
        # Redirect back to frontend
        return RedirectResponse(url="http://localhost:3000/dashboard?integration=success")
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error during Google callback: {e}")
        with open("google_callback_error.log", "w") as f:
            f.write(error_details)
        return RedirectResponse(url="http://localhost:3000/dashboard?integration=error")

@router.delete("/google/disconnect")
async def google_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Removes the Google integration for the user"""
    integration = db.query(UserIntegration).filter(
        UserIntegration.user_id == current_user.id,
        UserIntegration.provider == "google"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    db.delete(integration)
    db.commit()
    return {"status": "success", "message": "Google account disconnected"}
