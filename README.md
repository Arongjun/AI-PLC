# AI-PLC Siemens Program Generator 🚀

> **工业互联网全栈架构师级 PLC 自动编程平台**

本平台旨在利用大语言模型（LLM）的强大能力，为西门子 S7 系列 PLC 提供智能化的程序生成服务。通过“需求输入 -> 预览确认 -> 代码生成”的三步式闭环工作流，确保生成的控制逻辑既高效又安全。

## 🌟 核心特性

- **分步确认逻辑**：严禁一键生成，必须经过“流程图预览”和“变量表审核”阶段。
- **多型号支持**：覆盖 S7-200SMART (AWL/STL)、S7-1200/1500 (SCL)。
- **可视化交互**：集成 Mermaid.js 渲染逻辑流程，提供可编辑表格调整 I/O 地址。
- **动态 AI 配置**：支持 OpenAI 格式接口，可动态修改 Base URL、API Key 和模型名称。
- **一键部署**：完整的 Docker 化方案，数据持久化存储。

## 🛠️ 技术栈

- **前端**: React 18, Vite, Tailwind CSS, Mermaid.js, Lucide Icons
- **后端**: Python FastAPI, SQLAlchemy, SQLite, Pydantic
- **部署**: Docker, Docker Compose

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/Arongjun/AI-PLC.git
cd AI-PLC
```

### 2. 部署服务
确保您的机器已安装 Docker 和 Docker Compose。
```bash
docker-compose up --build -d
```

### 3. 访问与配置
- 前端地址：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- **初次使用**：点击右上角设置图标，配置您的 AI 接口参数（Base URL, API Key, Model）。

## 📂 目录结构
- `/backend`: FastAPI 后端服务，包含 AI 调度与数据库逻辑。
- `/frontend`: React 前端应用，包含多步骤状态机界面。
- `/data`: SQLite 数据库挂载目录。
- `docker-compose.yml`: 容器编排配置。

## 🛡️ 业务工作流

1. **需求输入**：用户描述控制逻辑（如：带互锁的电机启停）。
2. **预生成与确认**：
   - **流程图**：AI 生成 Mermaid 逻辑图，用户核对业务逻辑。
   - **变量表**：AI 提取变量，用户可修改地址（如 I0.0, Q0.1）和类型。
3. **代码生成**：系统基于确认后的上下文，生成最终符合西门子规范的 SCL 或 AWL 代码。

## 📄 开源协议
MIT License
