#!/usr/bin/env python3
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent.parent / 'data' / 'knowledge' / 'chunkao.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check question_assets table
print("=== Question Assets Table ===")
cursor.execute("SELECT * FROM question_assets WHERE question_id LIKE 'test_chinese_sample%'")
rows = cursor.fetchall()
print(f"Found {len(rows)} records")
for row in rows:
    print(f"  ID: {row[0]}")
    print(f"  Question ID: {row[1]}")
    print(f"  Asset Type: {row[2]}")
    print(f"  File Path: {row[3]}")
    print(f"  Page Number: {row[4]}")
    print(f"  Created At: {row[7]}")
    print()

conn.close()
print("✅ Database check complete")
