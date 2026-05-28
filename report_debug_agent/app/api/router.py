from fastapi import APIRouter
from app.api.endpoints import upload, chat, auth, auth_google, workspaces, projects, test_case

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(auth_google.router, prefix="/auth", tags=["google_oauth"])
api_router.include_router(workspaces.router, tags=["workspaces"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(test_case.router, tags=["Test Cases"])

