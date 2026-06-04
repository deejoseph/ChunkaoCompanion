#!/usr/bin/env python3
"""
导入用户确认后的知识点映射 CSV，更新 question_knowledge_points 表。
用法：
    python backend/scripts/import_kp_mapping_from_csv.py --csv path/to/file.csv
"""

import csv
import sqlite3
import argparse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(PROJECT_ROOT))
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

def validate_kp_id(kp_id, conn):
    """检查知识点 ID 是否存在"""
    cur = conn.execute("SELECT 1 FROM knowledge_points WHERE id = ?", (kp_id,))
    return cur.fetchone() is not None

def import_csv(csv_path, dry_run=False):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 确保表存在（实际应该已有）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS question_knowledge_points (
            id TEXT PRIMARY KEY,
            question_id TEXT NOT NULL,
            knowledge_point_id TEXT NOT NULL,
            confidence REAL,
            source TEXT,
            note TEXT,
            created_at TEXT,
            FOREIGN KEY (question_id) REFERENCES questions(id),
            FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
        )
    """)
    
    inserted = 0
    skipped = 0
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            question_id = row.get("question_id")
            user_kp_ids = row.get("user_confirmed_kp_ids", "").strip()
            if not user_kp_ids:
                continue  # 用户未确认，跳过
            
            kp_id_list = [kp.strip() for kp in user_kp_ids.split(",") if kp.strip()]
            if not kp_id_list:
                continue
            
            # 验证知识点 ID 有效性
            valid_kps = []
            for kp_id in kp_id_list:
                if validate_kp_id(kp_id, conn):
                    valid_kps.append(kp_id)
                else:
                    print(f"警告: 知识点 ID {kp_id} 不存在，跳过")
            if not valid_kps:
                skipped += 1
                continue
            
            # 先删除该题目的旧映射（如果存在）
            cursor.execute("DELETE FROM question_knowledge_points WHERE question_id = ?", (question_id,))
            
            # 插入新映射
            now = "datetime('now')"
            for kp_id in valid_kps:
                # 生成唯一 ID
                import uuid
                map_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO question_knowledge_points (id, question_id, knowledge_point_id, confidence, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (map_id, question_id, kp_id, 1.0, "manual", now)
                )
                inserted += 1
    
    if not dry_run:
        conn.commit()
    conn.close()
    
    print(f"导入完成：插入 {inserted} 条关联，跳过 {skipped} 条无效记录")
    if dry_run:
        print("试运行模式，未实际写入数据库")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="CSV 文件路径")
    parser.add_argument("--dry-run", action="store_true", help="仅验证，不写入")
    args = parser.parse_args()
    import_csv(args.csv, args.dry_run)

if __name__ == "__main__":
    main()