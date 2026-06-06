#!/usr/bin/env python3
"""
使用 LLM 为真题中的每道题推荐知识点（单题模式，保证解析成功）
用法：
    python backend/scripts/llm_match_questions.py --subject math --model qwen2.5:7b
"""

import os
import sys
import json
import csv
import argparse
import requests
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"
EXAMS_BASE = PROJECT_ROOT / "data" / "exams"
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = "http://localhost:11434/api/generate"

def load_knowledge_points(subject):
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT id, name, description FROM knowledge_points WHERE subject_id = ?",
        (subject,)
    )
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "description": r[2] or ""} for r in rows]

def extract_questions_from_json(json_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    exam_info = data.get("exam_info", {})
    # 提取学科和年份等，用于构造 bank_id（可选）
    subject = exam_info.get("subject", "unknown")
    year = exam_info.get("year", "")
    title = exam_info.get("title", "")
    bank_id = f"{subject}_{year}_{title}".replace(' ', '_').replace('/', '_')
    questions = []
    global_counter = 1
    for section in data.get("sections", []):
        for q in section.get("questions", []):
            parent_id = q.get("id", global_counter)
            sub_qs = q.get("sub_questions", [])
            if sub_qs:
                for sub in sub_qs:
                    part = sub.get("part", "")
                    q_id = f"{bank_id}_q{parent_id}_p{part}"
                    content = sub.get("content", "")
                    answer = sub.get("answer", "")
                    analysis = sub.get("analysis", "")
                    questions.append({
                        "id": q_id,
                        "bank_id": bank_id,
                        "content": content,
                        "answer": answer,
                        "analysis": analysis,
                        "score": sub.get("score")
                    })
            else:
                q_id = f"{bank_id}_q{parent_id}"
                content = q.get("content", "")
                answer = q.get("answer", "")
                analysis = q.get("analysis", "")
                questions.append({
                    "id": q_id,
                    "bank_id": bank_id,
                    "content": content,
                    "answer": answer,
                    "analysis": analysis,
                    "score": q.get("score")
                })
    return questions

def call_ollama(prompt, model, temperature=0.2):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "temperature": temperature,
        "format": "json"
    }
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=180)
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as e:
        print(f"Ollama 调用失败: {e}")
        return None

def build_single_prompt(question, knowledge_points):
    kp_text = "\n".join([f"{kp['id']}: {kp['name']} —— {kp['description']}" for kp in knowledge_points])
    q_text = f"题干：{question['content'][:800]}\n"
    if question['answer']:
        q_text += f"答案：{question['answer'][:400]}\n"
    if question['analysis']:
        q_text += f"解析：{question['analysis'][:400]}\n"
    prompt = f"""你是一位经验丰富的学科教师。请从下面的知识点列表中为这道试题选择最相关的 1-3 个知识点（只选择最精确的）。输出必须是一个 JSON 对象，格式为：{{"knowledge_point_ids": ["id1", "id2", ...], "confidence": 0.0~1.0}}。

知识点列表（ID: 名称 —— 描述）：
{kp_text}

试题：
{q_text}

仅输出 JSON 对象，不要有其他内容。"""
    return prompt

def parse_single_response(response):
    try:
        data = json.loads(response)
        kp_ids = data.get("knowledge_point_ids", [])
        if isinstance(kp_ids, str):
            kp_ids = [kp_ids]
        confidence = data.get("confidence", 0.5)
        return kp_ids, confidence
    except:
        return [], 0.0

def generate_csv_for_subject(subject, model, limit=None):
    kp_list = load_knowledge_points(subject)
    if not kp_list:
        print(f"学科 {subject} 没有知识点，跳过")
        return
    print(f"学科 {subject} 共有 {len(kp_list)} 个知识点")

    all_questions = []
    exams_dir = EXAMS_BASE / subject
    if not exams_dir.exists():
        print(f"目录 {exams_dir} 不存在，跳过")
        return
    for json_file in exams_dir.rglob("qwen_*.json"):
        print(f"  解析 {json_file.name}...")
        questions = extract_questions_from_json(json_file)
        all_questions.extend(questions)
    if not all_questions:
        print(f"学科 {subject} 没有找到题目，跳过")
        return
    total = len(all_questions)
    print(f"共 {total} 道题目")
    if limit and limit < total:
        all_questions = all_questions[:limit]
        total = limit
        print(f"限制处理前 {total} 道题目")

    results = []
    for idx, q in enumerate(all_questions, 1):
        print(f"处理题目 {idx}/{total}: {q['id']}")
        prompt = build_single_prompt(q, kp_list)
        response = call_ollama(prompt, model)
        if not response:
            print(f"  跳过（无响应）")
            continue
        kp_ids, confidence = parse_single_response(response)
        if not kp_ids:
            print(f"  解析失败，响应: {response[:100]}")
            continue
        for kp_id in kp_ids:
            results.append({
                "question_id": q["id"],
                "knowledge_point_id": kp_id,
                "confidence": confidence,
                "source": "ai"
            })
        # 避免请求过快
        import time
        time.sleep(0.5)

    output_file = EXPORT_DIR / f"question_kp_{subject}.csv"
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=["question_id", "knowledge_point_id", "confidence", "source"])
        writer.writeheader()
        writer.writerows(results)
    print(f"已生成 {output_file}，共 {len(results)} 条映射候选")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", required=True, choices=["chinese", "math", "english"])
    parser.add_argument("--model", default="qwen2.5:7b", help="Ollama 模型名称")
    parser.add_argument("--limit", type=int, help="限制处理的题目数量（测试用）")
    args = parser.parse_args()
    generate_csv_for_subject(args.subject, args.model, args.limit)

if __name__ == "__main__":
    main()