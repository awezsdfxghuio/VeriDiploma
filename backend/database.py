from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./diplomas.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DiplomaRecord(Base):
    __tablename__ = "diplomas"

    token_id = Column(Integer, primary_key=True, index=True)
    student_address = Column(String, index=True)
    student_name = Column(String, index=True)
    major = Column(String)
    graduation_year = Column(Integer)
    status = Column(String, default="Pending")  # Pending, Active, Revoked
    revocation_reason = Column(String, nullable=True, default="")
    updated_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)