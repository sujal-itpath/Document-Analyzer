from fastapi import APIRouter
from app.api.endpoints import upload, chat, auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(chat.router, tags=["chat"])
