#!/usr/bin/env python3
"""
一次性递归导入 data/exams 下三门学科所有 qwen*.json 真题到 SQLite。

目录结构：
  data/exams/chinese|math|english/<年度子目录>/qwen_*.json

用法：
  python backend/scripts/import_all_exam_banks.py
  python backend/scripts/import_all_exam_banks.py --dry-run
  python backend/scripts/import_all_exam_banks.py --subject math --json
"""

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from init_knowledge_db import DB_PATH, create_schema

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
EXAMS_ROOT = PROJECT_ROOT / "data" / "exams"
BANKS_DIR = PROJECT_ROOT / "data" / "question_banks"
SUBJECT_DIRS = ("chinese", "math", "english")
SUBJECT_NAMES = {
    "chinese": "语文",
    "math": "数学",
    "english": "英语",
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def stable_import_id(value, fallback="bank"):
    text = str(value or fallback).strip()
    text = re.sub(r"\.[a-z0-9]+$", "", text, flags=re.I)
    text = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", text)
    text = text.strip("_")[:120] or fallback
    return text


def infer_subject_from_text(value):
    text = str(value or "")
    if re.search(r"数学|math", text, re.I):
        return "math"
    if re.search(r"英语|english", text, re.I):
        return "english"
    if re.search(r"语文|chinese", text, re.I):
        return "chinese"
    return None


def infer_subject_from_path(json_path):
    parts = {part.lower() for part in Path(json_path).parts}
    for subject in SUBJECT_DIRS:
        if subject in parts:
            return subject
    return None


def sum_sub_scores(sub_questions):
    total = 0.0
    found = False
    for sub in sub_questions or []:
        score = sub.get("score", sub.get("points"))
        if score is not None:
            total += float(score)
            found = True
    return total if found else None


def normalize_shanghai_math_score(section_type, parent_id, question=None):
    question = question or {}
    numeric_id = int(parent_id) if str(parent_id).isdigit() else None
    sub_questions = question.get("sub_questions") or []

    if section_type == "fill_in_the_blank" and numeric_id is not None:
        return 4 if numeric_id <= 6 else 5
    if section_type == "multiple_choice":
        return 5
    if section_type == "essay" and numeric_id is not None:
        essay_scores = {17: 14, 18: 14, 19: 14, 20: 16, 21: 18}
        if numeric_id in essay_scores:
            return essay_scores[numeric_id]

    if question.get("total_score") is not None:
        return question.get("total_score")
    sub_score = sum_sub_scores(sub_questions)
    if sub_score is not None:
        return sub_score
    return question.get("score", question.get("points"))


def merge_math_parent_question(section_type, question):
    parent_id = question.get("id")
    sub_questions = question.get("sub_questions") or []
    content_parts = [question.get("content") or question.get("title") or ""]
    answer_parts = [question.get("answer") or question.get("source_answer") or ""]
    analysis_parts = [question.get("analysis") or question.get("explanation") or ""]

    for sub in sub_questions:
        part = sub.get("part")
        label = f"({part}) " if part else ""
        if sub.get("content"):
            content_parts.append(f"{label}{sub['content']}".strip())
        if sub.get("answer"):
            answer_parts.append(f"{label}{sub['answer']}".strip())
        if sub.get("analysis"):
            analysis_parts.append(f"{label}{sub['analysis']}".strip())

    return {
        "id": f"q{parent_id}",
        "originalNumber": parent_id,
        "type": "qa" if section_type == "essay" else section_type,
        "content": "\n".join(part for part in content_parts if part).strip(),
        "sourceAnswer": "\n".join(part for part in answer_parts if part).strip(),
        "finalAnswer": "",
        "analysis": "\n".join(part for part in analysis_parts if part).strip(),
        "score": normalize_shanghai_math_score(section_type, parent_id, question),
        "difficulty": question.get("difficulty") or "",
        "pageNumber": question.get("page_number", question.get("pageNumber")),
        "images": question.get("images") or [],
        "image": question.get("image") or question.get("image_path") or question.get("imagePath") or "",
        "knowledgePoints": question.get("knowledge_points") or question.get("knowledgePoints") or [],
    }


def flatten_section_questions(sections, subject):
    flattened = []
    global_number = 0
    keep_math_parent = subject == "math"

    for section in sections or []:
        section_type = section.get("type") or "qa"
        for question in section.get("questions") or []:
            parent_id = question.get("id") or (global_number + 1)
            sub_questions = question.get("sub_questions") or []

            if keep_math_parent or not sub_questions:
                global_number += 1
                if keep_math_parent and sub_questions:
                    item = merge_math_parent_question(section_type, question)
                else:
                    item = {
                        "id": f"q{parent_id}",
                        "originalNumber": parent_id,
                        "type": "qa" if section_type == "essay" else section_type,
                        "content": question.get("content") or question.get("title") or "",
                        "sourceAnswer": question.get("source_answer")
                        or question.get("sourceAnswer")
                        or question.get("answer")
                        or "",
                        "finalAnswer": "",
                        "analysis": question.get("analysis") or question.get("explanation") or "",
                        "score": question.get("score", question.get("points", question.get("total_score"))),
                        "difficulty": question.get("difficulty") or "",
                        "pageNumber": question.get("page_number", question.get("pageNumber")),
                        "images": question.get("images") or [],
                        "image": question.get("image") or question.get("image_path") or question.get("imagePath") or "",
                        "knowledgePoints": question.get("knowledge_points") or question.get("knowledgePoints") or [],
                    }
                item["number"] = global_number
                flattened.append(item)
                continue

            total_parent_score = question.get("total_score", question.get("score", question.get("points")))
            avg_score = None
            if total_parent_score and sub_questions:
                avg_score = float(total_parent_score) / len(sub_questions)

            for sub in sub_questions:
                global_number += 1
                part = sub.get("part")
                part_label = f"({part}) " if part else ""
                sub_score = sub.get("score", sub.get("points"))
                if sub_score is None and avg_score is not None:
                    sub_score = round(avg_score, 1)

                flattened.append(
                    {
                        "id": f"q{parent_id}_p{part or global_number}",
                        "number": global_number,
                        "originalNumber": f"{parent_id}.{part or global_number}",
                        "type": "qa" if section_type == "essay" else section_type,
                        "content": f"{part_label}{sub.get('content') or ''}".strip(),
                        "sourceAnswer": sub.get("answer") or "",
                        "finalAnswer": "",
                        "analysis": sub.get("analysis") or "",
                        "score": sub_score,
                        "difficulty": sub.get("difficulty") or "",
                        "pageNumber": sub.get("page_number", sub.get("pageNumber")),
                        "images": sub.get("images") or [],
                        "image": sub.get("image") or "",
                        "knowledgePoints": sub.get("knowledge_points") or sub.get("knowledgePoints") or [],
                    }
                )

    return flattened


def normalize_bank_payload(payload, json_path):
    data = payload or {}
    bank = data.get("bank") or data.get("questionBank") or data
    exam_info = bank.get("exam_info") or bank.get("examInfo") or {}
    year = exam_info.get("year") or bank.get("year")
    title = (
        bank.get("title")
        or bank.get("name")
        or bank.get("paperTitle")
        or exam_info.get("title")
        or json_path.stem
    )
    if year and not str(title).startswith(f"{year}年"):
        title = f"{year}年 {title}"

    subject = (
        bank.get("subject")
        or bank.get("subjectId")
        or bank.get("subject_id")
        or exam_info.get("subject")
        or infer_subject_from_path(json_path)
        or infer_subject_from_text(f"{title} {exam_info.get('location', '')}")
    )

    paper_id = stable_import_id(
        bank.get("paperId")
        or bank.get("id")
        or bank.get("bankId")
        or (f"{subject}_{year}_{title}" if year and subject else title),
        "json_bank",
    )

    if isinstance(bank.get("questions"), list):
        raw_questions = bank["questions"]
    elif isinstance(bank.get("items"), list):
        raw_questions = bank["items"]
    elif isinstance(bank.get("sections"), list):
        raw_questions = flatten_section_questions(bank["sections"], subject)
    else:
        raw_questions = []

    questions = []
    for index, q in enumerate(raw_questions):
        questions.append(
            {
                "id": q.get("id") or q.get("questionId") or q.get("question_id") or f"q{index + 1}",
                "number": q.get("number") or q.get("no") or index + 1,
                "originalNumber": q.get("originalNumber")
                or q.get("original_number")
                or q.get("no")
                or q.get("number")
                or f"q{index + 1}",
                "type": q.get("type") or q.get("questionType") or q.get("question_type") or "qa",
                "content": q.get("content") or q.get("question") or q.get("stem") or q.get("title") or "",
                "sourceAnswer": q.get("sourceAnswer")
                or q.get("source_answer")
                or q.get("answer")
                or "",
                "finalAnswer": q.get("finalAnswer") or q.get("final_answer") or "",
                "myAnswer": q.get("myAnswer") or q.get("my_answer") or "",
                "peerAnswers": q.get("peerAnswers") or q.get("peer_answers") or {},
                "aiAnswers": q.get("aiAnswers") or q.get("ai_answers") or {},
                "discussion": q.get("discussion") or "",
                "analysis": q.get("analysis") or q.get("explanation") or "",
                "score": q.get("score", q.get("points", q.get("point"))),
                "difficulty": q.get("difficulty") or "",
                "pageNumber": q.get("pageNumber", q.get("page_number")),
                "image": q.get("image") or q.get("imagePath") or q.get("image_path") or "",
                "images": q.get("images") or [],
                "knowledgePoints": q.get("knowledgePoints") or q.get("knowledge_points") or [],
            }
        )

    relative_source = str(json_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
    return {
        "paperId": paper_id,
        "title": title,
        "sourceTitle": bank.get("sourceTitle") or bank.get("source_title") or title,
        "subject": subject,
        "version": bank.get("version") or bank.get("versionId") or bank.get("version_id") or "2026",
        "sourcePath": bank.get("sourcePath") or bank.get("source_path") or relative_source,
        "sourceFormat": bank.get("sourceFormat") or bank.get("source_format") or "json",
        "paperType": bank.get("paperType") or bank.get("paper_type") or "exam",
        "year": year,
        "knowledgePoints": bank.get("knowledgePoints") or bank.get("knowledge_points") or [],
        "totalQuestions": len(questions),
        "questions": questions,
    }


def ensure_subjects(conn):
    for subject_id, name in SUBJECT_NAMES.items():
        conn.execute(
            "INSERT OR IGNORE INTO subjects(id, name) VALUES (?, ?)",
            (subject_id, name),
        )


def save_bank(conn, bank, write_json_backup=True):
    now = datetime.now().isoformat(timespec="seconds")
    paper_id = bank["paperId"]
    questions = bank["questions"]

    conn.execute(
        """
        INSERT OR REPLACE INTO question_banks
        (id, title, source_title, subject_id, version_id, source_path, source_format,
         paper_type, year, total_questions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            paper_id,
            bank["title"],
            bank["sourceTitle"],
            bank["subject"],
            bank["version"],
            bank["sourcePath"],
            bank["sourceFormat"],
            bank["paperType"],
            bank["year"],
            bank["totalQuestions"],
            now,
            now,
        ),
    )

    conn.execute(
        """
        DELETE FROM question_assets
        WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)
        """,
        (paper_id,),
    )
    conn.execute(
        """
        DELETE FROM question_knowledge_points
        WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)
        """,
        (paper_id,),
    )
    conn.execute("DELETE FROM questions WHERE bank_id = ?", (paper_id,))

    for index, q in enumerate(questions):
        q_id = str(q.get("id") or f"q{index + 1}")
        number = q.get("number") or index + 1
        db_question_id = f"{paper_id}_{q_id}"

        conn.execute(
            """
            INSERT OR REPLACE INTO questions
            (id, bank_id, subject_id, version_id, number, original_number, type, content,
             source_answer, final_answer, my_answer, peer_answers, ai_answers, discussion,
             analysis, score, difficulty, page_number, raw_json, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                db_question_id,
                paper_id,
                bank["subject"],
                bank["version"],
                number,
                q.get("originalNumber"),
                q.get("type") or "qa",
                q.get("content") or "",
                q.get("sourceAnswer") or "",
                q.get("finalAnswer") or q.get("sourceAnswer") or "",
                q.get("myAnswer") or "",
                json.dumps(q.get("peerAnswers") or {}, ensure_ascii=False),
                json.dumps(q.get("aiAnswers") or {}, ensure_ascii=False),
                q.get("discussion") or "",
                q.get("analysis") or "",
                q.get("score"),
                q.get("difficulty") or "",
                q.get("pageNumber"),
                json.dumps(q, ensure_ascii=False),
                "exam-import",
                now,
                now,
            ),
        )

        images = []
        images.extend(q.get("images") or [])
        if q.get("image"):
            images.append(q["image"])
        for image_index, image in enumerate(images, start=1):
            image_path = image if isinstance(image, str) else (image.get("filePath") or image.get("path") or image.get("url") or "")
            if not image_path:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO question_assets
                (id, question_id, asset_type, file_path, page_number, bbox_json, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{db_question_id}_image_{image_index}",
                    db_question_id,
                    image.get("assetType") or image.get("type") or "image" if isinstance(image, dict) else "image",
                    image_path,
                    image.get("pageNumber") or image.get("page_number") if isinstance(image, dict) else None,
                    json.dumps(image.get("bbox"), ensure_ascii=False) if isinstance(image, dict) and image.get("bbox") else None,
                    image.get("description") or "" if isinstance(image, dict) else "",
                    now,
                ),
            )

        for name in q.get("knowledgePoints") or []:
            kp_name = name if isinstance(name, str) else (name.get("name") or name.get("title") or name.get("knowledgePoint") or "")
            kp_name = str(kp_name).strip()
            if not kp_name:
                continue
            kp_row = conn.execute(
                "SELECT id FROM knowledge_points WHERE subject_id = ? AND name = ?",
                (bank["subject"], kp_name),
            ).fetchone()
            if not kp_row:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO question_knowledge_points
                (question_id, knowledge_point_id, confidence, source, note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (db_question_id, kp_row["id"], 0.95, "json-import", "真题 JSON 导入", now, now),
            )

    json_path = None
    if write_json_backup:
        BANKS_DIR.mkdir(parents=True, exist_ok=True)
        backup = {
            "paperId": paper_id,
            "title": bank["title"],
            "sourceTitle": bank["sourceTitle"],
            "subject": bank["subject"],
            "version": bank["version"],
            "sourcePath": bank["sourcePath"],
            "sourceFormat": bank["sourceFormat"],
            "paperType": bank["paperType"],
            "year": bank["year"],
            "knowledgePoints": bank["knowledgePoints"],
            "totalQuestions": len(questions),
            "questions": [
                {
                    **q,
                    "id": str(q.get("id") or f"q{idx + 1}"),
                    "number": q.get("number") or idx + 1,
                }
                for idx, q in enumerate(questions)
            ],
        }
        json_path = BANKS_DIR / f"{paper_id}_question_bank.json"
        json_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "paperId": paper_id,
        "title": bank["title"],
        "subject": bank["subject"],
        "year": bank["year"],
        "totalQuestions": len(questions),
        "jsonPath": str(json_path.relative_to(PROJECT_ROOT)).replace("\\", "/") if json_path else None,
    }


