from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class AcceptanceCriteria(BaseModel):
    given: List[str] = Field(default_factory=list)
    when: List[str] = Field(default_factory=list)
    then: List[str] = Field(default_factory=list)

class TestCase(BaseModel):
    id: str
    title: str
    type: str
    priority: str
    tags: List[str] = Field(default_factory=list)
    linked_requirement: Optional[str] = None
    acceptance_criteria: AcceptanceCriteria

class TestCaseResponseData(BaseModel):
    filename: str
    test_type: str
    total_cases: int
    citations: List[int] = Field(default_factory=list)
    test_cases: Dict[str, List[TestCase]]

class TestCaseRequest(BaseModel):
    filename: str
    test_type: Optional[str] = None
