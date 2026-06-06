#!/usr/bin/env python3
"""
补全真题库题目字段：final_answer、score、difficulty。

- final_answer：优先 raw_json / source_answer 中的 answer
- score：优先 raw_json 中的 score；缺失时按同级大题或整卷剩余分值分配
- difficulty：调用本地 Ollama 评估（1-10）

用法：
  python backend/scripts/enrich_exam_questions.py
  python backend/scripts/enrich_exam_questions.py --subject math --json
  python backend/scripts/enrich_exam_questions.py --skip-llm
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

from import_all_exam_banks import normalize_shanghai_math_score, PROJECT_ROOT
from init_knowledge_db import DB_PATH
from ollama_models import SUBJECT_MODELS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

OLLAMA_URL = "http://localhost:11434/api/generate"
EXAMS_ROOT = PROJECT_ROOT / "data" / "exams"

DEFAULT_BANK_TOTAL = {
    "chinese": 150,
    "math": 150,
    "english": 150,
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def parse_raw_json(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except Exception:
        return {}


def extract_answer(raw, row):
    for key in ("sourceAnswer", "source_answer", "answer", "finalAnswer", "final_answer"):
        value = raw.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    source = row["source_answer"] if row else ""
    return str(source or "").strip()


def extract_score(raw, row):
    for key in ("score", "points", "point", "total_score"):
        value = raw.get(key)
        if value is not None and value != "":
            try:
                return float(value)
            except (TypeError, ValueError):
                pass
    if row and row["score"] is not None:
        return float(row["score"])
    return None


def parent_key(original_number):
    text = str(original_number or "").strip()
    if not text:
        return None
    if "." in text:
        return text.split(".", 1)[0]
    match = re.match(r"^(\d+)", text)
    return match.group(1) if match else text


def math_score_from_question_id(question_id, question_type):
    match = re.search(r"_q(\d+)(?:_|$)", question_id or "")
    if not match:
        return None
    parent_id = int(match.group(1))
    section_type = question_type or "qa"
    if section_type in ("fill_in_the_blank", "fill"):
        section_type = "fill_in_the_blank"
    elif section_type in ("multiple_choice", "choice"):
        section_type = "multiple_choice"
    elif section_type in ("essay", "qa"):
        section_type = "essay"
    return normalize_shanghai_math_score(section_type, parent_id, {})


def load_bank_total_from_source(source_path):
    if not source_path:
        return None
    path = PROJECT_ROOT / str(source_path).replace("\\", "/")
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        bank = payload.get("bank") or payload.get("questionBank") or payload
        exam_info = bank.get("exam_info") or bank.get("examInfo") or {}
        total = exam_info.get("total_score") or bank.get("total_score")
        return float(total) if total is not None else None
    except Exception:
        return None


def fill_final_answers(conn):
    updated = 0
    rows = conn.execute(
        """
        SELECT id, source_answer, final_answer, raw_json
        FROM questions
        WHERE final_answer IS NULL OR TRIM(final_answer) = ''
        """
    ).fetchall()
    now = datetime.now().isoformat(timespec="seconds")
    for row in rows:
        raw = parse_raw_json(row["raw_json"])
        answer = extract_answer(raw, row)
        if not answer:
            continue
        conn.execute(
            "UPDATE questions SET final_answer = ?, updated_at = ? WHERE id = ?",
            (answer, now, row["id"]),
        )
        updated += 1
    return updated


def fill_scores(conn):
    updated = 0
    now = datetime.now().isoformat(timespec="seconds")
    banks = conn.execute(
        """
        SELECT id, subject_id, source_path
        FROM question_banks
        ORDER BY subject_id, year
        """
    ).fetchall()

    for bank in banks:
        bank_id = bank["id"]
        subject = bank["subject_id"]
        rows = conn.execute(
            """
            SELECT id, number, original_number, type, score, raw_json
            FROM questions
            WHERE bank_id = ?
            ORDER BY number ASC
            """,
            (bank_id,),
        ).fetchall()
        if not rows:
            continue

        bank_total = load_bank_total_from_source(bank["source_path"])
        if bank_total is None:
            bank_total = DEFAULT_BANK_TOTAL.get(subject, 150)

        # 1) 从 raw_json / 数学规则补分
        for row in rows:
            if row["score"] is not None:
                continue
            raw = parse_raw_json(row["raw_json"])
            score = extract_score(raw, row)
            if score is None and subject == "math":
                score = math_score_from_question_id(row["id"], row["type"])
            if score is not None:
                conn.execute(
                    "UPDATE questions SET score = ?, updated_at = ? WHERE id = ?",
                    (score, now, row["id"]),
                )
                updated += 1

        rows = conn.execute(
            """
            SELECT id, original_number, score
            FROM questions
            WHERE bank_id = ?
            ORDER BY number ASC
            """,
            (bank_id,),
        ).fetchall()

        # 2) 同一大题下的小题：用已赋分值的小题均值补全
        parent_groups = {}
        for row in rows:
            parent_groups.setdefault(parent_key(row["original_number"]), []).append(row)

        for group in parent_groups.values():
            missing = [row for row in group if row["score"] is None]
            known = [row for row in group if row["score"] is not None]
            if not missing or not known:
                continue
            avg_score = round(sum(float(item["score"]) for item in known) / len(known), 2)
            for item in missing:
                conn.execute(
                    "UPDATE questions SET score = ?, updated_at = ? WHERE id = ?",
                    (avg_score, now, item["id"]),
                )
                updated += 1

        rows = conn.execute(
            "SELECT id, score FROM questions WHERE bank_id = ?",
            (bank_id,),
        ).fetchall()
        missing = [row for row in rows if row["score"] is None]
        if not missing:
            continue

        known_sum = sum(float(row["score"]) for row in rows if row["score"] is not None)
        remaining = max(float(bank_total) - known_sum, 0)
        per = round(remaining / len(missing), 2) if remaining > 0 else round(float(bank_total) / len(rows), 2)
        for item in missing:
            conn.execute(
                "UPDATE questions SET score = ?, updated_at = ? WHERE id = ?",
                (per, now, item["id"]),
            )
            updated += 1

    return updated


def call_ollama(prompt, model, timeout=90):
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.1,
                "format": "json",
            },
            timeout=timeout,
        )
        if resp.status_code == 404:
            print(f"  [Ollama] 模型不存在: {model}", flush=True)
            return None
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as exc:
        print(f"  [Ollama] {model} 请求失败: {exc}", flush=True)
        return None


def parse_difficulty(response):
    if not response:
        return None
    try:
        data = json.loads(response)
        value = data.get("difficulty", data.get("level", data.get("score")))
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return max(1, min(10, int(round(float(value)))))
        text = str(value).strip().lower()
        mapping = {
            "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
            "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
            "easy": 3, "简单": 3, "较易": 4,
            "medium": 5, "中等": 5, "适中": 5,
            "hard": 8, "困难": 8, "较难": 7, "非常难": 9,
        }
        if text in mapping:
            return mapping[text]
        match = re.search(r"(\d+(?:\.\d+)?)", text)
        if match:
            return max(1, min(10, int(round(float(match.group(1))))))
    except Exception:
        pass
    return None


def build_difficulty_prompt(row):
    subject_label = {"chinese": "语文", "math": "数学", "english": "英语"}.get(row["subject_id"], "综合")
    content = (row["content"] or "")[:700]
    q_type = row["type"] or "unknown"
    return f"""你是上海春考{subject_label}命题分析专家。请评估下面试题的难度，输出 JSON：
{{"difficulty": 1到10的整数, "reason": "一句话说明"}}

