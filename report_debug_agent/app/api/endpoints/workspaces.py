from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db, Workspace, Project, User
from app.api.endpoints.auth import get_current_user
from app.services.document_cleanup import cleanup_document_artifacts
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    workspace_id: int
    created_at: str

@router.get("/workspaces", response_model=List[WorkspaceResponse])
async def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all workspaces owned by the current user."""
    workspaces = db.query(Workspace).filter(Workspace.owner_id == current_user.id).order_by(Workspace.created_at.desc()).all()
    return [
        WorkspaceResponse(
            id=w.id,
            name=w.name,
            description=w.description,
            created_at=w.created_at.isoformat()
        )
        for w in workspaces
    ]

@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    workspace_data: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new workspace."""
    new_workspace = Workspace(
        name=workspace_data.name,
        description=workspace_data.description,
        owner_id=current_user.id
    )
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    return WorkspaceResponse(
        id=new_workspace.id,
        name=new_workspace.name,
        description=new_workspace.description,
        created_at=new_workspace.created_at.isoformat()
    )

@router.put("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: int,
    workspace_data: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update workspace details."""
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace.name = workspace_data.name
    workspace.description = workspace_data.description
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        created_at=workspace.created_at.isoformat()
    )

@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a workspace (cascades to all projects, documents, and chat sessions in database)."""
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    for project in workspace.projects:
        for doc in project.documents:
            cleanup_document_artifacts(doc.file_path)
    
    db.delete(workspace)
    db.commit()
    return None

@router.get("/workspaces/{workspace_id}/projects", response_model=List[ProjectResponse])
async def list_workspace_projects(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all projects inside a specific workspace."""
    # Verify workspace ownership first
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    projects = db.query(Project).filter(
        Project.workspace_id == workspace_id,
        Project.owner_id == current_user.id
    ).order_by(Project.created_at.desc()).all()
    
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            workspace_id=p.workspace_id,
            created_at=p.created_at.isoformat()
        )
        for p in projects
    ]

@router.post("/workspaces/{workspace_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    workspace_id: int,
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project inside a workspace."""
    # Verify workspace ownership
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        workspace_id=workspace_id,
        owner_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return ProjectResponse(
        id=new_project.id,
        name=new_project.name,
        description=new_project.description,
        workspace_id=new_project.workspace_id,
        created_at=new_project.created_at.isoformat()
    )
