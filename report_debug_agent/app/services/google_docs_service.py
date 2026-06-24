from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.db.database import SessionLocal, UserIntegration
import re
import logging

logger = logging.getLogger(__name__)

def get_google_credentials(user_id: int):
    """Fetch stored Google credentials for a user and construct a Credentials object"""
    db = SessionLocal()
    try:
        integration = db.query(UserIntegration).filter(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == "google"
        ).first()
        
        if not integration or not integration.access_token:
            return None
            
        import os
        client_id = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_GOOGLE_CLIENT_SECRET")
            
        credentials = Credentials(
            token=integration.access_token,
            refresh_token=integration.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
        )
        return credentials
    finally:
        db.close()

def extract_doc_id_from_url(url: str) -> str:
    """Extracts the document ID from a Google Docs URL."""
    match = re.search(r'/document/d/([a-zA-Z0-9-_]+)', url)
    if match:
        return match.group(1)
    return url

def fetch_google_doc_docx(user_id: int, doc_url_or_id: str) -> bytes:
    """Fetches the content of a Google Doc as a .docx file using the Drive API export feature."""
    doc_id = extract_doc_id_from_url(doc_url_or_id)
    creds = get_google_credentials(user_id)
    if not creds:
        raise Exception("Google credentials not found for user. Please connect your Google account.")
        
    drive_service = build('drive', 'v3', credentials=creds)
    
    request = drive_service.files().export_media(
        fileId=doc_id, 
        mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    response = request.execute()
    
    return response

def replace_text_in_doc(user_id: int, doc_url_or_id: str, target_text: str, replacement_text: str) -> bool:
    """Replaces all instances of a specific text in a Google Doc."""
    doc_id = extract_doc_id_from_url(doc_url_or_id)
    creds = get_google_credentials(user_id)
    if not creds:
        raise Exception("Google credentials not found for user. Please connect your Google account.")
        
    docs_service = build('docs', 'v1', credentials=creds)
    
    requests = [
        {
            'replaceAllText': {
                'containsText': {
                    'text': target_text,
                    'matchCase': True
                },
                'replaceText': replacement_text,
            }
        }
    ]
    
    result = docs_service.documents().batchUpdate(
        documentId=doc_id, body={'requests': requests}).execute()
        
    replacements = result.get('replies', [{}])[0].get('replaceAllText', {}).get('occurrencesChanged', 0)
    return replacements > 0

def list_google_docs(user_id: int):
    """Lists all Google Docs available to the authenticated user."""
    logger.debug("Attempting to list Google Docs for user %s", user_id)
    creds = get_google_credentials(user_id)
    if not creds:
        logger.debug("No Google credentials found for user %s", user_id)
        raise Exception("Google account not connected.")
        
    logger.debug("Found Google credentials for user %s; token valid: %s", user_id, creds.valid)
    drive_service = build('drive', 'v3', credentials=creds)
    
    # Query for Google Docs, sort by recently modified
    results = drive_service.files().list(
        q="mimeType='application/vnd.google-apps.document'",
        pageSize=50,
        fields="nextPageToken, files(id, name, modifiedTime)",
        orderBy="modifiedTime desc"
    ).execute()
    
    files = results.get('files', [])
    logger.debug("Found %d Google Docs for user %s", len(files), user_id)
    return files
