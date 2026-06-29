from langchain_core.tools import tool
import logging
from app.db.database import SessionLocal
from app.services.test_case_service import run_test_case_generation_and_save
from langchain_core.runnables import RunnableConfig

logger = logging.getLogger(__name__)

@tool
def generate_test_cases_tool(filename: str, test_type: str = "Manual", config: RunnableConfig = None) -> str:
    """
    Generate BDD test cases for a specific uploaded document.
    
    Args:
        filename (str): The name of the document file (e.g. "requirements.pdf") to generate test cases for.
        test_type (str): The type of test cases to generate (e.g., "Manual", "API", "Smoke", "Regression"). Defaults to "Manual".
        config (RunnableConfig): LangChain configuration which holds thread_id (session_id).
        
    Returns:
        str: A message indicating the success or failure of the test case generation.
    """
    db = SessionLocal()
    session_id = None
    if config:
        session_id = config.get("configurable", {}).get("thread_id")

    try:
        data = run_test_case_generation_and_save(
            db=db,
            filename=filename,
            test_type=test_type,
            project_id=None,
            session_id=session_id
        )
        return f"Successfully generated {data.total_cases} test cases for document '{filename}'. You MUST now end your response with exactly [TEST_CASES_GENERATED: {filename}] to signal the UI."
    except Exception as e:
        logger.error(f"Error generating test cases in tool: {e}")
        return f"Failed to generate test cases for '{filename}': {str(e)}. Ask the user to try again or provide a different document."
    finally:
        db.close()
