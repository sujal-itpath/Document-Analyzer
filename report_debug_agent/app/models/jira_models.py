from pydantic import BaseModel, Field
from typing import List, Optional

class AcceptanceCriteria(BaseModel):
    given: List[str]
    when: List[str]
    then: List[str]

class JiraTestCaseItem(BaseModel):
    id: str
    title: str
    type: str
    priority: str
    module: str
    acceptance_criteria: AcceptanceCriteria

class JiraPushRequest(BaseModel):
    jira_url: str
    email: str
    api_token: str
    project_key: str
    issue_type: str = "Task"
    ticket_summary: Optional[str] = None
    test_cases: List[JiraTestCaseItem]

class JiraTicketData(BaseModel):
    jira_key: str
    jira_ticket_url: str
    project_key: str
    issue_type: str
    total_test_cases: int
