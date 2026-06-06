#!/usr/bin/env python3
"""
从 CSV 导入题目-知识点映射，写入 question_knowledge_points 表。

支持的 CSV 列（任选其一）：
  - question_id + knowledge_point_id + confidence + source
  - question_id + user_confirmed_kp_ids（逗号分隔多个知识点 ID）

用法：
  python backend/scripts/import_kp_mapping_from_csv.py --csv data/exports/question_kp_math.csv
  python backend/scripts/import_kp_mapping_from_csv.py --all-exports --reset
  python backend/scripts/import_kp_mapping_from_csv.py --csv path/to/file.csv --dry-run --json
"""

import argparse
import csv
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from init_knowledge_db import DB_PATH, create_schema

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
DEFAULT_EXPORT_FILES = {
    "chinese": EXPORT_DIR / "question_kp_chinese.csv",
    "math": EXPORT_DIR / "question_kp_math.csv",
    "english": EXPORT_DIR / "question_kp_english.csv",
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def subject_from_path(csv_path):
    name = Path(csv_path).stem.lower()
    for subject in ("chinese", "math", "english"):
        if subject in name:
            return subject
    return None


def parse_confidence(value, default=0.8):
    try:
        parsed = float(value)
        if parsed > 1:
            parsed = parsed / 100.0
        return max(0.0, min(1.0, parsed))
    except (TypeError, ValueError):
        return default


def parse_row_links(row):
    question_id = (row.get("question_id") or "").strip()
    if not question_id:
        return []

    source = (row.get("source") or "csv").strip() or "csv"
    confidence = parse_confidence(row.get("confidence"), 0.8)

    confirmed = (row.get("user_confirmed_kp_ids") or row.get("knowledge_point_ids") or "").strip()
    if confirmed:
        kp_ids = [item.strip() for item in confirmed.split(",") if item.strip()]
        return [(question_id, kp_id, confidence, source) for kp_id in kp_ids]

    kp_id = (row.get("knowledge_point_id") or "").strip()
    if kp_id:
        return [(question_id, kp_id, confidence, source)]

    return []


def preview_csv(csv_path):
    path = Path(csv_path)
    if not path.exists():
        return {
            "path": str(path),
            "exists": False,
            "subject": subject_from_path(path),
            "row_count": 0,
            "link_count": 0,
            "question_count": 0,
        }

    row_count = 0
    link_count = 0
    question_ids = set()
    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            row_count += 1
            links = parse_row_links(row)
            link_count += len(links)
            for question_id, _, _, _ in links:
                question_ids.add(question_id)

    stat = path.stat()
    return {
        "path": str(path),
        "exists": True,
        "subject": subject_from_path(path),
        "row_count": row_count,
        "link_count": link_count,
        "question_count": len(question_ids),
        "size_bytes": stat.st_size,
        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def reset_subject_mappings(conn, subject):
    if not subject:
        conn.execute("DELETE FROM question_knowledge_points")
        return
    conn.execute(
        """
        DELETE FROM question_knowledge_points
        WHERE question_id IN (SELECT id FROM questions WHERE subject_id = ?)
        """,
        (subject,),
    )


def upsert_link(conn, question_id, knowledge_point_id, confidence, source, note, now):
    conn.execute(
        """
        INSERT INTO question_knowledge_points(
            question_id, knowledge_point_id, confidence, source, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(question_id, knowledge_point_id) DO UPDATE SET
            confidence = excluded.confidence,
            source = excluded.source,
            note = excluded.note,
            updated_at = excluded.updated_at
        """,
        (question_id, knowledge_point_id, confidence, source, note, now, now),
    )


def ensure_schema(conn):
    create_schema(conn)


def import_csv(csv_path, dry_run=False, reset=False, subject=None, min_confidence=0.0):
    conn = connect()
    ensure_schema(conn)
    now = datetime.now().isoformat(timespec="seconds")
    inferred_subject = subject or subject_from_path(csv_path)

    stats = {
        "success": True,
        "csv": str(csv_path),
        "subject": inferred_subject,
        "dry_run": dry_run,
        "reset": reset,
        "rows_read": 0,
        "links_parsed": 0,
        "links_inserted": 0,
        "questions_touched": 0,
        "skipped_missing_question": 0,
        "skipped_missing_knowledge_point": 0,
        "skipped_low_confidence": 0,
        "warnings": [],
    }

    path = Path(csv_path)
    if not path.exists():
        stats["success"] = False
        stats["error"] = f"CSV 文件不存在: {path}"
        conn.close()
        return stats

    question_ids_touched = set()
    pending_links = []

    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            stats["rows_read"] += 1
            for question_id, kp_id, confidence, source in parse_row_links(row):
                stats["links_parsed"] += 1
                if confidence < min_confidence:
                    stats["skipped_low_confidence"] += 1
                    continue
                pending_links.append((question_id, kp_id, confidence, source))

    if reset and not dry_run:
        reset_subject_mappings(conn, inferred_subject)

    for question_id, kp_id, confidence, source in pending_links:
        question_row = conn.execute(
            "SELECT id FROM questions WHERE id = ?",
            (question_id,),
        ).fetchone()
        if not question_row:
            stats["skipped_missing_question"] += 1
            if len(stats["warnings"]) < 20:
                stats["warnings"].append(f"题目不存在，已跳过: {question_id}")
            continue

        kp_row = conn.execute(
            "SELECT id FROM knowledge_points WHERE id = ?",
            (kp_id,),
        ).fetchone()
        if not kp_row:
            stats["skipped_missing_knowledge_point"] += 1
            if len(stats["warnings"]) < 20:
                stats["warnings"].append(f"知识点不存在，已跳过: {kp_id}")
            continue

        if not dry_run:
            upsert_link(conn, question_id, kp_id, confidence, source, "", now)
        stats["links_inserted"] += 1
        question_ids_touched.add(question_id)

    stats["questions_touched"] = len(question_ids_touched)

    if not dry_run:
        conn.commit()
    conn.close()
    return stats


def import_many(csv_paths, dry_run=False, reset=False, subject=None, min_confidence=0.0):
    if reset and not dry_run:
        conn = connect()
        ensure_schema(conn)
        if subject:
            reset_subject_mappings(conn, subject)
        elif len(csv_paths) == 1:
            reset_subject_mappings(conn, subject_from_path(csv_paths[0]))
        else:
            reset_subject_mappings(conn, None)
        conn.commit()
        conn.close()

    results = []
    for csv_path in csv_paths:
        results.append(
            import_csv(
                csv_path,
                dry_run=dry_run,
                reset=False,
                subject=subject or subject_from_path(csv_path),
                min_confidence=min_confidence,
            )
        )
        if reset:
            results[-1]["reset"] = True

    linked_questions = conn_count_linked_questions() if not dry_run else None
    return {
        "success": all(item.get("success", False) for item in results),
        "files": results,
        "summary": {
            "files": len(results),
            "links_inserted": sum(item.get("links_inserted", 0) for item in results),
            "questions_touched": sum(item.get("questions_touched", 0) for item in results),
            "skipped_missing_question": sum(item.get("skipped_missing_question", 0) for item in results),
            "skipped_missing_knowledge_point": sum(item.get("skipped_missing_knowledge_point", 0) for item in results),
            "linked_questions_in_db": linked_questions,
        },
    }


def conn_count_linked_questions():
    conn = connect()
    row = conn.execute(
        "SELECT COUNT(DISTINCT question_id) AS c FROM question_knowledge_points"
    ).fetchone()
    total = conn.execute("SELECT COUNT(*) AS c FROM question_knowledge_points").fetchone()
    conn.close()
    return {
        "distinct_questions": row["c"] if row else 0,
        "total_links": total["c"] if total else 0,
    }


def preview_exports():
    conn = connect()
    db_questions = conn.execute("SELECT COUNT(*) AS c FROM questions").fetchone()["c"]
    conn.close()
    files = [preview_csv(path) for path in DEFAULT_EXPORT_FILES.values()]
    return {
        "success": True,
        "export_dir": str(EXPORT_DIR),
        "files": files,
        "db_links": conn_count_linked_questions(),
        "db_questions": db_questions,
    }


def main():
    parser = argparse.ArgumentParser(description="导入题目-知识点映射 CSV")
    parser.add_argument("--csv", help="单个 CSV 文件路径")
    parser.add_argument("--all-exports", action="store_true", help="导入 data/exports 下三门学科默认 CSV")
    parser.add_argument("--preview-exports", action="store_true", help="预览 exports 目录中的 CSV 状态")
    parser.add_argument("--subject", choices=["chinese", "math", "english"], help="仅导入指定学科默认 CSV")
    parser.add_argument("--reset", action="store_true", help="导入前清空对应学科的已有映射")
    parser.add_argument("--dry-run", action="store_true", help="仅校验，不写入数据库")
    parser.add_argument("--min-confidence", type=float, default=0.0, help="忽略低于该置信度的映射")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出结果")
    args = parser.parse_args()

    if args.preview_exports:
        result = preview_exports()
    elif args.all_exports or args.subject:
        csv_paths = []
        if args.subject:
            csv_paths = [DEFAULT_EXPORT_FILES[args.subject]]
        else:
            csv_paths = list(DEFAULT_EXPORT_FILES.values())
        result = import_many(
            csv_paths,
            dry_run=args.dry_run,
            reset=args.reset,
            subject=args.subject,
            min_confidence=args.min_confidence,
        )
    elif args.csv:
        result = import_csv(
            args.csv,
            dry_run=args.dry_run,
            reset=args.reset,
            subject=args.subject,
            min_confidence=args.min_confidence,
        )
    else:
        parser.error("请指定 --csv、--all-exports、--subject 或 --preview-exports")

    if args.json or args.preview_exports or args.all_exports or args.subject:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(
            f"导入完成：写入 {result.get('links_inserted', 0)} 条关联，"
            f"覆盖 {result.get('questions_touched', 0)} 道题"
        )
        if result.get("skipped_missing_question"):
            print(f"跳过无效题目: {result['skipped_missing_question']}")
        if result.get("skipped_missing_knowledge_point"):
            print(f"跳过无效知识点: {result['skipped_missing_knowledge_point']}")
        if args.dry_run:
            print("试运行模式，未实际写入数据库")


if __name__ == "__main__":
    main()