难度标准：1-3 基础，4-6 中等，7-8 较难，9-10 压轴。
题型：{q_type}
题干：
{content}

仅输出 JSON。"""


def heuristic_difficulty(row):
    q_type = str(row["type"] or "").lower()
    if "writing" in q_type or "essay" in q_type or "summary" in q_type:
        return 6
    content_len = len(row["content"] or "")
    if content_len > 500:
        return 7
    if content_len > 200:
        return 5
    return 4


def clear_difficulties(conn, subject_filter=None):
    if subject_filter:
        conn.execute(
            "UPDATE questions SET difficulty = NULL WHERE subject_id = ?",
            (subject_filter,),
        )
    else:
        conn.execute("UPDATE questions SET difficulty = NULL")


def evaluate_difficulties(conn, subject_filter=None, use_llm=True, limit=None, force=False):
    if not use_llm:
        return {"updated": 0, "failed": 0, "total": 0, "fallback": 0, "llm_ok": 0}

    if force:
        clear_difficulties(conn, subject_filter)

    query = """
        SELECT id, subject_id, type, content, difficulty
        FROM questions
        WHERE difficulty IS NULL OR TRIM(difficulty) = ''
    """
    params = []
    if subject_filter:
        query += " AND subject_id = ?"
        params.append(subject_filter)
    query += " ORDER BY subject_id, bank_id, number"
    rows = conn.execute(query, params).fetchall()
    if limit:
        rows = rows[:limit]

    updated = 0
    failed = 0
    fallback = 0
    llm_ok = 0
    now = datetime.now().isoformat(timespec="seconds")

    for index, row in enumerate(rows, start=1):
        models = SUBJECT_MODELS.get(row["subject_id"], SUBJECT_MODELS["math"])
        difficulty = None
        for model in models:
            response = call_ollama(build_difficulty_prompt(row), model)
            difficulty = parse_difficulty(response)
            if difficulty is not None:
                llm_ok += 1
                break
            time.sleep(0.2)

        if difficulty is None:
            difficulty = heuristic_difficulty(row)
            fallback += 1

        conn.execute(
            "UPDATE questions SET difficulty = ?, updated_at = ? WHERE id = ?",
            (str(difficulty), now, row["id"]),
        )
        updated += 1
        if index % 20 == 0:
            print(f"  难度评估进度: {index}/{len(rows)}（LLM {llm_ok}，兜底 {fallback}）", flush=True)
        time.sleep(0.15)

    return {
        "updated": updated,
        "failed": failed,
        "fallback": fallback,
        "llm_ok": llm_ok,
        "total": len(rows),
    }


def audit_missing(conn):
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN final_answer IS NULL OR TRIM(final_answer) = '' THEN 1 ELSE 0 END) AS missing_final,
            SUM(CASE WHEN score IS NULL THEN 1 ELSE 0 END) AS missing_score,
            SUM(CASE WHEN difficulty IS NULL OR TRIM(difficulty) = '' THEN 1 ELSE 0 END) AS missing_difficulty
        FROM questions
        """
    ).fetchone()
    return {
        "total": row["total"],
        "missing_final_answer": row["missing_final"],
        "missing_score": row["missing_score"],
        "missing_difficulty": row["missing_difficulty"],
    }


