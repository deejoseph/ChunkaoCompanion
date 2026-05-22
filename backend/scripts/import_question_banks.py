import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from init_knowledge_db import DB_PATH, PROJECT_ROOT, create_schema, stable_id, upsert_seed_rows


BANK_DIR = PROJECT_ROOT / "data" / "question_banks"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def normalize_title(title):
    value = re.sub(r"_question_bank\.json$", "", title, flags=re.IGNORECASE)
    value = re.sub(r"\.(pdf|docx)$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[（(](教师版|学生版|AI参考答案)[）)]", "", value)
    value = re.sub(r"[（(](复习讲义|上海专用)[）)]", "", value)
    value = re.sub(r"\s+", "", value)
    return value.strip()


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def find_topic(conn, subject, version, title):
    normalized = normalize_title(title)
    rows = conn.execute(
        "SELECT id, title FROM topics WHERE subject_id = ? AND (? IS NULL OR version_id = ?)",
        (subject, version, version),
    ).fetchall()

    best = None
    for row in rows:
        topic_title = normalize_title(row["title"])
        if topic_title == normalized or topic_title in normalized or normalized in topic_title:
            if best is None or len(topic_title) > len(normalize_title(best["title"])):
                best = row
    return best["id"] if best else None


def infer_question_type(question):
    qtype = question.get("type")
    if qtype:
        return qtype
    content = question.get("content", "")
    if re.search(r"[A-D][.．、)]", content):
        return "choice"
    if re.search(r"_{2,}|____|（\s*）|\(\s*\)", content):
        return "fill"
    return "qa"


def import_banks(conn):
    now = datetime.now().isoformat(timespec="seconds")
    stats = {"banks": 0, "questions": 0, "skipped": 0}

    if not BANK_DIR.exists():
        return stats

    for path in BANK_DIR.glob("*_question_bank.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            stats["skipped"] += 1
            continue

        subject = data.get("subject") or "unknown"
        version = str(data.get("version") or "") or None
        title = data.get("title") or path.stem.replace("_question_bank", "")
        paper_id = data.get("paperId") or path.stem.replace("_question_bank", "")
        questions = data.get("questions") or []
        topic_id = find_topic(conn, subject, version, title)
        bank_id = stable_id("bank", paper_id)

        conn.execute(
            """
            INSERT INTO question_banks(id, topic_id, subject_id, version_id, title, source_path, total_questions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                topic_id=excluded.topic_id,
                title=excluded.title,
                source_path=excluded.source_path,
                total_questions=excluded.total_questions,
                updated_at=excluded.updated_at
            """,
            (
                bank_id,
                topic_id,
                subject,
                version,
                title,
                str(path.relative_to(PROJECT_ROOT)),
                len(questions),
                now,
                now,
            ),
        )
        stats["banks"] += 1

        conn.execute("DELETE FROM questions WHERE bank_id = ?", (bank_id,))
        for index, question in enumerate(questions, start=1):
            content = str(question.get("content") or "").strip()
            if not content:
                continue
            question_id = stable_id("question", bank_id, question.get("id") or index)
            conn.execute(
                """
                INSERT INTO questions(
                    id, bank_id, topic_id, subject_id, version_id, number, original_number, type,
                    content, source_answer, final_answer, analysis, source, raw_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    question_id,
                    bank_id,
                    topic_id,
                    subject,
                    version,
                    int(question.get("number") or index),
                    str(question.get("originalNumber") or question.get("id") or index),
                    infer_question_type(question),
                    content,
                    str(question.get("sourceAnswer") or ""),
                    str(question.get("finalAnswer") or question.get("sourceAnswer") or ""),
                    str(question.get("analysis") or ""),
                    "question_bank_json",
                    json.dumps(question, ensure_ascii=False),
                    now,
                    now,
                ),
            )
            stats["questions"] += 1

    return stats


def summary(conn):
    return {
        "bank_count": conn.execute("SELECT COUNT(*) AS c FROM question_banks").fetchone()["c"],
        "question_count": conn.execute("SELECT COUNT(*) AS c FROM questions").fetchone()["c"],
        "by_subject": [
            dict(row)
            for row in conn.execute(
                """
                SELECT subject_id AS subject, COUNT(DISTINCT bank_id) AS banks, COUNT(*) AS questions
                FROM questions
                GROUP BY subject_id
                ORDER BY subject_id
                """
            )
        ],
    }


def main():
    conn = connect()
    try:
        create_schema(conn)
        upsert_seed_rows(conn)
        stats = import_banks(conn)
        conn.commit()
        print(json.dumps({"success": True, "import": stats, "summary": summary(conn)}, ensure_ascii=False, indent=2))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
