import json
import uuid
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from langchain_ollama import OllamaLLM
from app.core.config import settings
from app.db.database import JiraTicketDraft, Project, Document
from app.services.retrieval import search_docs
from app.services.chat_context import set_allowed_sources

logger = logging.getLogger(__name__)

class JiraAIAssistant:
    def __init__(self):
        self.llm = OllamaLLM(model=settings.OLLAMA_CHAT_MODEL, base_url=settings.OLLAMA_BASE_URL)

    def _parse_llm_json(self, response: str) -> Dict[str, Any]:
        try:
            start = response.find('{')
            end = response.rfind('}') + 1
            if start != -1 and end != 0:
                return json.loads(response[start:end])
            return {}
        except Exception as e:
            logger.error(f"Failed to parse JSON from LLM: {response}\nError: {e}")
            return {}

    def _get_workspace_context(self, db: Session, workspace_project_id: int, query: str) -> str:
        """Fetch RAG context for a given query, scoped to a workspace project."""
        if not workspace_project_id:
            return ""
            
        docs = db.query(Document).filter(Document.project_id == workspace_project_id).all()
        allowed_sources = {d.file_path for d in docs if d.file_path}
        
        # Scope the retrieval down
        set_allowed_sources(allowed_sources)
        results = search_docs(query, k=5)
        set_allowed_sources(None) # reset
        
        if not results:
            return ""
            
        context = "\n\n".join([r.page_content for r in results])
        return context

    def start_session(self, db: Session, user_id: int, project_id: str, issue_type: str, workspace_project_id: int = None) -> dict:
        session_id = str(uuid.uuid4())
        
        draft = JiraTicketDraft(
            id=str(uuid.uuid4()),
            session_id=session_id,
            user_id=user_id,
            project_id=project_id,
            issue_type=issue_type,
            collected_answers=json.dumps({}),
            confidence_score=0,
            status="gathering"
        )
        db.add(draft)
        db.commit()

        # Generate first question
        prompt = f"""
        You are an expert Jira Product Owner AI Assistant.
        The user wants to create a '{issue_type}' ticket in Jira.
        Start the requirement discovery conversation by asking the most critical initial question to understand their objective.
        Do NOT ask open-ended questions. Provide exactly 3 intelligent options for them to choose from.
        
        Output MUST be valid JSON:
        {{
            "question": "Your question here?",
            "options": ["Option 1", "Option 2", "Option 3"],
            "allowCustomInput": true
        }}
        """
        response = self.llm.invoke(prompt)
        parsed = self._parse_llm_json(response)
        
        # Fallback if LLM fails formatting
        if not parsed.get("question"):
            parsed = {
                "question": f"What is the primary objective of this {issue_type}?",
                "options": ["New Feature", "Enhancement", "Bug Fix"],
                "allowCustomInput": True
            }

        return {
            "session_id": session_id,
            "question": parsed.get("question"),
            "options": parsed.get("options", []),
            "allowCustomInput": parsed.get("allowCustomInput", True)
        }

    def process_answer(self, db: Session, session_id: str, answer: str, workspace_project_id: int = None) -> dict:
        draft = db.query(JiraTicketDraft).filter(JiraTicketDraft.session_id == session_id).first()
        if not draft:
            raise ValueError("Invalid session ID")

        # Update answers
        answers = json.loads(draft.collected_answers)
        
        # Use a generic key 'latest_answer' or find a way to map question -> answer
        # For simplicity, we just append to a list of interactions
        if "interactions" not in answers:
            answers["interactions"] = []
            
        answers["interactions"].append({"user_answer": answer})
        
        # Create a semantic query from recent answers
        query_text = " ".join([interaction["user_answer"] for interaction in answers["interactions"]])
        context = self._get_workspace_context(db, workspace_project_id, query_text) if workspace_project_id else ""

        prompt = f"""
        You are an expert Jira AI Assistant gathering requirements for a '{draft.issue_type}' ticket.
        
        Previous interactions:
        {json.dumps(answers["interactions"], indent=2)}
        
        Workspace Context available:
        {context[:2000]}
        
        Task:
        1. Evaluate the completeness of the requirements. Are we ready to write a comprehensive ticket (Summary, Description, Acceptance Criteria)?
        2. Calculate a confidence score from 0 to 100.
        3. If confidence < 90, ask the NEXT most important missing detail. Provide up to 3 options.
        4. If confidence >= 90, do not ask a question.
        
        Output MUST be valid JSON:
        {{
            "confidence_score": 85,
            "question": "If < 90, your next question?",
            "options": ["Option A", "Option B", "Option C"],
            "allowCustomInput": true
        }}
        """

        response = self.llm.invoke(prompt)
        parsed = self._parse_llm_json(response)
        
        confidence = parsed.get("confidence_score", draft.confidence_score)
        draft.confidence_score = confidence
        draft.collected_answers = json.dumps(answers)
        
        if confidence >= 90:
            draft.status = "ready_for_generation"
            db.commit()
            return {"status": "ready_for_generation"}
            
        db.commit()
        
        return {
            "status": "gathering",
            "question": parsed.get("question", "Could you provide more details?"),
            "options": parsed.get("options", []),
            "allowCustomInput": parsed.get("allowCustomInput", True)
        }

    def generate_ticket(self, db: Session, session_id: str, workspace_project_id: int = None) -> dict:
        draft = db.query(JiraTicketDraft).filter(JiraTicketDraft.session_id == session_id).first()
        if not draft:
            raise ValueError("Invalid session ID")
            
        answers = json.loads(draft.collected_answers)
        interactions_text = json.dumps(answers.get("interactions", []), indent=2)
        
        prompt = f"""
        You are an expert Jira Product Owner.
        Based on the following conversation history for a '{draft.issue_type}' ticket, generate a comprehensive Jira ticket.
        
        Conversation:
        {interactions_text}
        
        Output MUST be valid JSON with the following structure:
        {{
            "summary": "Short title",
            "description": "Problem Statement\\n\\nProposed Solution\\n\\nTechnical Notes",
            "acceptance_criteria": "Given... When... Then...",
            "test_cases": "### Test Case 1\\nTitle: ...\\nSteps: ...\\nExpected: ..."
        }}
        Ensure you generate at least 5 test cases covering positive, negative, and edge scenarios.
        """
        response = self.llm.invoke(prompt)
        parsed = self._parse_llm_json(response)
        
        ticket_draft = {
            "summary": parsed.get("summary", "New Ticket"),
            "description": parsed.get("description", ""),
            "acceptance_criteria": parsed.get("acceptance_criteria", ""),
        }
        
        test_cases = parsed.get("test_cases", "")
        
        draft.ticket_draft = json.dumps(ticket_draft)
        draft.test_cases = test_cases
        draft.status = "review"
        db.commit()
        
        return {
            "ticket": ticket_draft,
            "test_cases": test_cases
        }

    def revise_test_cases(self, db: Session, session_id: str, new_ac: str) -> dict:
        draft = db.query(JiraTicketDraft).filter(JiraTicketDraft.session_id == session_id).first()
        if not draft:
            raise ValueError("Invalid session ID")
            
        prompt = f"""
        You are a QA Automation Expert.
        The Acceptance Criteria for a Jira ticket have been updated. 
        Regenerate the Test Cases based ONLY on these new Acceptance Criteria.
        Generate at least 5 test cases.
        
        New Acceptance Criteria:
        {new_ac}
        
        Output MUST be valid JSON with the following structure:
        {{
            "test_cases": "### Test Case 1\\nTitle: ...\\nSteps: ...\\nExpected: ..."
        }}
        """
        response = self.llm.invoke(prompt)
        parsed = self._parse_llm_json(response)
        
        new_test_cases = parsed.get("test_cases", draft.test_cases)
        draft.test_cases = new_test_cases
        
        # update draft JSON
        current_ticket = json.loads(draft.ticket_draft) if draft.ticket_draft else {}
        current_ticket["acceptance_criteria"] = new_ac
        draft.ticket_draft = json.dumps(current_ticket)
        
        db.commit()
        
        return {
            "test_cases": new_test_cases
        }