def enrich_all(conn, subject_filter=None, use_llm=True, limit=None, force_difficulty=False):
    stats = {
        "final_answer_updated": fill_final_answers(conn),
        "score_updated": fill_scores(conn),
    }
    stats["difficulty"] = evaluate_difficulties(
        conn,
        subject_filter=subject_filter,
        use_llm=use_llm,
        limit=limit,
        force=force_difficulty,
    )
    stats["audit"] = audit_missing(conn)
    return stats


def main():
    parser = argparse.ArgumentParser(description="补全真题题目 final_answer / score / difficulty")
    parser.add_argument("--subject", choices=["chinese", "math", "english"])
    parser.add_argument("--skip-llm", action="store_true", help="跳过 Ollama 难度评估")
    parser.add_argument("--force-difficulty", action="store_true", help="清空已有 difficulty 并用 Ollama 重新评估")
    parser.add_argument("--limit", type=int, help="限制 LLM 评估题目数量（测试用）")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    conn = connect()
    result = enrich_all(
        conn,
        subject_filter=args.subject,
        use_llm=not args.skip_llm,
        limit=args.limit,
        force_difficulty=args.force_difficulty,
    )
    conn.commit()
    conn.close()

    output = {"success": True, **result}
    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(
            f"补全完成：final_answer +{result['final_answer_updated']}，"
            f"score +{result['score_updated']}，"
            f"difficulty +{result['difficulty']['updated']}（失败 {result['difficulty']['failed']}）"
        )
        print("缺失检查：", result["audit"])


if __name__ == "__main__":
    main()
