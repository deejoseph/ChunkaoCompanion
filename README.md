# 🎯 春考伴学 (Chunkao Companion)

一个**完全本地部署**的 AI 助教系统，专为上海春季高考设计。只需 8G 显存，即可在本地运行 AI 模型，帮助学生学习语文、数学、英语。

## ✨ 功能特点

- **知识点学习** - 按学科/版本浏览专题，支持教师版/学生版切换
- **AI 助教** - 基于 Ollama + Qwen2.5 的本地 AI，支持语文/数学/英语/作文批改
- **数学公式渲染** - LaTeX 公式完美显示（KaTeX）
- **真题模考** - 2017-2026 年上海春考真题 + 模拟卷
- **英语听力** - 听力音频 + 题目 PDF
- **学习进度追踪** - 本地存储，自动统计完成率
- **悬浮 AI 助手** - 随时提问，不影响阅读
- **OCR 答题卡上传** - 拍照上传，AI 批改（预留接口）

## 🖥️ 硬件要求

| 配置 | 最低要求 | 推荐配置 |
|-----|---------|---------|
| CPU | i5 10代 / R5 3600 | i7 / R7 |
| 内存 | 16GB | 32GB |
| 显卡 | RTX 3060 (8GB) | RTX 3070 / 4060 |
| 硬盘 | 20GB 空闲 | 50GB |
| 系统 | Windows 10/11 | Windows 11 |

## 🚀 快速开始

### 1. 安装 Ollama

```bash
# 下载安装 Ollama
https://ollama.com/download

# 拉取模型
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
2. 安装 Node.js
下载安装 Node.js 18+ 版本

3. 克隆项目
bash
git clone git@github.com:deejoseph/ChunkaoCompanion.git
cd ChunkaoCompanion
4. 安装依赖
bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
5. 准备学习资料
将 Word/PDF 文件放入 data/docs/ 对应目录：

data/docs/chinese/2026/ - 语文2026版专题

data/docs/math/2026/ - 数学2026版专题

data/docs/english/2026/ - 英语2026版专题

将真题放入 data/exams/ 对应目录

6. 启动服务
bash
# Windows
start.bat

# Mac/Linux
./start.sh
访问 http://localhost:5173

📁 项目结构
text
ChunkaoCompanion/
├── backend/          # Node.js + Express 后端
│   ├── routes/       # API 路由
│   └── services/     # AI 服务
├── frontend/         # React + Vite 前端
│   └── src/
│       └── components/  # React 组件
├── data/
│   ├── docs/         # 知识点文档（按学科/版本）
│   └── exams/        # 真题 + 模拟卷
├── scripts/          # Python 辅助脚本
└── start.bat         # Windows 启动脚本
🛠️ 技术栈
层级	技术
前端	React 18 + Vite + Ant Design
后端	Node.js + Express
数据库	SQLite / PostgreSQL
AI	Ollama + Qwen2.5
公式渲染	KaTeX + remark-math
📝 后续计划
刷题模块（答题、批改、错题本）

数据分析（热点图、趋势预测）

AI 自动出题

家长邮件报告

Electron 打包桌面应用

📄 许可证
MIT License

👨‍💻 作者
deejoseph