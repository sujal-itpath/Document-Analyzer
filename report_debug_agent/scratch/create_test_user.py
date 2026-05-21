import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import User, SessionLocal, init_db
from app.core.security import get_password_hash

def create_test_user():
    init_db()
    db = SessionLocal()
    try:
        email = "test123@gmail.com"
        password = "test1234"
        
        # Check if user exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"User {email} already exists.")
            return
            
        hashed_password = get_password_hash(password)
        new_user = User(email=email, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        print(f"Successfully created user: {email}")
    except Exception as e:
        print(f"Error creating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
