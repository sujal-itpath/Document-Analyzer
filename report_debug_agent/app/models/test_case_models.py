from pydantic import BaseModel
from typing import List, Dict, Optional

class TestCaseRequest(BaseModel):
    filename: str
    test_type: Optional[str] = None

class AcceptanceCriteria(BaseModel):
    given: List[str]
    when: List[str]
    then: List[str]

class TestCase(BaseModel):
    id: str
    title: str
    type: str
    priority: str
    acceptance_criteria: AcceptanceCriteria
    tags: Optional[List[str]] = None
    linked_requirement: Optional[str] = None

class TestCaseResponseData(BaseModel):
    filename: str
    test_type: str
    total_cases: int
    citations: List[int]
    test_cases: Dict[str, List[TestCase]]
