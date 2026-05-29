from typing import Dict

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
        "Generate ONLY the 5 most critical test cases \u2014 the absolute minimum "
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
        High \u2192 CRUD, validation, rules  
        Medium \u2192 dropdowns, defaults  
        Low \u2192 optional/UI  
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

build_test_case_prompt = build_test_case_prompt_v2
