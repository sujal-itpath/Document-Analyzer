from typing import Dict

# ---------------------------------------------------------------------------
# Test type prompt instructions
# ---------------------------------------------------------------------------

_TEST_TYPE_INSTRUCTIONS: Dict[str, str] = {
    "Manual": (
        "Generate full BDD-style Manual test cases covering ALL UI flows, "
        "forms, fields, buttons, navigation, and user interactions."
    ),
    "API": (
        "Generate API test cases focusing on HTTP endpoints, request payloads, "
        "expected response structures, HTTP status codes, and error handling. "
        "Given = API preconditions/auth, When = HTTP method + endpoint + body, "
        "Then = expected status code + response fields."
    ),
    "Smoke": (
        "Generate ONLY the 5 most critical test cases — the absolute minimum "
        "set that confirms the core application is working. Focus on the most "
        "important user flows only."
    ),
    "Regression": (
        "Generate regression test cases covering all major user paths that could "
        "break when new features are added. Prioritize edge cases, validations, "
        "and role-based permission scenarios."
    ),
    "All": (
        "Generate a comprehensive mix of Manual, API, and Smoke test cases. "
        "Cover all UI flows, API endpoints, critical paths, validations, "
        "and edge cases found in the document."
    ),
}

_DEFAULT_TEST_TYPE = "Manual"

# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------

def build_test_case_prompt_v1(context: str, documents_count: int, page_numbers: list, test_type: str | None) -> str:
    """
    VERSION 1: Standard BDD functional test case generator prompt.
    """
    resolved_type = test_type if test_type in _TEST_TYPE_INSTRUCTIONS else _DEFAULT_TEST_TYPE
    type_instruction = _TEST_TYPE_INSTRUCTIONS[resolved_type]
    
    return f"""
        <role>
        You are a senior QA engineer specializing in black-box and functional test case design.
        You generate precise, traceable, and requirement-aligned BDD-format test cases.
        </role>

        <task>
        Analyze the provided requirement document carefully and generate structured test cases.

        Your goal is to ensure 100% functional coverage of:
        - Modules
        - Screens
        - Fields
        - Validations
        - Business rules
        - Workflows
        - Permissions
        </task>

        <test_type>
        Generate only: Functional (BDD) test cases.
        Additional focus: {type_instruction}
        </test_type>

        <strict_rules>
        1. SOURCE FIDELITY  
        Every test case MUST strictly map to explicitly stated requirements.  
        DO NOT assume, infer, or invent any behavior not present in the document.

        2. COMPLETE COVERAGE  
        You MUST cover:
        - All modules and screens  
        - All fields (text, dropdowns, radio buttons, checkboxes)  
        - All validations (format, required, constraints)  
        - All workflows (create, edit, delete, view)  
        - All business rules  

        3. BDD FORMAT  
        Each test case MUST follow:
        - Given → preconditions  
        - When → actions  
        - Then → expected results  
        Each must be an array of short steps.

        4. MODULE GROUPING  
        Group test cases by module name (top-level JSON keys).

        5. SEQUENTIAL IDS  
        Use global sequential IDs:
        TC_001, TC_002, TC_003...

        6. PRIORITY ASSIGNMENT  
        - High → CRUD, validations, business rules  
        - Medium → dropdowns, defaults  
        - Low → UI/optional fields  

        7. TAGGING  
        Use tags like:
        ["validation", "crud", "business-rule", "dropdown", "edge-case"]

        8. STRICT JSON OUTPUT  
        Return ONLY valid JSON. No explanations.
        </strict_rules>

        <output_schema>
        {{
        "Module Name": [
            {{
            "id": "TC_001",
            "title": "Concise test case title",
            "type": "{resolved_type}",
            "priority": "High",
            "tags": ["validation"],
            "linked_requirement": "Requirement reference",
            "acceptance_criteria": {{
                "given": ["Precondition"],
                "when": ["Action"],
                "then": ["Expected result"]
            }}
            }}
        ]
        }}
        </output_schema>

        <document_context>
        {context}
        </document_context>

        Generate all test cases now from the {documents_count} chunks (pages {page_numbers}).
        Return ONLY valid JSON.
"""

def build_test_case_prompt_v2(context: str, documents_count: int, page_numbers: list, test_type: str | None) -> str:
    """
    VERSION 2: Standard BDD functional test case generator prompt.
    """
    resolved_type = test_type if test_type in _TEST_TYPE_INSTRUCTIONS else _DEFAULT_TEST_TYPE
    type_instruction = _TEST_TYPE_INSTRUCTIONS[resolved_type]
    
    return f"""
        <role>
        You are a senior QA engineer. Generate precise BDD functional test cases strictly from requirements.
        </role>

        <task>
        Analyze the document and generate COMPLETE functional test cases.

        MANDATORY coverage:
        - Listing (view/list screens)
        - Create (add)
        - Update (edit)
        - Delete (with conditions)
        - All fields (input, dropdown, radio, checkbox)
        - Validations (required, format, constraints)
        - Business rules and workflows
        </task>

        <rules>
        1. STRICT SOURCE: Do NOT assume anything not in document  
        2. FORCE CRUD: Always generate test cases for:
        - Listing
        - Create
        - Update
        - Delete (with conditions if any)
        3. FULL COVERAGE: Include all fields, validations, rules  
        4. BDD FORMAT:
        given[], when[], then[] (short steps only)
        5. GROUP BY MODULE
        6. GLOBAL IDS: TC_001, TC_002...
        7. PRIORITY:
        High → CRUD, validation, rules  
        Medium → dropdowns, defaults  
        Low → optional/UI  
        8. OUTPUT: ONLY valid JSON
        </rules>

        <output>
        {{
        "Module Name": [
            {{
            "id": "TC_001",
            "title": "Test case title",
            "type": "{resolved_type}",
            "priority": "High",
            "tags": ["crud"],
            "linked_requirement": "Section name",
            "acceptance_criteria": {{
                "given": [],
                "when": [],
                "then": []
            }}
            }}
        ]
        }}
        </output>

        <context>
        {context}
        </context>

        Generate all test cases now.
        Return ONLY JSON.
"""


# ===========================================================================
# ACTIVE PROMPT SELECTOR
# ===========================================================================
# Point this alias to whichever version you want to use right now.
# The backend chain (test_case_chain.py) strictly uses this alias.
build_test_case_prompt = build_test_case_prompt_v2

def build_updated_test_case_prompt(context: str, existing_tc: dict, instruction: str) -> str:
    """
    Prompt to update a specific test case based on user instruction.
    """
    import json
    tc_json = json.dumps(existing_tc, indent=2)
    return f"""
        <role>
        You are a senior QA engineer. Your task is to update an existing BDD test case based on the user's instructions and the original requirement context.
        </role>

        <task>
        1. Review the existing test case JSON.
        2. Read the user's instruction on how to modify it.
        3. Make the necessary changes (e.g., adding Given/When/Then steps, changing priority, modifying the title).
        4. Maintain the exact same JSON schema.
        5. Return ONLY the updated test case JSON object, without any markdown formatting or explanation.
        </task>

        <user_instruction>
        {instruction}
        </user_instruction>

        <existing_test_case>
        {tc_json}
        </existing_test_case>

        <context>
        {context}
        </context>

        Return ONLY the updated JSON object. Do not wrap it in a module name or an array. Just the object itself.
    """