def find_qwen_json_files(subject_filter=None, source_dir=None):
    files = []
    if source_dir:
        source_path = Path(source_dir)
        if source_path.exists():
            if source_path.is_dir():
                files.extend(source_path.rglob("qwen*.json"))
            elif source_path.is_file() and source_path.name.lower().endswith('.json'):
                files.append(source_path)
    else:
        for subject in SUBJECT_DIRS:
            if subject_filter and subject != subject_filter:
                continue
            subject_dir = EXAMS_ROOT / subject
            if not subject_dir.exists():
                continue
            files.extend(subject_dir.rglob("qwen*.json"))

    def sort_key(path):
        subject = infer_subject_from_path(path) or ""
        match = re.search(r"qwen[_-]?(\d{4})", path.stem, re.I)
        year = int(match.group(1)) if match else 0
        return (subject, year, str(path).lower())

    return sorted(set(files), key=sort_key)


def import_file(conn, json_path, dry_run=False, write_json_backup=True):
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    bank = normalize_bank_payload(payload, json_path)
    if not bank["title"] or not bank["questions"]:
        raise ValueError("缺少 title 或 questions/sections")

    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "file": str(json_path),
            **{k: bank[k] for k in ("paperId", "title", "subject", "year", "totalQuestions")},
        }

    result = save_bank(conn, bank, write_json_backup=write_json_backup)
    result["success"] = True
    result["file"] = str(json_path)
    return result


