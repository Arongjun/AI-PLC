# AI-PLC 架构文档 (ARCHITECTURE.md)

本平台的核心逻辑围绕“分步确认”展开，确保 AI 生成的工业控制代码具有高度的可控性和安全性。

## 🏗️ 核心逻辑流

### 1. 后端工作流路由 (Backend Routing)

后端设计了两个核心接口，将原本的一轮生成任务拆分为两阶段对话状态：

- **`POST /api/generate-preview`**:
  - **输入**: 用户文本描述、PLC 型号。
  - **处理**: 调用 `SYSTEM_PROMPT_PREVIEW`。要求 AI 输出严格的 JSON 对象，包含 Mermaid 流程图代码和结构化的变量列表。
  - **逻辑控制**: 使用 Pydantic 模型 `PreviewResponse` 校验 AI 输出，确保其能够被前端正确解析。

- **`POST /api/generate-code`**:
  - **输入**: 用户确认/修改后的需求、型号、流程图代码、变量表。
  - **处理**: 将确认后的数据作为“严格上下文”调用 `SYSTEM_PROMPT_CODE`。
  - **逻辑控制**: AI 仅基于已确认的逻辑框架生成具体语言（SCL/AWL）的代码实现，最大限度减少逻辑偏移。

### 2. 系统提示词设计 (Prompt Engineering)

在 [prompts.py](file:///backend/prompts.py) 中定义了两个阶段的高质量 Prompt：

- **预览阶段 Prompt**:
  - 强制要求 JSON 响应格式。
  - 明确不同 PLC 型号的寻址规范（200SMART 物理地址 vs 1200/1500 符号地址）。
  - 角色设定为“资深西门子自动化专家”，确保变量命名和逻辑结构的专业度。

- **代码生成阶段 Prompt**:
  - 强调 Siemens 编程规范（Network 结构、模块化、联锁保护）。
  - 明确语言转换规则（S7-1200/1500 -> SCL, 200SMART -> AWL/STL）。

### 3. 前端状态机 (Frontend State Machine)

前端在 [App.tsx](file:///frontend/src/App.tsx) 中通过 `step` 状态控制三步式工作流：

- **Step 1 (Input)**: 收集初始控制需求。
- **Step 2 (Preview & Edit)**: 
  - 集成 `mermaid` 库渲染 AI 生成的流程图。
  - 提供响应式表格组件，允许用户直接在 UI 上修正变量名、地址、数据类型和注释。
- **Step 3 (Final Code)**: 展示最终代码并提供快捷复制。

### 4. 持久化与部署 (Persistence & Docker)

- **SQLite**: 使用轻量化数据库存储用户 AI 接口配置及历史项目记录。
- **Docker Compose**: 
  - `backend` 容器负责 AI 调度与 DB 操作，对外暴露端口 **`18000`**。
  - `frontend` 容器使用 Nginx 托管构建后的 React 应用，对外暴露端口 **`13000`**。
  - 通过 `volumes` 挂载 `./data` 目录实现数据库文件的持久化。

## 🔒 安全说明

工业场景中，AI 生成的代码**严禁未经人工审核直接下装**。本平台的“分步确认”机制正是为了将“人工审核”嵌入到生成工作流中，作为最后一道安全防线。
