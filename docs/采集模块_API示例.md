# 资料采集模块 — API 调用示例

日期: 2026-05-30

本文档包含两个常用接口的调用路径与请求示例：`POST /api/docs/parse-corrected`（解析校正后的文本，可选写入数据库）和 `POST /api/banks/save`（保存题库到 SQLite 并生成 JSON 备份）。

---

## 1) POST /api/docs/parse-corrected

- 路径: `/api/docs/parse-corrected`
- 方法: `POST`
- 描述: 将已经人工校正或处理过的纯文本提交给服务做题目提取；可通过 `saveToDb=true` 将解析结果写入数据库并生成 JSON 备份。

- 请求体（JSON）示例：

```json
{
  "correctedText": "1. 题干一... 【答案】A 【解析】解析内容\n2. 题干二... \n",
  "answerMarker": "【答案】",
  "analysisMarker": "【解析】",
  "questionPattern": "",
  "pageStart": 1,
  "pageEnd": 10,
  "saveToDb": true,
  "paperId": "sample_paper_2026_001",
  "title": "样例试卷 2026",
  "subject": "chinese",
  "version": "2026",
  "sourcePath": "data/docs/chinese/2026/样例.pdf",
  "sourceFormat": "pdf",
  "paperType": "mock",
  "topicName": "专题名称"
}
```

- curl 示例：

```bash
curl -X POST http://localhost:3000/api/docs/parse-corrected \
  -H "Content-Type: application/json" \
  -d @payload.json
```

其中 `payload.json` 为上面的 JSON 内容。返回示例:

```json
{
  "success": true,
  "questions": [ { "id": "q1", "content": "...", "sourceAnswer": "..." } ],
  "totalQuestions": 2,
  "saved": true,
  "message": "Parsed 2 questions from corrected text"
}
```

注意:
- 当 `saveToDb=true` 时，接口会把数据写入 `question_banks` 与 `questions`，并在 `data/question_banks/{paperId}_question_bank.json` 生成备份。
- 若写入失败会返回 500 并包含错误信息。

---

## 2) POST /api/banks/save

- 路径: `/api/banks/save`
- 方法: `POST`
- 描述: 保存或更新题库（同步写入 SQLite），会生成 JSON 备份文件。

- 请求体（JSON）示例：

```json
{
  "paperId": "sample_paper_2026_001",
  "title": "样例试卷 2026",
  "sourceTitle": "样例试卷 来源",
  "subject": "chinese",
  "version": "2026",
  "sourcePath": "data/docs/chinese/2026/样例.pdf",
  "sourceFormat": "pdf",
  "paperType": "mock",
  "knowledgePoints": [],
  "questions": [
    { "id": "q1", "type": "qa", "content": "问题一 内容", "sourceAnswer": "答案一" },
    { "id": "q2", "type": "choice", "content": "选择题 内容 A.B.C.D", "sourceAnswer": "A" }
  ]
}
```

- curl 示例：

```bash
curl -X POST http://localhost:3000/api/banks/save \
  -H "Content-Type: application/json" \
  -d @bank_payload.json
```

返回示例:

```json
{ "success": true, "message": "保存成功" }
```

实现细节与注意点：
- 后端会把写入操作封装为事务，先写入 `question_banks`，删除同一 `bank_id` 的旧题，再批量写 `questions`，最后生成 JSON 备份。
- 如果需要同时上传题目截图（资产），请先调用 `POST /api/banks/upload-asset` 上传文件，然后在题目或后续接口中把 `question_assets` 与题目 `db id` 关联起来。

---

如果你希望我把这些示例加入到 README 或前端调用示例中，我可以同步更新 `frontend` 的调用示例代码片段。
