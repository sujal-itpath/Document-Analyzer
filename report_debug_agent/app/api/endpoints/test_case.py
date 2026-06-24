from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
import json

from app.models.test_case_models import (
    TestCaseRequest,
    TestCaseResponseData,
    TestCase,
    AcceptanceCriteria,
)
from app.db.database import get_db, TestCaseRun, TestCaseRecord, Project
from app.api.endpoints.auth import get_current_user, User
from rag.vector_store import get_retriever # We can check if vector store is initialized or just use chroma functions

# For ChromaDB collection names, we might just assume the document ID or sanitised name.
# Let's import the user's requested chroma_store if it exists, otherwise define a placeholder.
import re
def sanitise_collection_name(name: str) -> str:
    """Sanitises a filename to create a valid ChromaDB collection name."""
    s = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    # Ensure it starts and ends with alphanumeric
    s = re.sub(r'^[^a-zA-Z0-9]+', '', s)
    s = re.sub(r'[^a-zA-Z0-9]+$', '', s)
    if len(s) < 3:
        s = s.ljust(3, 'a')
    return s[:63]

def collection_exists(name: str) -> bool:
    # A simple placeholder check. If vector store exists, we assume we can query it.
    return True

from app.pipeline.test_case_pipeline import generate_test_cases

router = APIRouter()

from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    status: int
    message: str
    data: T

@router.post("/generate", response_model=ApiResponse[TestCaseResponseData], status_code=200)
async def generate_test_cases_endpoint(
    request: TestCaseRequest,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ApiResponse[TestCaseResponseData]:
    # Parse project_id
    parsed_project_id = None
    if project_id is not None and str(project_id).strip() != "":
        try:
            parsed_project_id = int(project_id)
        except ValueError:
            pass

    collection_name = sanitise_collection_name(request.filename)

    if not collection_exists(collection_name):
        raise HTTPException(
            status_code=404,
            detail=f"Document '{request.filename}' is not indexed."
        )

    try:
        raw_test_cases, citations = generate_test_cases(
            collection_name=collection_name,
            test_type=request.test_type,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test case generation failed: {str(e)}")

    typed_test_cases: dict[str, list[TestCase]] = {}

    for module_name, tc_list in raw_test_cases.items():
        typed_cases = []
        for tc in tc_list:
            try:
                criteria = AcceptanceCriteria(
                    given=tc.get("acceptance_criteria", {}).get("given", []),
                    when=tc.get("acceptance_criteria", {}).get("when", []),
                    then=tc.get("acceptance_criteria", {}).get("then", []),
                )
                typed_case = TestCase(
                    id=tc.get("id", "TC_???"),
                    title=tc.get("title", "Untitled"),
                    type=tc.get("type", request.test_type or "Manual"),
                    priority=tc.get("priority", "Medium"),
                    tags=tc.get("tags", []),
                    linked_requirement=tc.get("linked_requirement"),
                    acceptance_criteria=criteria,
                )
                typed_cases.append(typed_case)
            except Exception:
                continue
        if typed_cases:
            typed_test_cases[module_name] = typed_cases

    total_cases = sum(len(cases) for cases in typed_test_cases.values())

    if total_cases == 0:
        raise HTTPException(status_code=400, detail="No test cases could be extracted.")

    # Save to database
    tc_run = TestCaseRun(
        filename=request.filename,
        test_type=request.test_type or "Manual",
        total_cases=total_cases,
        project_id=parsed_project_id
    )
    db.add(tc_run)
    db.commit()
    db.refresh(tc_run)

    tc_records = []
    for module_name, cases in typed_test_cases.items():
        for tc in cases:
            tc_record = TestCaseRecord(
                run_id=tc_run.id,
                tc_id=tc.id,
                module_name=module_name,
                title=tc.title,
                type=tc.type,
                priority=tc.priority,
                tags=json.dumps(tc.tags),
                linked_requirement=tc.linked_requirement,
                acceptance_criteria=json.dumps(tc.acceptance_criteria.model_dump())
            )
            db.add(tc_record)
            tc_records.append((tc, tc_record))
    
    db.commit()

    for tc, record in tc_records:
        db.refresh(record)
        tc.db_id = record.id

    return ApiResponse(
        status=200,
        data=TestCaseResponseData(
            filename=request.filename,
            test_type=request.test_type or "Manual",
            total_cases=total_cases,
            citations=citations,
            test_cases=typed_test_cases,
        ),
        message=f"{total_cases} test case(s) generated successfully."
    )

@router.get("/history", response_model=ApiResponse[List[dict]])
async def get_test_case_history(
    filename: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TestCaseRun)
    if filename:
        query = query.filter(TestCaseRun.filename == filename)
    if project_id is not None and str(project_id).strip() != "":
        try:
            query = query.filter(TestCaseRun.project_id == int(project_id))
        except ValueError:
            pass
        
    runs = query.order_by(TestCaseRun.created_at.desc()).all()
    
    results = []
    for run in runs:
        records = db.query(TestCaseRecord).filter(TestCaseRecord.run_id == run.id).all()
        typed_test_cases: dict[str, list[TestCase]] = {}
        for r in records:
            if r.module_name not in typed_test_cases:
                typed_test_cases[r.module_name] = []
                
            ac_dict = json.loads(r.acceptance_criteria)
            typed_test_cases[r.module_name].append(TestCase(
                id=r.tc_id,
                db_id=r.id,
                title=r.title,
                type=r.type,
                priority=r.priority,
                tags=json.loads(r.tags) if r.tags else [],
                linked_requirement=r.linked_requirement,
                acceptance_criteria=AcceptanceCriteria(**ac_dict)
            ))
            
        results.append({
            "run_id": run.id,
            "filename": run.filename,
            "test_type": run.test_type,
            "total_cases": run.total_cases,
            "created_at": run.created_at.isoformat(),
            "test_cases": typed_test_cases
        })
        
    return ApiResponse(
        status=200,
        data=results,
        message="History retrieved successfully."
    )

class TestCaseEditRequest(BaseModel):
    title: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    acceptance_criteria: Optional[AcceptanceCriteria] = None

@router.put("/{tc_id}", response_model=ApiResponse[TestCase])
async def update_test_case(
    tc_id: int,
    request: TestCaseEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = db.query(TestCaseRecord).filter(TestCaseRecord.id == tc_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Test case record not found")
        
    if request.title is not None:
        record.title = request.title
    if request.priority is not None:
        record.priority = request.priority
    if request.tags is not None:
        record.tags = json.dumps(request.tags)
    if request.acceptance_criteria is not None:
        record.acceptance_criteria = json.dumps(request.acceptance_criteria.model_dump())
        
    db.commit()
    db.refresh(record)
    
    ac_dict = json.loads(record.acceptance_criteria)
    tc = TestCase(
        id=record.tc_id,
        db_id=record.id,
        title=record.title,
        type=record.type,
        priority=record.priority,
        tags=json.loads(record.tags) if record.tags else [],
        linked_requirement=record.linked_requirement,
        acceptance_criteria=AcceptanceCriteria(**ac_dict)
    )
    
    return ApiResponse(
        status=200,
        data=tc,
        message="Test case updated successfully."
    )
