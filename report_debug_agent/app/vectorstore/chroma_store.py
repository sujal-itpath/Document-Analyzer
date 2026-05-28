import re
from app.db.database import SessionLocal, Document as DBDocument

def sanitise_collection_name(filename: str) -> str:
    """
    Sanitises a filename to a format suitable for a ChromaDB collection name:
    - 3-63 characters long
    - Alphanumeric start/end
    - No consecutive dots
    - Only alphanumeric, underscores, or hyphens.
    """
    # Remove file extension first
    name_without_ext = re.sub(r'\.[^.]+$', '', filename)
    # Replace non-alphanumeric, non-underscore, non-hyphen with underscores
    sanitised = re.sub(r'[^a-zA-Z0-9_-]', '_', name_without_ext)
    # Strip non-alphanumeric from beginning/end
    sanitised = re.sub(r'^[^a-zA-Z0-9]+', '', sanitised)
    sanitised = re.sub(r'[^a-zA-Z0-9]+$', '', sanitised)
    
    # Check lengths
    if len(sanitised) < 3:
        sanitised = (sanitised + "___")[:3]
    elif len(sanitised) > 63:
        sanitised = sanitised[:63]
        # Re-strip ending alphanumeric just in case
        sanitised = re.sub(r'[^a-zA-Z0-9]+$', '', sanitised)
        if len(sanitised) < 3:
            sanitised = (sanitised + "___")[:3]
            
    return sanitised

def collection_exists(collection_name: str) -> bool:
    """
    Checks if a collection exists by seeing if there is a document in the SQLite DB
    whose sanitised filename matches the given collection_name.
    """
    db = SessionLocal()
    try:
        documents = db.query(DBDocument).all()
        for doc in documents:
            if sanitise_collection_name(doc.filename) == collection_name:
                return True
        return False
    finally:
        db.close()
