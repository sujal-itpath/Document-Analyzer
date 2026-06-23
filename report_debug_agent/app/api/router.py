from fastapi import APIRouter
from app.api.endpoints import upload, chat, auth, auth_google, auth_jira, jira, workspaces, projects

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(auth_google.router, prefix="/auth", tags=["google_oauth"])
api_router.include_router(auth_jira.router, tags=["jira_oauth"])
api_router.include_router(jira.router, prefix="/jira", tags=["jira"])
api_router.include_router(workspaces.router, tags=["workspaces"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(chat.router, tags=["chat"])
