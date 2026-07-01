# ── ORM models ───────────────────────────────────────────────────────────────
# SQLAlchemy table definitions for the GENTEK database.
# Deleting a User cascades to all their Analyses automatically.

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


# ── User table ────────────────────────────────────────────────────────────────
# Stores registered accounts. Password is stored as a bcrypt hash (never plain text).
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False)
    email      = Column(String(255), unique=True, index=True, nullable=False)
    password   = Column(String(255), nullable=False)          # bcrypt hash
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── Relationship: one user → many analyses (cascade delete) ───────────────
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete")


# ── Analysis table ────────────────────────────────────────────────────────────
# One row per saved analysis. 'label' is the truncated text preview shown in
# the sidebar. 'classification' is one of MALE-BIASED / FEMALE-BIASED /
# GENDER-NEUTRAL / MIXED-BIAS. 'score' is the 0–100 bias intensity percentage.
class Analysis(Base):
    __tablename__ = "analyses"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    label          = Column(String(100))          # first 48 chars of input text
    text           = Column(Text, nullable=False)
    score          = Column(Float)                # 0–100 bias score
    classification = Column(String(50))           # bias category label
    created_at     = Column(DateTime, default=datetime.utcnow)

    # ── Relationship: analysis → owner user ───────────────────────────────────
    user = relationship("User", back_populates="analyses")
