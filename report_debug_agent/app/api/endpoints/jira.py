import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db, User, GlobalJiraConfig
from app.api.endpoints.auth import get_current_user
from app.services.jira_service import JiraService
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)

class GlobalConfigRequest(BaseModel):
    jira_base_url: str
    jira_email: str
    jira_api_token: str
    project_key: Optional[str] = None
    issue_type: Optional[str] = None

@router.get("/global-config")
def get_global_config(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(GlobalJiraConfig).first()
    if not config:
        return {}
    return {
        "jira_base_url": config.jira_base_url,
        "jira_email": config.jira_email,
        "jira_api_token": "********" if config.jira_api_token else "",
        "project_key": config.project_key,
        "issue_type": config.issue_type,
    }

@router.post("/global-config")
def save_global_config(req: GlobalConfigRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(GlobalJiraConfig).first()
    if not config:
        config = GlobalJiraConfig()
        db.add(config)
    
    config.jira_base_url = req.jira_base_url
    config.jira_email = req.jira_email
    if req.jira_api_token and req.jira_api_token != "********":
        config.jira_api_token = req.jira_api_token
    config.project_key = req.project_key
    config.issue_type = req.issue_type
    
    db.commit()
    return {"status": "success"}

class TestTicketRequest(BaseModel):
    summary: str
    description: str
    acceptance_criteria: str

@router.post("/generate-ticket")
def generate_test_ticket(req: TestTicketRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = JiraService(db, current_user.id)
    config = db.query(GlobalJiraConfig).first()
    if not config or not config.project_key:
        raise HTTPException(status_code=400, detail="Global Jira config or project key not set")
    try:
        res = service.create_ticket(
            project_id=config.project_key,
            issue_type_name=config.issue_type or "Task",
            summary=req.summary,
            description=req.description,
            acceptance_criteria=req.acceptance_criteria
        )
        return res
    except Exception as e:
        logger.error(f"Error creating test ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_jira_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if the user is connected to Jira"""
    service = JiraService(db, current_user.id)
    return {
        "connected": service.is_connected(),
        "cloud_id": service.get_cloud_id()
    }

@router.get("/projects")
def get_jira_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch Jira projects for the connected user"""
    service = JiraService(db, current_user.id)
    if not service.is_connected():
        raise HTTPException(status_code=400, detail="Jira is not connected")
        
    try:
        projects = service.get_projects()
        # Format response
        result = [
            {
                "id": p["id"],
                "key": p["key"],
                "name": p["name"],
                "avatarUrls": p.get("avatarUrls", {})
            }
            for p in projects
        ]
        return {"projects": result}
    except Exception as e:
        logger.error(f"Error fetching Jira projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_key}/issue_types")
def get_jira_issue_types(project_key: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch issue types for a specific Jira project"""
    service = JiraService(db, current_user.id)
    if not service.is_connected():
        raise HTTPException(status_code=400, detail="Jira is not connected")
        
    try:
        issue_types = service.get_issue_types(project_key)
        # Format response
        result = [
            {
                "id": it["id"],
                "name": it["name"],
                "description": it.get("description", ""),
                "subtask": it.get("subtask", False),
                "iconUrl": it.get("iconUrl", "")
            }
            for it in issue_types if not it.get("subtask", False) # Often we don't want to create subtasks as top-level tickets
        ]
        return {"issue_types": result}
    except Exception as e:
        logger.error(f"Error fetching Jira issue types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from typing import Optional
from app.services.jira_assistant import JiraAIAssistant

class DraftStartRequest(BaseModel):
    project_id: str
    issue_type: str
    workspace_project_id: Optional[int] = None

class DraftAskRequest(BaseModel):
    session_id: str
    answer: str
    workspace_project_id: Optional[int] = None

@router.post("/draft/start")
def start_jira_draft(req: DraftStartRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Initialize a Jira Ticket drafting session"""
    service = JiraService(db, current_user.id)
    if not service.is_connected():
        raise HTTPException(status_code=400, detail="Jira is not connected")
        
    try:
        assistant = JiraAIAssistant()
        res = assistant.start_session(db, current_user.id, req.project_id, req.issue_type, req.workspace_project_id)
        return res
    except Exception as e:
        logger.error(f"Error starting Jira draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/draft/ask")
def process_jira_draft_answer(req: DraftAskRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Process an answer in the Jira Ticket drafting session"""
    try:
        assistant = JiraAIAssistant()
        res = assistant.process_answer(db, req.session_id, req.answer, req.workspace_project_id)
        return res
    except Exception as e:
        logger.error(f"Error processing Jira draft answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class DraftGenerateRequest(BaseModel):
    session_id: str
    workspace_project_id: Optional[int] = None

@router.post("/draft/generate")
def generate_jira_draft(req: DraftGenerateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate the full Jira ticket from the session"""
    try:
        assistant = JiraAIAssistant()
        res = assistant.generate_ticket(db, req.session_id, req.workspace_project_id)
        return res
    except Exception as e:
        logger.error(f"Error generating Jira draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class DraftReviseRequest(BaseModel):
    session_id: str
    acceptance_criteria: str

@router.post("/draft/revise_tests")
def revise_jira_tests(req: DraftReviseRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Regenerate test cases based on updated ACs"""
    try:
        assistant = JiraAIAssistant()
        res = assistant.revise_test_cases(db, req.session_id, req.acceptance_criteria)
        return res
    except Exception as e:
        logger.error(f"Error revising Jira test cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class DraftSubmitRequest(BaseModel):
    session_id: str
    summary: str
    description: str
    acceptance_criteria: str
    test_cases: str

@router.post("/draft/submit")
def submit_jira_draft(req: DraftSubmitRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit the ticket to Jira and attach test cases as a comment"""
    try:
        from app.db.database import JiraTicketDraft
        draft = db.query(JiraTicketDraft).filter(JiraTicketDraft.session_id == req.session_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
            
        service = JiraService(db, current_user.id)
        if not service.is_connected():
            raise HTTPException(status_code=400, detail="Jira is not connected")
            
        # Create Ticket
        ticket_res = service.create_ticket(
            project_id=draft.project_id,
            issue_type_name=draft.issue_type,
            summary=req.summary,
            description=req.description,
            acceptance_criteria=req.acceptance_criteria
        )
        
        issue_key = ticket_res.get("key")
        
        # Add Test Cases as comment
        if req.test_cases:
            service.add_comment(issue_key, f"AI Generated QA Test Cases:\n\n{req.test_cases}")
            
        # Mark draft as submitted
        draft.status = "submitted"
        db.commit()
        
        # Construct ticket URL (fallback to generic if domain unknown)
        # Usually Atlassian Cloud URLs are derived from metadata, but generic redirect often works:
        ticket_url = f"https://{service.get_cloud_id()}.atlassian.net/browse/{issue_key}" # Best guess
        
        return {
            "status": "success",
            "ticket_key": issue_key,
            "ticket_url": ticket_url
        }
    except Exception as e:
        logger.error(f"Error submitting Jira ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

