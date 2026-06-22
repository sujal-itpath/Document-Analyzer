import json
import logging
from langchain_ollama import OllamaLLM
from app.core.config import settings
from app.db.database import SessionLocal, Document

logger = logging.getLogger(__name__)

class DocumentAnalyzer:
    def __init__(self):
        self.llm = OllamaLLM(model=settings.OLLAMA_CHAT_MODEL, base_url=settings.OLLAMA_BASE_URL)

    async def analyze(self, document_id: int, text: str):
        """Perform one-time analysis of a document to generate summary and suggestions."""
        prompt = f"""
        Analyze the following text and provide:
        1. A useful summary in 4-6 sentences covering purpose, major findings, and important details.
        2. Three suggested questions that a user might ask about this document.
        
        Format your response as a JSON object with keys "summary" and "suggestions" (a list of strings).
        
        Text:
        {text[:25000]}
        """
        
        try:
            response = self.llm.invoke(prompt)
            # Try to parse JSON from the response
            # Note: In a real app, you'd use a more robust parser
            start = response.find('{')
            end = response.rfind('}') + 1
            if start != -1 and end != 0:
                data = json.loads(response[start:end])
                
                db = SessionLocal()
                try:
                    doc = db.query(Document).filter(Document.id == document_id).first()
                    if doc:
                        doc.summary = data.get("summary", "")
                        doc.suggestions = json.dumps(data.get("suggestions", []))
                        db.commit()
                        logger.info("Analysis complete for document %s", document_id)
                finally:
                    db.close()
        except Exception as e:
            logger.warning("Analysis failed for document %s: %s", document_id, e)
