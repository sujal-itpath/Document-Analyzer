import sys
import os

# Add current working directory to path
sys.path.append(os.getcwd())

print("Testing imports...")
try:
    from app.models.document_models import ApiResponse
    from app.models.test_case_models import TestCaseRequest, TestCaseResponseData, TestCase
    from app.vectorstore.chroma_store import sanitise_collection_name, collection_exists
    from app.retrieval.retriever import retrieve_context
    from app.llm.gemini_client import generate_text
    from app.prompts.test_case_prompts import build_test_case_prompt
    from app.llm.test_case_chain import generate_test_case_output
    from app.pipeline.test_case_pipeline import generate_test_cases
    from app.api.endpoints.test_case import router as test_case_router
    
    print("Success: All backend imports loaded successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
