#!/usr/bin/env python3
"""
使用 LLM 为真题中的每道题推荐知识点（单题模式，稳定可靠）
输出 CSV 包含：question_id, knowledge_point_id, kp_name, kp_category, confidence, source
用法：
    python backend/scripts/single_llm_match_questions.py --subject math --model qwen2.5:7b --limit 5
"""

import sqlite3
import json
import csv
import argparse
import requests
from pathlib import Path
import time

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"
EXAMS_BASE = PROJECT_ROOT / "data" / "exams"
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
OLLAMA_URL = "http://localhost:11434/api/generate"

def load_knowledge_points(subject):
    """加载某学科的所有知识点，包含 id, name, category, description"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT id, name, category, description FROM knowledge_points WHERE subject_id = ?",
        (subject,)
    )
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "category": r[2] or "", "description": r[3] or ""} for r in rows]

def extract_questions_from_json(json_file):
    """从 qwen JSON 中提取所有题目（含子题）"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    exam_info = data.get("exam_info", {})
    subject = exam_info.get("subject", "unknown")
    year = exam_info.get("year", "")
    title = exam_info.get("title", "")
    bank_id = f"{subject}_{year}_{title}".replace(' ', '_').replace('/', '_')
    questions = []
    for section in data.get("sections", []):
        for q in section.get("questions", []):
            parent_id = q.get("id")
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
                        "analysis": analysis
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
                    "analysis": analysis
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

def build_prompt(question, knowledge_points):
    """构建 prompt，知识点列表只展示 name 和 description（不展示 category）"""
    kp_text = "\n".join([f"{kp['id']}: {kp['name']} —— {kp['description']}" for kp in knowledge_points])
    q_text = f"题干：{question['content'][:800]}\n"
    if question['answer']:
        q_text += f"答案：{question['answer'][:400]}\n"
    if question['analysis']:
        q_text += f"解析：{question['analysis'][:400]}\n"
    prompt = f"""你是一位经验丰富的学科教师。请从下面的知识点列表中选择与这道试题最相关的 1-3 个知识点（只选择最精确的）。输出一个 JSON 对象，格式为：{{"knowledge_point_ids": ["id1", "id2", ...], "confidence": 0.0~1.0}}。

知识点列表（ID: 名称 —— 描述）：
{kp_text}

试题：
{q_text}

仅输出 JSON 对象，不要有其他解释。"""
    return prompt

def parse_response(response):
    try:
        data = json.loads(response)
        kp_ids = data.get("knowledge_point_ids", [])
        if isinstance(kp_ids, str):
            kp_ids = [kp_ids]
        confidence = data.get("confidence", 0.5)
        return kp_ids, confidence
    except Exception as e:
        print(f"解析失败: {e}, 响应: {response[:200]}")
        return [], 0.0

def generate_csv_for_subject(subject, model, limit=None):
    # 加载知识点（包含 id, name, category）
    kp_list = load_knowledge_points(subject)
    if not kp_list:
        print(f"学科 {subject} 没有知识点")
        return
    print(f"学科 {subject} 共有 {len(kp_list)} 个知识点")

    # 建立 id -> (name, category) 映射
    kp_map = {kp['id']: {'name': kp['name'], 'category': kp['category']} for kp in kp_list}

    # 解析所有题目
    all_questions = []
    exams_dir = EXAMS_BASE / subject
    if not exams_dir.exists():
        print(f"目录 {exams_dir} 不存在")
        return
    for json_file in exams_dir.rglob("qwen_*.json"):
        print(f"  解析 {json_file.name}...")
        all_questions.extend(extract_questions_from_json(json_file))
    if not all_questions:
        print("没有找到题目")
        return
    total = len(all_questions)
    print(f"共 {total} 道题目")
    if limit and limit < total:
        all_questions = all_questions[:limit]
        total = limit

    results = []
    for idx, q in enumerate(all_questions, 1):
        print(f"处理 {idx}/{total}: {q['id']}")
        prompt = build_prompt(q, kp_list)
        response = call_ollama(prompt, model)
        if not response:
            continue
        kp_ids, confidence = parse_response(response)
        for kp_id in kp_ids:
            if kp_id not in kp_map:
                print(f"  警告: 推荐的知识点 ID {kp_id} 不存在，跳过")
                continue
            results.append({
                "question_id": q["id"],
                "knowledge_point_id": kp_id,
                "kp_name": kp_map[kp_id]['name'],
                "kp_category": kp_map[kp_id]['category'],
                "confidence": confidence,
                "source": "ai"
            })
        time.sleep(0.5)  # 避免请求过快

    output_file = EXPORT_DIR / f"question_kp_{subject}.csv"
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=[
            "question_id", "knowledge_point_id", "kp_name", "kp_category", "confidence", "source"
        ])
        writer.writeheader()
        writer.writerows(results)
    print(f"已生成 {output_file}，共 {len(results)} 条候选映射")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", required=True, choices=["chinese", "math", "english"])
    parser.add_argument("--model", default="qwen2.5:7b")
    parser.add_argument("--limit", type=int, help="限制题目数量（测试用）")
    args = parser.parse_args()
    generate_csv_for_subject(args.subject, args.model, args.limit)

if __name__ == "__main__":
    main()