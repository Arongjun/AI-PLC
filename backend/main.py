from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from typing import List, Optional
import json
import httpx
import os
from dotenv import load_dotenv

from models import Base, Project, Config
from schemas import GeneratePreviewRequest, GenerateCodeRequest, PreviewResponse, CodeResponse, ConfigSchema
from prompts import SYSTEM_PROMPT_PREVIEW, SYSTEM_PROMPT_CODE

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/data/ai_plc.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-PLC Siemens Program Generator")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to get config
def get_config():
    db = SessionLocal()
    config = db.query(Config).first()
    db.close()
    if not config:
        # Default config if not set
        return {
            "base_url": "https://api.openai.com/v1",
            "api_key": os.getenv("OPENAI_API_KEY", ""),
            "model_name": "gpt-4o"
        }
    return {
        "base_url": config.base_url,
        "api_key": config.api_key,
        "model_name": config.model_name
    }

async def call_ai(system_prompt: str, user_prompt: str, response_format: Optional[str] = None):
    config = get_config()
    if not config["api_key"]:
        raise HTTPException(status_code=400, detail="API Key not configured")

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": config["model_name"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{config['base_url'].rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI Request Failed: {str(e)}")

@app.post("/api/generate-preview", response_model=PreviewResponse)
async def generate_preview(req: GeneratePreviewRequest):
    user_prompt = f"需求: {req.demand}\nPLC 型号: {req.plc_model}"
    ai_content = await call_ai(SYSTEM_PROMPT_PREVIEW, user_prompt, response_format="json_object")
    
    try:
        data = json.loads(ai_content)
        return PreviewResponse(
            flowchart=data.get("flowchart", ""),
            variables=data.get("variables", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")

@app.post("/api/generate-code", response_model=CodeResponse)
async def generate_code(req: GenerateCodeRequest):
    user_prompt = f"""
需求: {req.demand}
PLC 型号: {req.plc_model}
已确认流程图逻辑:
{req.flowchart}
已确认变量表:
{json.dumps([v.dict() for v in req.variables], ensure_ascii=False, indent=2)}

请基于以上确认的信息生成最终的 PLC 代码。
"""
    code = await call_ai(SYSTEM_PROMPT_CODE, user_prompt)
    
    # Save to history (optional but recommended)
    db = SessionLocal()
    new_project = Project(
        name=f"Project_{req.plc_model}",
        plc_model=req.plc_model,
        demand=req.demand,
        flowchart=req.flowchart,
        variables=[v.dict() for v in req.variables],
        final_code=code
    )
    db.add(new_project)
    db.commit()
    db.close()
    
    return CodeResponse(code=code)

@app.post("/api/config")
async def update_config(config: ConfigSchema):
    db = SessionLocal()
    db_config = db.query(Config).first()
    if db_config:
        db_config.base_url = config.base_url
        db_config.api_key = config.api_key
        db_config.model_name = config.model_name
    else:
        db_config = Config(**config.dict())
        db.add(db_config)
    db.commit()
    db.close()
    return {"message": "Config updated"}

@app.post("/api/test-config")
async def test_config(config: ConfigSchema):
    if not config.api_key:
        raise HTTPException(status_code=400, detail="API Key not provided")
    
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": config.model_name,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{config.base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            
            if response.status_code == 200:
                return {"message": "连接成功！配置有效。"}
            else:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", response.text)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=f"API 返回错误: {error_detail}")
                
        except httpx.ConnectError:
            raise HTTPException(status_code=500, detail="无法连接到指定的 Base URL，请检查网络或地址是否正确。")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="请求超时，请检查接口连通性。")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"连接失败: {str(e)}")

@app.get("/api/config")
async def get_current_config():
    return get_config()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18000)
