# 资料采集模块 — 任务 / Issue 列表

日期: 2026-05-30
来源: docs/资料采集模块开发进度.md（2026-05-29 条目）

## 概要
将资料采集模块的未完成项、回归修复和下一步改进以 Issue 风格列出，便于指派与跟踪。优先级分为 P0 / P1 / P2。

---

## P0（必须尽快完成）

- 修复题库读写统一入口（后端优先）
  - 描述：`GET /api/banks/:id`、`GET /api/banks/search` 应优先直接读写 SQLite，JSON 仅作备份兜底。保证前端取到的 `bankId` 与数据库一致。
  - 负责：后端（建议：@后端负责人）
  - 影响文件：`backend/routes/banks.js`
  - 备注：已部分实现，需全面回归并补充单元/集成测试。

- 同步删除逻辑（DB + JSON + 资产）
  - 描述：`DELETE /api/banks/:id` 必须删除 `question_banks`、`questions`、`question_assets`、`question_knowledge_points`，并清理 JSON 备份与磁盘资产。
  - 负责：后端
  - 影响文件：`backend/routes/banks.js`、资产目录 `data/question_assets/`

- `POST /api/banks/save` 补齐来源字段并避免重复写入
  - 描述：保存时补齐 `source_path`、`source_format`、`paper_type`，并在写入前清理旧题目避免重复。
  - 负责：后端 + 前端 `DataImport.jsx`（保存时补齐字段）
  - 验证：运行 `python backend/scripts/test_answer_management.py` 并通过构建验证。

- `saveToDb` 流程（从 `/api/docs/parse-corrected` 到 SQLite）
  - 描述：实现并回归测试，确保解析校正后的题目能直接写入 `question_banks` 与 `questions`，并生成 JSON 备份。
  - 负责：后端、前端
  - 影响文件：`backend/routes/docs.js` 或 `backend/routes/banks.js`（实现点）、`frontend/src/components/DataImport.jsx`

- 题号/答案写回一致性修复
  - 描述：`POST /api/banks/update-answer` 必须使用数据库 `bankId` 与 `question.number` 写回 `questions.source_answer`，避免下标位移问题。
  - 负责：前后端联调


## P1（中期改进）

- 拆分 UI：知识点采集与题库采集独立入口
  - 描述：把 `DataImport.jsx` 的两部分拆成独立页面或子路由，优化 UX。
  - 负责：前端

- 知识点草稿入库接口
  - 描述：新增 `POST /api/knowledge/import-draft`，将校对后的 JSON 写入 `knowledge_points` 与来源记录。
  - 负责：后端

- 题目—知识点自动候选并人工确认流程
  - 描述：在题库采集中展示候选知识点，允许人工确认后写入 `question_knowledge_points`。
  - 负责：前端 + 后端

- 公式/图形资产管理
  - 描述：完善 `question_assets` 的截图落盘流程，支持 `asset_type`、`bbox`、`page_number`。
  - 负责：后端 + 前端校对界面


## P2（愿景/优化）

- 知识点管理界面（合并/重命名/删除）
- 知识点/题目统计分析接口（按年份/题型/分值/知识点）
- 自动化定期抽取与批量导入流水线（CI 支持）


## 提交与验证建议
- 回归用例：`python backend/scripts/test_answer_management.py`；后端 `node --check` 所有 routes；前端 `npm run build`。
- 先在开发分支完成 P0，合并前确保数据回滚脚本可用（备份 JSON + SQLite 备份）。


---

文件生成：由自动化助手于 2026-05-30 写入。
