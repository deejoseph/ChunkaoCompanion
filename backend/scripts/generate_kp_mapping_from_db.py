#!/usr/bin/env python3
"""
基于现有的 knowledge_points 表生成题目-知识点候选映射 CSV
用法：
    python backend/scripts/generate_kp_mapping_from_db.py
输出：
    data/exports/question_kp_chinese.csv
    data/exports/question_kp_math.csv
    data/exports/question_kp_english.csv
"""

import sqlite3
import csv
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

# 尝试导入 jieba
try:
    import jieba
    USE_JIEBA = True
except ImportError:
    USE_JIEBA = False
    print("警告: jieba 未安装，将使用简单正则分词。建议安装: pip install jieba")

DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

STOP_WORDS = {'的', '了', '和', '与', '或', '在', '是', '有', '被', '给', '对', '从', '到', '上', '下', '这', '那', '一', '不', '也', '都', '而', '并', '且', '即', '则', '如', '等', '又', '及', '以', '为', '于', '之', '其', '所', '将', '后', '前', '左', '右', '中', '内', '外', '时', '地', '得', '着', '过', '吗', '呢', '吧', '啊'}

def extract_keywords(text, use_jieba=True):
    if not text:
        return set()
    if use_jieba and USE_JIEBA:
        words = jieba.lcut(text)
    else:
        words = re.findall(r'[A-Za-z0-9]+|[\u4e00-\u9fff]+', text)
    result = set()
    for w in words:
        if len(w) >= 2 and w not in STOP_WORDS:
            w = w.strip('，。？！；：“”‘’《》【】（）')
            if w:
                result.add(w)
    return result

def compute_score(keywords_q, keywords_kp):
    if not keywords_q or not keywords_kp:
        return 0
    inter = len(keywords_q & keywords_kp)
    union = len(keywords_q | keywords_kp)
    return inter / union if union > 0 else 0

def generate_csv_for_subject(subject_id, output_file):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. 获取该学科的所有知识点（id, name, category, description）
    cursor.execute("""
        SELECT id, name, category, description
        FROM knowledge_points
        WHERE subject_id = ?
    """, (subject_id,))
    kp_rows = cursor.fetchall()
    if not kp_rows:
        print(f"学科 {subject_id} 没有知识点，跳过")
        conn.close()
        return

    kp_list = []
    for kp_id, name, category, desc in kp_rows:
        # 构建关键词：名称 + 类别 + 描述（如果有）
        text = f"{name} {category or ''} {desc or ''}"
        keywords = extract_keywords(text, use_jieba=USE_JIEBA)
        kp_list.append({
            'id': kp_id,
            'name': name,
            'keywords': keywords
        })

    # 2. 获取该学科的所有题目
    cursor.execute("""
        SELECT id, content, source_answer, analysis
        FROM questions
        WHERE subject_id = ?
    """, (subject_id,))
    questions = cursor.fetchall()
    print(f"学科 {subject_id} 共 {len(questions)} 道题目")

    # 3. 为每道题匹配知识点
    rows_out = []
    for q_id, content, source_answer, analysis in questions:
        q_text = f"{content or ''} {source_answer or ''} {analysis or ''}"
        q_keywords = extract_keywords(q_text, use_jieba=USE_JIEBA)
        if not q_keywords:
            continue
        scores = []
        for kp in kp_list:
            score = compute_score(q_keywords, kp['keywords'])
            if score > 0:
                scores.append((kp['id'], score))
        scores.sort(key=lambda x: x[1], reverse=True)
        for kp_id, score in scores[:3]:
            rows_out.append({
                'question_id': q_id,
                'knowledge_point_id': kp_id,
                'confidence': round(score, 3),
                'source': 'rule'
            })

    # 4. 写入 CSV
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['question_id', 'knowledge_point_id', 'confidence', 'source'])
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"已生成 {output_file}，共 {len(rows_out)} 条候选映射")
    conn.close()

def main():
    subjects = {
        'chinese': EXPORT_DIR / 'question_kp_chinese.csv',
        'math': EXPORT_DIR / 'question_kp_math.csv',
        'english': EXPORT_DIR / 'question_kp_english.csv'
    }
    for subj, out_file in subjects.items():
        print(f"\n处理学科: {subj}")
        generate_csv_for_subject(subj, out_file)

    print("\n所有 CSV 生成完毕！请检查 data/exports/ 目录。")

if __name__ == '__main__':
    main()