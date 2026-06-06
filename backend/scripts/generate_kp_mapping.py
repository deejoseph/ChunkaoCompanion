#!/usr/bin/env python3
"""
生成知识点清单 CSV（先只导出知识点，题目映射留给后续）。
用法：
    python backend/scripts/generate_kp_mapping.py
输出：
    data/exports/question_kp_chinese.csv
    data/exports/question_kp_math.csv
    data/exports/question_kp_english.csv
"""

import sqlite3
import csv
import re
import sys
import json
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

try:
    import jieba
    USE_JIEBA = True
except ImportError:
    USE_JIEBA = False
    print("警告: jieba 未安装，将使用简单正则分词。建议安装: pip install jieba")

DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"
DOCS_BASE = PROJECT_ROOT / "data" / "docs"
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

def load_knowledge_points_from_json(subject):
    """
    从专题 JSON 中读取知识点列表：
    仅使用顶层专题标题作为 category，
    并把每个专题的 "高频考查内容" 数组中的条目作为知识点名称。
    返回一个字典：{知识点名称: 关键词集合}
    """
    topic_dir = DOCS_BASE / subject / "2026"
    if not topic_dir.exists():
        return {}
    kp_keywords = defaultdict(set)
    for json_file in topic_dir.glob("*.json"):
        with open(json_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except:
                continue
        topic_name = data.get("专题")
        if not topic_name:
            continue

        high_freq = data.get("命题分析", {}).get("高频考查内容", [])
        for hf in high_freq:
            if hf:
                kp_keywords[hf].update(extract_keywords(hf, use_jieba=USE_JIEBA))
    return kp_keywords

def compute_score(keywords_q, keywords_kp):
    if not keywords_q or not keywords_kp:
        return 0
    inter = len(keywords_q & keywords_kp)
    union = len(keywords_q | keywords_kp)
    return inter / union if union > 0 else 0

def generate_csv_for_subject(subject_id, output_file):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, category, description
        FROM knowledge_points
        WHERE subject_id = ?
        ORDER BY category, name
    """, (subject_id,))
    rows = cursor.fetchall()

    if not rows:
        print(f"学科 {subject_id} 没有知识点，跳过")
        conn.close()
        return

    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['knowledge_point_id', 'name', 'category', 'description'])
        writer.writeheader()
        for kp_id, name, category, description in rows:
            writer.writerow({
                'knowledge_point_id': kp_id,
                'name': name,
                'category': category or '',
                'description': description or ''
            })

    print(f"已生成 {output_file}，共 {len(rows)} 条知识点")
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