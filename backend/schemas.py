from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class PLCModel(BaseModel):
    model_name: str  # S7-200SMART, S7-1200, S7-1500

class GeneratePreviewRequest(BaseModel):
    demand: str
    plc_model: str

class Variable(BaseModel):
    name: str
    address: Optional[str] = None  # For 200SMART
    data_type: Optional[str] = None  # For 1200/1500
    default_value: Optional[str] = None
    comment: Optional[str] = None

class PreviewResponse(BaseModel):
    flowchart: str
    variables: List[Variable]

class GenerateCodeRequest(BaseModel):
    demand: str
    plc_model: str
    flowchart: str
    variables: List[Variable]

class CodeResponse(BaseModel):
    code: str

class ConfigSchema(BaseModel):
    base_url: str
    api_key: str
    model_name: str

class ProjectOut(BaseModel):
    id: int
    name: str
    plc_model: str
    demand: str
    created_at: datetime

    class Config:
        from_attributes = True
