#!/usr/bin/env python3
"""
补全真题库缺失字段并生成/导入知识点映射。

步骤：
  1. final_answer / score 规则补全
  2. difficulty（可选 --force-difficulty 用 Ollama 重评）
  3. generate_kp_mapping_from_db → CSV
  4. import_kp_mapping_from_csv --all-exports
  5. link_question_knowledge（无 AI，补充未映射题）

用法：
  python backend/scripts/complete_exam_gaps.py --json
  python backend/scripts/complete_exam_gaps.py --skip-llm --json
  python backend/scripts/complete_exam_gaps.py --force-difficulty --json
"""

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "backend" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from enrich_exam_questions import audit_missing, connect, enrich_all
from generate_kp_mapping_from_db import EXPORT_DIR, generate_csv_for_subject
from import_kp_mapping_from_csv import DEFAULT_EXPORT_FILES, import_many, preview_exports
from link_question_knowledge import connect as link_connect, link_questions, summary

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_mapping_pipeline(min_confidence=0.05):
    generate_stats = {}
    for subject, path in {
        "chinese": EXPORT_DIR / "question_kp_chinese.csv",
        "math": EXPORT_DIR / "question_kp_math.csv",
        "english": EXPORT_DIR / "question_kp_english.csv",
    }.items():
        generate_csv_for_subject(subject, path)
        generate_stats[subject] = str(path)

    import_result = import_many(
        list(DEFAULT_EXPORT_FILES.values()),
        dry_run=False,
        reset=True,
        min_confidence=min_confidence,
    )

    conn = link_connect()
    try:
        link_stats = link_questions(conn, subject=None, reset=False, use_ai=False)
        conn.commit()
        db_summary = summary(conn)
    finally:
        conn.close()

    return {
        "generated": generate_stats,
        "import": import_result,
        "link_supplement": link_stats,
        "db_summary": db_summary,
        "exports_preview": preview_exports(),
    }


def main():
    parser = argparse.ArgumentParser(description="补全缺失字段并完成知识点映射")
    parser.add_argument("--subject", choices=["chinese", "math", "english"])
    parser.add_argument("--skip-llm", action="store_true")
    parser.add_argument("--force-difficulty", action="store_true")
    parser.add_argument("--skip-mapping", action="store_true")
    parser.add_argument("--min-confidence", type=float, default=0.05)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    conn = connect()
    enrich_stats = enrich_all(
        conn,
        subject_filter=args.subject,
        use_llm=not args.skip_llm,
        limit=args.limit,
        force_difficulty=args.force_difficulty,
    )
    conn.commit()
    conn.close()

    mapping_stats = None
    if not args.skip_mapping:
        mapping_stats = run_mapping_pipeline(min_confidence=args.min_confidence)

    conn = connect()
    audit = audit_missing(conn)
    conn.close()

    result = {
        "success": True,
        "enrich": enrich_stats,
        "mapping": mapping_stats,
        "audit": audit,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("补全完成")
        print("缺失:", audit)
        if mapping_stats:
            print("映射:", mapping_stats.get("db_summary"))


if __name__ == "__main__":
    main()
