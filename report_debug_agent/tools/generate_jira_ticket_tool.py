import logging
from langchain_core.tools import tool
import json
from app.db.database import SessionLocal, GlobalJiraConfig, TestCaseRun, TestCaseRecord
from app.services.jira_service import JiraService
from tools.recall_memory import _current_user_id

logger = logging.getLogger(__name__)

@tool
def generate_jira_ticket_tool(
    summary: str,
    description: str,
    acceptance_criteria: str,
    issue_type: str | None = None,
    attach_test_cases_for_filename: str | None = None
) -> str:
    """
    Generate and push a Jira ticket directly to the connected Jira instance.
    
    Args:
        summary (str): The short title or summary of the ticket.
        description (str): The detailed description of the ticket.
        acceptance_criteria (str): The acceptance criteria for the ticket.
        issue_type (str, optional): The type of issue (e.g., "Story", "Bug", "Task"). If omitted, it uses the global default.
        attach_test_cases_for_filename (str, optional): If the user wants to attach test cases to this ticket, provide the filename of the document here. The tool will automatically fetch the latest test cases for this document from the DB and append them to the Jira ticket description.
        
    Returns:
        str: A message indicating the success (with the ticket key) or failure of the Jira ticket creation.
    """
    user_id = _current_user_id.get()
    if not user_id:
        return "Failed to create Jira ticket: User ID not found in context. Please authenticate."

    db = SessionLocal()
    try:
        service = JiraService(db, user_id)
        if not service.is_connected():
            return "Failed to create Jira ticket: Your Jira account is not connected. Please connect it in the Integrations UI first."

        config = db.query(GlobalJiraConfig).first()
        if not config or not config.project_key:
            return "Failed to create Jira ticket: Global Jira config or Project Key is not set up. Please configure it in the UI settings."

        final_issue_type = issue_type or config.issue_type or "Task"
        final_description = description

        if attach_test_cases_for_filename:
            # Fetch the latest TestCaseRun for this filename
            tc_run = db.query(TestCaseRun).filter(TestCaseRun.filename == attach_test_cases_for_filename).order_by(TestCaseRun.created_at.desc()).first()
            if tc_run:
                tc_records = db.query(TestCaseRecord).filter(TestCaseRecord.run_id == tc_run.id).all()
                if tc_records:
                    tc_markdown = f"\n\n----\n## Attached Test Cases (from {attach_test_cases_for_filename})\n"
                    for rec in tc_records:
                        tc_markdown += f"\n### {rec.title} ({rec.priority} Priority, {rec.type})\n"
                        try:
                            ac = json.loads(rec.acceptance_criteria)
                            if ac.get("given"):
                                tc_markdown += "**Given**\n" + "".join(f"- {g}\n" for g in ac["given"])
                            if ac.get("when"):
                                tc_markdown += "**When**\n" + "".join(f"- {w}\n" for w in ac["when"])
                            if ac.get("then"):
                                tc_markdown += "**Then**\n" + "".join(f"- {t}\n" for t in ac["then"])
                        except json.JSONDecodeError:
                            pass
                    final_description += tc_markdown
            else:
                final_description += f"\n\n*(Note: Requested to attach test cases for {attach_test_cases_for_filename}, but none were found in the database)*\n"

        res = service.create_ticket(
            project_id=config.project_key,
            issue_type_name=final_issue_type,
            summary=summary,
            description=final_description,
            acceptance_criteria=acceptance_criteria
        )
        
        ticket_key = res.get("key", "Unknown Key")
        return f"Successfully created Jira ticket {ticket_key}."
    except Exception as e:
        logger.error(f"Error creating Jira ticket in tool: {e}")
        return f"Failed to create Jira ticket: {str(e)}. Please check your Jira configuration and ensure the issue type '{issue_type or 'Default'}' is valid for your project."
    finally:
        db.close()
