from jira import JIRA, JIRAError
from typing import List

from app.models.jira_models import (
    JiraPushRequest,
    JiraTicketData,
    JiraTestCaseItem,
)

# ---------------------------------------------------------------------------
# Priority mapping — our priorities → Jira priority names
# ---------------------------------------------------------------------------

_PRIORITY_RANK = {"High": 1, "Medium": 2, "Low": 3}

_PRIORITY_TO_JIRA = {
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
}

# ---------------------------------------------------------------------------
# Description builder — all selected TCs into one structured BDD block
# ---------------------------------------------------------------------------

def _build_ticket_description(test_cases: List[JiraTestCaseItem]) -> str:
    # Group by module
    modules: dict[str, List[JiraTestCaseItem]] = {}
    for tc in test_cases:
        modules.setdefault(tc.module, []).append(tc)

    lines = []
    lines.append("=== AUTO-GENERATED TEST CASES ===\n")

    for module_name, cases in modules.items():
        lines.append(f"\n{'='*50}")
        lines.append(f"MODULE: {module_name}")
        lines.append(f"{'='*50}\n")

        for tc in cases:
            lines.append(f"[{tc.id}] {tc.title}")
            lines.append(f"  Type: {tc.type}  |  Priority: {tc.priority}\n")

            # Given
            lines.append("  GIVEN:")
            for step in tc.acceptance_criteria.given:
                lines.append(f"    • {step}")

            # When
            lines.append("\n  WHEN:")
            for step in tc.acceptance_criteria.when:
                lines.append(f"    • {step}")

            # Then
            lines.append("\n  THEN:")
            for step in tc.acceptance_criteria.then:
                lines.append(f"    • {step}")

            lines.append("")  # blank line between test cases

    return "\n".join(lines)


def _resolve_highest_priority(test_cases: List[JiraTestCaseItem]) -> str:
    if not test_cases:
        return "Medium"

    # Sort by rank (1 = highest) and pick the first
    sorted_cases = sorted(
        test_cases,
        key=lambda tc: _PRIORITY_RANK.get(tc.priority, 99),
    )
    return _PRIORITY_TO_JIRA.get(sorted_cases[0].priority, "Medium")


# ---------------------------------------------------------------------------
# Default ticket summary builder
# ---------------------------------------------------------------------------

def _build_default_summary(test_cases: List[JiraTestCaseItem]) -> str:
    unique_modules = list(dict.fromkeys(tc.module for tc in test_cases))
    modules_str = ", ".join(unique_modules[:3])   # cap at 3 for readability
    if len(unique_modules) > 3:
        modules_str += f" (+{len(unique_modules) - 3} more)"
    return f"Test Cases – {modules_str}"


# ---------------------------------------------------------------------------
# Main service function
# ---------------------------------------------------------------------------

def push_test_cases_to_jira(request: JiraPushRequest) -> JiraTicketData:
    # Guard — must have at least one test case to create a ticket
    if not request.test_cases:
        raise ValueError("No test cases provided. Please select at least one test case.")

    # ------------------------------------------------------------------
    # Step 1: Authenticate with Jira
    # ------------------------------------------------------------------
    try:
        jira_client = JIRA(
            server=request.jira_url.rstrip("/"),
            basic_auth=(request.email, request.api_token),
        )
    except JIRAError as e:
        raise RuntimeError(
            f"Jira authentication failed. "
            f"Please verify your Jira URL, email, and API token. "
            f"Detail: {e.text}"
        )

    # ------------------------------------------------------------------
    # Step 2: Build the single ticket description (all selected TCs)
    # ------------------------------------------------------------------
    description = _build_ticket_description(request.test_cases)

    # ------------------------------------------------------------------
    # Step 3: Resolve ticket summary and priority
    # ------------------------------------------------------------------
    summary = request.ticket_summary or _build_default_summary(request.test_cases)
    priority_name = _resolve_highest_priority(request.test_cases)

    # ------------------------------------------------------------------
    # Step 4: Create the Jira issue
    # ------------------------------------------------------------------
    issue_fields = {
        "project": {"key": request.project_key},
        "summary": summary,
        "description": description,
        "issuetype": {"name": request.issue_type},
        "priority": {"name": priority_name},
        "labels": ["auto-generated", "test-cases"],
    }

    try:
        issue = jira_client.create_issue(fields=issue_fields)
    except JIRAError as e:
        raise RuntimeError(
            f"Failed to create Jira ticket in project '{request.project_key}'. "
            f"Verify the project key and issue type '{request.issue_type}' exist. "
            f"Detail: {e.text}"
        )

    # ------------------------------------------------------------------
    # Step 5: Build and return the response with the ticket link
    # ------------------------------------------------------------------
    jira_ticket_url = f"{request.jira_url.rstrip('/')}/browse/{issue.key}"

    return JiraTicketData(
        jira_key=issue.key,
        jira_ticket_url=jira_ticket_url,
        project_key=request.project_key,
        issue_type=request.issue_type,
        total_test_cases=len(request.test_cases),
    )
