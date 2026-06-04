#!/usr/bin/env python3
import json
import sqlite3
import argparse
import requests
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"
OLLAMA_URL = "http://localhost:11434/api/generate"
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def get_knowledge_points_by_subject(subject):
    conn = get_db_connection()
    cur = conn.execute("SELECT id, name FROM knowledge_points WHERE subject_id = ?", (subject,))
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1]} for r in rows]

def get_unmapped_questions(subject, limit=None):
    conn = get_db_connection()
    query = """
        SELECT q.id, q.content, q.source_answer, q.analysis
        FROM questions q
        WHERE q.subject_id = ?
        AND NOT EXISTS (SELECT 1 FROM question_knowledge_points WHERE question_id = q.id)
        ORDER BY q.bank_id, q.number
    """
    params = [subject]
    if limit:
        query += " LIMIT ?"
        params.append(limit)
    cur = conn.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "content": r[1] or "", "source_answer": r[2] or "", "analysis": r[3] or ""} for r in rows]

def build_prompt_single(question, knowledge_points):
    kp_text = "\n".join([f"{kp['id']}: {kp['name']}" for kp in knowledge_points])
    prompt = f"""你是一位学科教师。请根据题目内容，从以下知识点列表中选择最匹配的 1-3 个知识点（只输出知识点 ID，以 JSON 数组形式，例如 ["kp_id1", "kp_id2"]）。

知识点列表（ID: 名称）：
{kp_text}

题目：
题干：{question['content'][:500]}
答案：{question['source_answer'][:200]}
解析：{question['analysis'][:200]}

请仅输出 JSON 数组，不要输出其他内容。"""
    return prompt

def call_ollama(prompt, model, timeout=120):
    payload = {"model": model, "prompt": prompt, "stream": False, "temperature": 0.2, "format": "json"}
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as e:
        print(f"调用失败: {e}")
        return None

def parse_single_response(response):
    try:
        data = json.loads(response)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "knowledge_point_ids" in data:
            return data["knowledge_point_ids"]
        elif isinstance(data, dict) and "ids" in data:
            return data["ids"]
        else:
            return []
    except:
        return []

def generate_csv(subject, output_file, model, limit=None):
    kp_list = get_knowledge_points_by_subject(subject)
    if not kp_list:
        print(f"学科 {subject} 无知识点")
        return False
    questions = get_unmapped_questions(subject, limit)
    if not questions:
        print("无待映射题目")
        return False
    
    results = []
    for idx, q in enumerate(questions):
        print(f"处理题目 {idx+1}/{len(questions)}: {q['id']}")
        prompt = build_prompt_single(q, kp_list)
        response = call_ollama(prompt, model)
        if not response:
            print("  跳过")
            continue
        kp_ids = parse_single_response(response)
        if not kp_ids:
            print(f"  解析失败: {response[:100]}")
            continue
        results.append({
            "question_id": q["id"],
            "content": q["content"],
            "source_answer": q["source_answer"],
            "analysis": q["analysis"],
            "ai_kp_ids": ",".join(kp_ids),
            "confidence": 1.0  # 暂不计算置信度
        })
        time.sleep(1)
    
    if not results:
        print("无有效结果")
        return False
    
    import csv
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=["question_id", "content", "source_answer", "analysis", "ai_kp_ids", "confidence", "user_confirmed_kp_ids", "user_notes"])
        writer.writeheader()
        for row in results:
            writer.writerow({**row, "user_confirmed_kp_ids": "", "user_notes": ""})
    print(f"CSV 已生成: {output_file}")
    return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", required=True)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--output", type=str)
    parser.add_argument("--model", default="qwen2-math:7b")
    args = parser.parse_args()
    if not args.output:
        args.output = EXPORT_DIR / f"{args.subject}_kp_candidates.csv"
    success = generate_csv(args.subject, args.output, args.model, args.limit)
    print("完成" if success else "失败")

if __name__ == "__main__":
    main()