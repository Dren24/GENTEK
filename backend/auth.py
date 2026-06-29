from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import bcrypt

from database import get_db
from models import User, Analysis

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AnalysisIn(BaseModel):
    label: str
    text: str
    score: float
    classification: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"id": user.id, "name": user.name, "email": user.email}


@router.put("/update/{user_id}")
def update_user(user_id: int, req: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = req.name
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.delete("/delete/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "Account deleted"}


@router.post("/history/{user_id}")
def save_analysis(user_id: int, req: AnalysisIn, db: Session = Depends(get_db)):
    analysis = Analysis(
        user_id=user_id,
        label=req.label,
        text=req.text,
        score=req.score,
        classification=req.classification,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return {"id": analysis.id}


@router.delete("/history/{user_id}/{analysis_id}")
def delete_analysis(user_id: int, analysis_id: int, db: Session = Depends(get_db)):
    item = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}


@router.get("/history/{user_id}")
def get_history(user_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(Analysis)
        .filter(Analysis.user_id == user_id)
        .order_by(Analysis.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": item.id,
            "label": item.label,
            "text": item.text,
            "score": item.score,
            "classification": item.classification,
            "timestamp": item.created_at.timestamp() * 1000,
        }
        for item in items
    ]
