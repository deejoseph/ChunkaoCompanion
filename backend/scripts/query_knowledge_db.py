import argparse
import json
import sqlite3
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def summary(conn):
    return {
        "db_path": str(DB_PATH),
        "topic_count": conn.execute("SELECT COUNT(*) AS c FROM topics").fetchone()["c"],
        "knowledge_point_count": conn.execute("SELECT COUNT(*) AS c FROM knowledge_points").fetchone()["c"],
        "source_file_count": conn.execute("SELECT COUNT(*) AS c FROM source_files").fetchone()["c"],
        "by_subject": rows(
            conn.execute(
                """
                SELECT s.id AS subject, s.name, COUNT(DISTINCT t.id) AS topics, COUNT(DISTINCT kp.id) AS knowledge_points
                FROM subjects s
                LEFT JOIN topics t ON t.subject_id = s.id
                LEFT JOIN knowledge_points kp ON kp.subject_id = s.id
                GROUP BY s.id, s.name
                ORDER BY s.id
                """
            )
        ),
    }


def topics(conn, subject=None, version=None):
    params = []
    where = []
    if subject:
        where.append("t.subject_id = ?")
        params.append(subject)
    if version:
        where.append("t.version_id = ?")
        params.append(version)
    where_sql = "WHERE " + " AND ".join(where) if where else ""

    topic_rows = rows(
        conn.execute(
            f"""
            SELECT t.*, s.name AS subject_name
            FROM topics t
            JOIN subjects s ON s.id = t.subject_id
            {where_sql}
            ORDER BY t.subject_id, t.version_id, t.code, t.title
            """,
            params,
        )
    )

    for topic in topic_rows:
        topic["knowledge_points"] = rows(
            conn.execute(
                """
                SELECT kp.id, kp.name, kp.category, tkp.confidence, tkp.source
                FROM topic_knowledge_points tkp
                JOIN knowledge_points kp ON kp.id = tkp.knowledge_point_id
                WHERE tkp.topic_id = ?
                ORDER BY kp.name
                """,
                (topic["id"],),
            )
        )

    return topic_rows


def knowledge_points(conn, subject=None):
    params = []
    where = ""
    if subject:
        where = "WHERE kp.subject_id = ?"
        params.append(subject)
    return rows(
        conn.execute(
            f"""
            SELECT kp.*, COUNT(tkp.topic_id) AS topic_count
            FROM knowledge_points kp
            LEFT JOIN topic_knowledge_points tkp ON tkp.knowledge_point_id = kp.id
            {where}
            GROUP BY kp.id
            ORDER BY kp.subject_id, kp.category, kp.name
            """,
            params,
        )
    )


def banks(conn, subject=None, version=None, limit=200):
    params = []
    where = []
    if subject:
        where.append("qb.subject_id = ?")
        params.append(subject)
    if version:
        where.append("qb.version_id = ?")
        params.append(version)
    where_sql = "WHERE " + " AND ".join(where) if where else ""
    params.append(limit)

    return rows(
        conn.execute(
            f"""
            SELECT qb.id, qb.topic_id, t.title AS topic_title, qb.subject_id, qb.version_id,
                   qb.title, qb.source_title, qb.source_path, qb.source_format, qb.paper_type,
                   qb.year, qb.total_questions, qb.updated_at,
                   COUNT(DISTINCT q.id) AS question_count,
                   COUNT(DISTINCT qkp.question_id) AS linked_question_count
            FROM question_banks qb
            LEFT JOIN topics t ON t.id = qb.topic_id
            LEFT JOIN questions q ON q.bank_id = qb.id
            LEFT JOIN question_knowledge_points qkp ON qkp.question_id = q.id
            {where_sql}
            GROUP BY qb.id
            ORDER BY qb.subject_id, qb.year, qb.title
            LIMIT ?
            """,
            params,
        )
    )


def questions(conn, subject=None, bank_id=None, limit=100):
    params = []
    where = []
    if subject:
        where.append("q.subject_id = ?")
        params.append(subject)
    if bank_id:
        where.append("q.bank_id = ?")
        params.append(bank_id)
    where_sql = "WHERE " + " AND ".join(where) if where else ""
    params.append(limit)

    question_rows = rows(
        conn.execute(
            f"""
            SELECT q.id, q.bank_id, qb.title AS bank_title, q.topic_id, q.subject_id, q.version_id,
                   q.number, q.original_number, q.type, q.content, q.source_answer,
                   q.final_answer, q.analysis, q.score, q.difficulty, q.page_number,
                   q.parse_confidence, q.needs_review, q.source
            FROM questions q
            JOIN question_banks qb ON qb.id = q.bank_id
            {where_sql}
            ORDER BY q.subject_id, qb.title, q.number
            LIMIT ?
            """,
            params,
        )
    )

    for question in question_rows:
        question["knowledge_points"] = rows(
            conn.execute(
                """
                SELECT kp.id, kp.name, kp.category, qkp.confidence, qkp.source, qkp.note
                FROM question_knowledge_points qkp
                JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
                WHERE qkp.question_id = ?
                ORDER BY qkp.confidence DESC, kp.name
                """,
                (question["id"],),
            )
        )
        question["assets"] = rows(
            conn.execute(
                """
                SELECT id, asset_type, file_path, page_number, bbox_json, description
                FROM question_assets
                WHERE question_id = ?
                ORDER BY page_number, asset_type
                """,
                (question["id"],),
            )
        )

    return question_rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["summary", "topics", "knowledge-points", "banks", "questions"])
    parser.add_argument("--subject")
    parser.add_argument("--version")
    parser.add_argument("--bank-id")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(json.dumps({"success": False, "error": f"database not found: {DB_PATH}"}, ensure_ascii=False))
        return

    conn = connect()
    try:
        if args.command == "summary":
            data = summary(conn)
        elif args.command == "topics":
            data = topics(conn, args.subject, args.version)
        elif args.command == "banks":
            data = banks(conn, args.subject, args.version, args.limit)
        elif args.command == "questions":
            data = questions(conn, args.subject, args.bank_id, args.limit)
        else:
            data = knowledge_points(conn, args.subject)
        print(json.dumps({"success": True, "data": data}, ensure_ascii=False))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
