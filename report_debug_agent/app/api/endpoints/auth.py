from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db.database import get_db, User
from app.core.security import verify_password, get_password_hash, create_access_token, ALGORITHM, SECRET_KEY
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfileResponse(BaseModel):
    email: EmailStr
    username: str
    display_name: str
    avatar_color: str

class UserProfileUpdate(BaseModel):
    username: str
    display_name: str
    avatar_color: Optional[str] = None

@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    
    username = user_data.email.split("@")[0]
    display_name = username.replace(".", " ").replace("_", " ").replace("-", " ").title()
    avatar_color = "bg-gradient-to-tr from-accent to-indigo-500"
    
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        username=username,
        display_name=display_name,
        avatar_color=avatar_color
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    username = current_user.username
    if not username:
        username = current_user.email.split("@")[0]
        
    display_name = current_user.display_name
    if not display_name:
        display_name = username.replace(".", " ").replace("_", " ").replace("-", " ").title()
        
    avatar_color = current_user.avatar_color or "bg-gradient-to-tr from-accent to-indigo-500"
    
    return {
        "email": current_user.email,
        "username": username,
        "display_name": display_name,
        "avatar_color": avatar_color
    }

@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.username = profile_data.username
    current_user.display_name = profile_data.display_name
    if profile_data.avatar_color:
        current_user.avatar_color = profile_data.avatar_color
        
    db.commit()
    db.refresh(current_user)
    
    return {
        "email": current_user.email,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_color": current_user.avatar_color or "bg-gradient-to-tr from-accent to-indigo-500"
    }
