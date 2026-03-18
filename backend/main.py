from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
    
    # Remove response_format from payload to ensure compatibility with third-party APIs (like grok)
    # Most models will output JSON if instructed in the system prompt.
    # if response_format == "json_object":
    #     payload["response_format"] = {"type": "json_object"}

    # LOGGING: Help user debug why usage is not showing
    print(f"--- AI API REQUEST ---")
    print(f"URL: {config['base_url'].rstrip('/')}/chat/completions")
    print(f"Model: {config['model_name']}")
    print(f"Payload Size: {len(json.dumps(payload))} bytes")
    print(f"----------------------")

    async with httpx.AsyncClient() as client:
        for attempt in range(3): # Try up to 3 times for transient gateway errors
            try:
                response = await client.post(
                    f"{config['base_url'].rstrip('/')}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=300.0
                )
                
                # If we get a gateway error, retry
                if response.status_code in [502, 503, 504] and attempt < 2:
                    print(f"Gateway error {response.status_code}, retrying (attempt {attempt + 1})...")
                    continue

                # Check for non-200 status codes explicitly
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail=f"API Error ({response.status_code}): {response.text}")
                    
                try:
                    result = response.json()
                except Exception as e:
                    # This catches the 'Expecting value: line 1 column 1' error and shows the actual response text
                    raise HTTPException(status_code=500, detail=f"API did not return valid JSON. Raw response: {response.text}")
                
                # Extract content safely
                choices = result.get("choices", [])
                if not choices:
                    raise HTTPException(status_code=500, detail=f"API returned no choices. Response: {result}")
                
                content = choices[0].get("message", {}).get("content", "")
                if not content:
                    raise HTTPException(status_code=500, detail="API returned empty content")
                    
                # If response format is JSON, try to clean markdown code blocks
                if response_format == "json_object":
                    content = content.strip()
                    if content.startswith("```json"):
                        content = content[7:]
                    if content.startswith("```"):
                        content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()
                    
                return content
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < 2:
                    print(f"Connection error {str(e)}, retrying...")
                    continue
                raise HTTPException(status_code=504, detail=f"AI API Connection Timeout after 3 attempts: {str(e)}")
            except HTTPException:
                raise # Re-raise HTTPExceptions as-is
            except Exception as e:
                print(f"AI Call Error: {str(e)}")
                if 'response' in locals():
                    print(f"Response Body: {response.text}")
                raise HTTPException(status_code=500, detail=f"AI Request Failed: {str(e)}")

@app.post("/api/generate-preview")
async def generate_preview(req: GeneratePreviewRequest):
    async def sse_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': '正在读取系统配置与 API 密钥...'})}\n\n"
            config = get_config()
            model_name = config.get('model_name', 'Unknown')
            
            yield f"data: {json.dumps({'type': 'status', 'message': f'正在连接 AI 模型: {model_name}...'})}\n\n"
            user_prompt = f"需求: {req.demand}\nPLC 型号: {req.plc_model}"
            
            yield f"data: {json.dumps({'type': 'status', 'message': '正在请求 AI 生成预览数据 (通常耗时 5-30秒)...'})}\n\n"
            ai_content = await call_ai(SYSTEM_PROMPT_PREVIEW, user_prompt, response_format="json_object")
            
            yield f"data: {json.dumps({'type': 'status', 'message': '收到响应，正在解析逻辑结构...'})}\n\n"
            try:
                data = json.loads(ai_content)
                yield f"data: {json.dumps({'type': 'result', 'data': data})}\n\n"
            except Exception as e:
                error_msg = f"解析 AI 响应失败: {str(e)}. 原始内容: {ai_content}"
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                
        except HTTPException as he:
            yield f"data: {json.dumps({'type': 'error', 'message': he.detail})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/generate-code")
async def generate_code(req: GenerateCodeRequest):
    async def sse_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': '正在加载已确认的逻辑与变量表...'})}\n\n"
            user_prompt = f"""
需求: {req.demand}
PLC 型号: {req.plc_model}
已确认流程图逻辑:
{req.flowchart}
已确认变量表:
{json.dumps([v.dict() for v in req.variables], ensure_ascii=False, indent=2)}

请基于以上确认的信息生成最终的 PLC 代码。
"""
            yield f"data: {json.dumps({'type': 'status', 'message': '正在请求 AI 生成最终 PLC 代码...'})}\n\n"
            code = await call_ai(SYSTEM_PROMPT_CODE, user_prompt)
            
            yield f"data: {json.dumps({'type': 'status', 'message': '正在保存项目记录到数据库...'})}\n\n"
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
            
            yield f"data: {json.dumps({'type': 'result', 'data': {'code': code}})}\n\n"
        except HTTPException as he:
            yield f"data: {json.dumps({'type': 'error', 'message': he.detail})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

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