def summarize_db(conn):
    banks = conn.execute("SELECT COUNT(*) AS c FROM question_banks").fetchone()["c"]
    questions = conn.execute("SELECT COUNT(*) AS c FROM questions").fetchone()["c"]
    by_subject = conn.execute(
        """
        SELECT subject_id, COUNT(*) AS c
        FROM questions
        GROUP BY subject_id
        ORDER BY subject_id
        """
    ).fetchall()
    return {
        "question_banks": banks,
        "questions": questions,
        "by_subject": {row["subject_id"]: row["c"] for row in by_subject},
    }


def main():
    parser = argparse.ArgumentParser(description="递归导入 data/exams 下所有 qwen*.json 真题")
    parser.add_argument("--subject", choices=SUBJECT_DIRS, help="仅导入指定学科")
    parser.add_argument("--dry-run", action="store_true", help="仅解析统计，不写入数据库")
    parser.add_argument("--no-json-backup", action="store_true", help="不写入 data/question_banks JSON 备份")
    parser.add_argument("--skip-enrich", action="store_true", help="导入后跳过字段补全")
    parser.add_argument("--enrich-only", action="store_true", help="仅补全已有题目字段，不重新导入")
    parser.add_argument("--skip-llm", action="store_true", help="补全时不调用 Ollama 评估 difficulty")
    parser.add_argument("--source-dir", help="从指定目录查找 qwen*.json 文件")
    parser.add_argument("--json-file", action="append", help="指定一个要导入的 JSON 文件路径，可重复传递")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出结果")
    args = parser.parse_args()

    if args.enrich_only:
        from enrich_exam_questions import enrich_all, audit_missing

        conn = connect()
        enrich_stats = enrich_all(
            conn,
            subject_filter=args.subject,
            use_llm=not args.skip_llm,
        )
        conn.commit()
        result = {
            "success": True,
            "mode": "enrich-only",
            "enrich": enrich_stats,
            "audit": audit_missing(conn),
            "db": summarize_db(conn),
        }
        conn.close()
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("字段补全完成。", result["audit"])
        sys.exit(0)

    if args.json_file:
        files = [Path(p) for p in args.json_file if p]
    else:
        files = find_qwen_json_files(args.subject, args.source_dir)
    if not files:
        source_hint = args.source_dir or EXAMS_ROOT
        result = {"success": False, "error": f"未找到 qwen*.json 文件: {source_hint}"}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(1)

    conn = None
    if not args.dry_run:
        conn = connect()
        create_schema(conn)
        ensure_subjects(conn)

    imported = []
    failed = []

    for json_path in files:
        try:
            item = import_file(
                conn,
                json_path,
                dry_run=args.dry_run,
                write_json_backup=not args.no_json_backup,
            )
            imported.append(item)
            if not args.json:
                print(
                    f"✅ {json_path.relative_to(PROJECT_ROOT)} -> "
                    f"{item['title']} ({item['totalQuestions']} 题)"
                )
        except Exception as exc:
            failed.append({"file": str(json_path), "error": str(exc)})
            if not args.json:
                print(f"❌ {json_path.relative_to(PROJECT_ROOT)} -> {exc}")

    if conn and not args.dry_run:
        conn.commit()
        enrich_stats = None
        if not args.skip_enrich:
            from enrich_exam_questions import enrich_all, audit_missing

            enrich_stats = enrich_all(
                conn,
                subject_filter=args.subject,
                use_llm=not args.skip_llm,
            )
            conn.commit()
            audit = audit_missing(conn)
        else:
            audit = None
        db_summary = summarize_db(conn)
        conn.close()
    else:
        db_summary = None
        enrich_stats = None
        audit = None

    result = {
        "success": len(failed) == 0,
        "scanned": len(files),
        "imported": len(imported),
        "failed": len(failed),
        "files": imported,
        "errors": failed,
        "enrich": enrich_stats,
        "audit": audit,
        "db": db_summary,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif db_summary:
        print(
            f"\n完成：扫描 {len(files)} 个文件，成功 {len(imported)}，失败 {len(failed)}。"
            f" 数据库现有 {db_summary['questions']} 道题。"
        )

    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
