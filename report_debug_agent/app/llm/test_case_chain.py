from langchain_core.messages import SystemMessage, HumanMessage
import json
import logging
import re
from typing import Dict, List, Tuple
from app.prompts.test_case_prompts import build_test_case_prompt
from app.core.config import settings

# Attempt to use ChatOllama as the default model in the project
from langchain_ollama import ChatOllama

logger = logging.getLogger(__name__)

def _extract_json(text: str) -> dict:
    """Attempts to extract and parse JSON from a raw LLM output string."""
    text = text.strip()
    
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
        
    # Look for json markdown block
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
            
    # Try finding the first { and last }
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(text[start_idx:end_idx+1])
        except json.JSONDecodeError:
            pass
            
    raise ValueError("Failed to extract valid JSON from LLM response.")

def generate_test_case_output(
    documents: List[str],
    metadatas: List[Dict],
    test_type: str | None,
) -> Tuple[Dict[str, list], List[int]]:
    """
    Calls the LLM to generate test cases based on the provided documents.
    """
    # Combine documents into context
    context = "\n\n---\n\n".join(documents)
    
    # Extract unique page numbers
    page_numbers = list(set([m.get("page", -1) for m in metadatas if m.get("page") is not None]))
    
    prompt = build_test_case_prompt(
        context=context,
        documents_count=len(documents),
        page_numbers=page_numbers,
        test_type=test_type
    )
    
    llm = ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_CHAT_MODEL,
        temperature=0.1,
    )
    
    messages = [
        SystemMessage(content="You are an expert QA engineer. Output ONLY valid JSON."),
        HumanMessage(content=prompt)
    ]
    
    try:
        response = llm.invoke(messages)
        output_text = response.content
        parsed_json = _extract_json(output_text)
        return parsed_json, page_numbers
    except Exception as e:
        logger.error(f"Error generating test cases: {str(e)}")
        raise ValueError(f"LLM failed to generate valid test cases: {str(e)}")
