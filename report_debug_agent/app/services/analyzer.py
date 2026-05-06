import json
from langchain_ollama import OllamaLLM
from app.db.database import SessionLocal, Document

class DocumentAnalyzer:
    def __init__(self):
        self.llm = OllamaLLM(model="gemma4:e4b", base_url="http://192.168.1.240:11434")

    async def analyze(self, document_id: int, text: str):
        """Perform one-time analysis of a document to generate summary and suggestions."""
        prompt = f"""
        Analyze the following text and provide:
        1. A concise summary (max 3 sentences).
        2. Three suggested questions that a user might ask about this document.
        
        Format your response as a JSON object with keys "summary" and "suggestions" (a list of strings).
        
        Text:
        {text[:4000]}  # Analyze first 4000 characters for speed
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
                        print(f"Analysis complete for document {document_id}")
                finally:
                    db.close()
        except Exception as e:
            print(f"Analysis failed for document {document_id}: {e}")
