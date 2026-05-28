import json
import re
from typing import Dict, List, Tuple

from app.llm.gemini_client import generate_text


# Prompt logic moved to app/prompts/test_case_prompts.py


# ---------------------------------------------------------------------------
# Main chain function
# ---------------------------------------------------------------------------

def generate_test_case_output(
    documents: List[str],
    metadatas: List[dict],
    test_type: str | None,
) -> Tuple[Dict[str, list], List[int]]:
    """
    Build a BDD test case prompt from retrieved document chunks and call Gemini.

    The prompt instructs Gemini to:
      - Identify every module/screen/feature in the document context.
      - For each module, generate BDD test cases (Given/When/Then).
      - Return ONLY a valid JSON object — no markdown, no explanation.

    The returned JSON is then parsed into a Python dict and returned.

    Args:
        documents : List of text chunks retrieved from ChromaDB.
        metadatas : List of metadata dicts (one per chunk; must have "page" key).
        test_type : Type of test cases to generate (Manual/API/Smoke/Regression/All).
                    If None or unrecognized, defaults to "Manual".

    Returns:
        Tuple of:
          - Dict[module_name, list[dict]] — parsed test cases grouped by module.
          - List[int] — unique page numbers the context was drawn from.
    """
    # ------------------------------------------------------------------
    # Step 1: Collect unique page numbers from metadata (for citations)
    # ------------------------------------------------------------------
    page_numbers = sorted(list(set(
        m.get("page")
        for m in metadatas
        if isinstance(m.get("page"), int)
    )))

    # ------------------------------------------------------------------
    # Step 2: Build the context string with clear page labels
    # ------------------------------------------------------------------
    context_parts = []
    for doc, meta in zip(documents, metadatas):
        page_label = f"[Page {meta.get('page', '?')}]"
        context_parts.append(f"{page_label}\n{doc}")

    context = "\n\n---\n\n".join(context_parts)

    # ------------------------------------------------------------------
    # Step 3: Build the specialized BDD test case prompt
    # ------------------------------------------------------------------
    from app.prompts.test_case_prompts import build_test_case_prompt

    prompt = build_test_case_prompt(
        context=context,
        documents_count=len(documents),
        page_numbers=page_numbers,
        test_type=test_type
    )

    # ------------------------------------------------------------------
    # Step 5: Call Gemini via the shared client
    # ------------------------------------------------------------------
    raw_response = generate_text(prompt)

    # ------------------------------------------------------------------
    # Step 6: Parse the JSON response from Gemini
    # Gemini sometimes wraps JSON in ```json ... ``` markdown blocks.
    # We strip those out before parsing.
    # ------------------------------------------------------------------
    test_cases_dict = _parse_json_response(raw_response)

    return test_cases_dict, page_numbers


# ---------------------------------------------------------------------------
# JSON parsing helper
# ---------------------------------------------------------------------------

def _parse_json_response(raw: str) -> Dict[str, list]:
    """
    Safely parse the Gemini JSON response string into a Python dict.

    Handles cases where Gemini wraps the JSON in markdown code blocks
    like ```json ... ``` or ``` ... ```.

    Args:
        raw: The raw string response from Gemini.

    Returns:
        Parsed dict of { module_name: [test_case_dicts] }.

    Raises:
        ValueError: If the response cannot be parsed as valid JSON.
    """
    # Remove markdown code fences if present (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
    cleaned = cleaned.rstrip("`").strip()

    try:
        parsed = json.loads(cleaned)
        # Ensure the parsed result is a dict (module → list)
        if not isinstance(parsed, dict):
            raise ValueError("Expected a JSON object (dict) at the top level.")
        return parsed
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned invalid JSON that could not be parsed.\n"
            f"JSON error: {e}\n"
            f"Raw response (first 500 chars):\n{raw[:500]}"
        )
