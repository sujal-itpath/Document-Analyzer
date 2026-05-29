from fastapi import APIRouter, HTTPException

from app.models.test_case_models import (
    TestCaseRequest,
    TestCaseResponseData,
    TestCase,
    AcceptanceCriteria,
)
from app.models.document_models import ApiResponse
from app.vectorstore.chroma_store import sanitise_collection_name, collection_exists
from app.pipeline.test_case_pipeline import generate_test_cases


# ---------------------------------------------------------------------------
# Router definition
# ---------------------------------------------------------------------------

# All endpoints in this file are prefixed with /test-cases
# Final URL: /api/v1/test-cases/generate  (prefix /api/v1 added in main.py)
router = APIRouter(prefix="/test-cases", tags=["Test Cases"])


# ---------------------------------------------------------------------------
# POST /api/v1/test-cases/generate
# ---------------------------------------------------------------------------

@router.post(
    "/generate",
    response_model=ApiResponse[TestCaseResponseData],
    status_code=200,
    summary="Generate BDD test cases from an indexed document",
    description=(
        "Generates BDD-style (Given/When/Then) test cases from a previously "
        "uploaded and indexed document. "
        "The document must have been uploaded via POST /api/v1/documents/upload first. "
        "Test cases are grouped by module name in the response. "
        "test_type is optional — defaults to 'Manual' if not provided."
    ),
)
async def generate_test_cases_endpoint(
    request: TestCaseRequest,
) -> ApiResponse[TestCaseResponseData]:
    """
    Generate structured BDD test cases from an indexed document.

    Flow:
        1. Sanitise filename → ChromaDB collection name.
        2. Verify the collection exists (document was indexed).
        3. Run the test case pipeline (retrieve → generate via Gemini).
        4. Convert raw dict from LLM into typed Pydantic models.
        5. Count total test cases across all modules.
        6. Return ApiResponse with grouped test cases.

    Args:
        request: TestCaseRequest containing filename and optional test_type.

    Returns:
        ApiResponse[TestCaseResponseData] with test cases grouped by module.

    Raises:
        HTTPException 404: Document not indexed — must upload it first.
        HTTPException 400: No content found or LLM returned invalid output.
        HTTPException 500: Unexpected pipeline or LLM failure.
    """
    # ------------------------------------------------------------------
    # Step 1: Derive ChromaDB collection name from filename
    # Same sanitisation logic used during upload to ensure exact match.
    # ------------------------------------------------------------------
    collection_name = sanitise_collection_name(request.filename)

    # ------------------------------------------------------------------
    # Step 2: Check if the document is indexed in ChromaDB
    # If not found, the user must upload the document first.
    # ------------------------------------------------------------------
    if not collection_exists(collection_name):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Document '{request.filename}' is not indexed. "
                "Please upload the document first via POST /api/v1/documents/upload."
            ),
        )

    # ------------------------------------------------------------------
    # Step 3: Run the test case pipeline
    # - Builds broad retrieval query automatically
    # - Retrieves all relevant chunks from ChromaDB
    # - Calls Gemini with BDD test case prompt
    # - Returns parsed dict: { "Module": [raw_tc_dicts] }
    # ------------------------------------------------------------------
    try:
        raw_test_cases, citations = generate_test_cases(
            collection_name=collection_name,
            test_type=request.test_type,     # nullable — chain defaults to "Manual"
        )
    except ValueError as ve:
        # Empty document or LLM returned invalid JSON
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Test case generation failed: {str(e)}",
        )

    # ------------------------------------------------------------------
    # Step 4: Convert raw dict from LLM into typed Pydantic TestCase models
    #
    # raw_test_cases is: { "Module": [ {id, title, type, priority, acceptance_criteria} ] }
    # We convert each inner dict into a TestCase Pydantic object for validation.
    # ------------------------------------------------------------------
    typed_test_cases: dict[str, list[TestCase]] = {}

    for module_name, tc_list in raw_test_cases.items():
        typed_cases = []
        for tc in tc_list:
            try:
                # Convert the nested acceptance_criteria dict to Pydantic model
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
                    acceptance_criteria=criteria,
                    tags=tc.get("tags"),
                    linked_requirement=tc.get("linked_requirement")
                )
                typed_cases.append(typed_case)
            except Exception:
                # Skip malformed individual test cases gracefully
                # (partial results are better than a full failure)
                continue

        if typed_cases:
            typed_test_cases[module_name] = typed_cases

    # ------------------------------------------------------------------
    # Step 5: Count total test cases across all modules
    # ------------------------------------------------------------------
    total_cases = sum(len(cases) for cases in typed_test_cases.values())

    # ------------------------------------------------------------------
    # Step 6: Guard — if no valid test cases were generated
    # ------------------------------------------------------------------
    if total_cases == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "No test cases could be extracted from the document. "
                "The document may not contain enough structured requirement information."
            ),
        )

    # ------------------------------------------------------------------
    # Step 7: Build and return the final API response
    # ------------------------------------------------------------------
    return ApiResponse(
        status=200,
        data=TestCaseResponseData(
            filename=request.filename,
            test_type=request.test_type or "Manual",  # resolve null to "Manual"
            total_cases=total_cases,
            citations=citations,
            test_cases=typed_test_cases,
        ),
        message=f"{total_cases} test case(s) generated successfully across {len(typed_test_cases)} module(s).",
    )

from app.models.test_case_models import TestCaseUpdateRequest

@router.post(
    "/update",
    response_model=ApiResponse[TestCase],
    status_code=200,
    summary="Update a single BDD test case using AI",
    description="Updates an existing test case using AI based on user instructions.",
)
async def update_test_case_endpoint(
    request: TestCaseUpdateRequest,
) -> ApiResponse[TestCase]:
    collection_name = sanitise_collection_name(request.filename)

    if not collection_exists(collection_name):
        raise HTTPException(
            status_code=404,
            detail=f"Document '{request.filename}' is not indexed."
        )

    from app.pipeline.test_case_pipeline import update_test_case
    
    try:
        updated_tc_dict = update_test_case(
            collection_name=collection_name,
            existing_tc=request.test_case.dict(),
            instruction=request.instruction,
        )
        
        # Parse it into a TestCase model
        criteria = AcceptanceCriteria(
            given=updated_tc_dict.get("acceptance_criteria", {}).get("given", []),
            when=updated_tc_dict.get("acceptance_criteria", {}).get("when", []),
            then=updated_tc_dict.get("acceptance_criteria", {}).get("then", []),
        )
        updated_test_case = TestCase(
            id=updated_tc_dict.get("id", request.test_case.id),
            title=updated_tc_dict.get("title", request.test_case.title),
            type=updated_tc_dict.get("type", request.test_case.type),
            priority=updated_tc_dict.get("priority", request.test_case.priority),
            acceptance_criteria=criteria,
            tags=updated_tc_dict.get("tags"),
            linked_requirement=updated_tc_dict.get("linked_requirement")
        )
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Test case update failed: {str(e)}",
        )

    return ApiResponse(
        status=200,
        data=updated_test_case,
        message="Test case updated successfully."
    )
