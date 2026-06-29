import json
from sqlalchemy.orm import Session
from app.db.database import TestCaseRun, TestCaseRecord, Document
from app.pipeline.test_case_pipeline import generate_test_cases
from app.models.test_case_models import TestCase, AcceptanceCriteria, TestCaseResponseData

def run_test_case_generation_and_save(
    db: Session,
    filename: str,
    test_type: str,
    project_id: int | None = None,
    session_id: str | None = None
) -> TestCaseResponseData:
    
    # 1. Fetch file_path from DB
    doc = db.query(Document).filter(Document.filename == filename).first()
    file_path = doc.file_path if doc else None
    
    if not file_path:
        # Fallback if document is not in the DB, though it usually is
        file_path = filename

    # 2. Run the LangChain pipeline using file_path
    raw_test_cases, citations = generate_test_cases(
        file_path=file_path,
        test_type=test_type,
    )

    # 3. Parse and strongly-type the LLM response
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
                    type=tc.get("type", test_type or "Manual"),
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
        raise ValueError("No test cases could be extracted.")

    # 4. Save to Database
    tc_run = TestCaseRun(
        filename=filename,
        test_type=test_type or "Manual",
        total_cases=total_cases,
        project_id=project_id,
        session_id=session_id
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

    return TestCaseResponseData(
        filename=filename,
        test_type=test_type or "Manual",
        total_cases=total_cases,
        citations=citations,
        test_cases=typed_test_cases,
    )
