from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    plc_model = Column(String)  # S7-200SMART, S7-1200, S7-1500
    demand = Column(String)
    flowchart = Column(String)  # Mermaid.js code
    variables = Column(JSON)    # Variable table data
    final_code = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Config(Base):
    __tablename__ = "config"

    id = Column(Integer, primary_key=True, index=True)
    base_url = Column(String, default="https://api.openai.com/v1")
    api_key = Column(String)
    model_name = Column(String, default="gpt-4o")
