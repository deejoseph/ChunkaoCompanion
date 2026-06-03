import sqlite3
import sys
sys.path.append('backend')
conn = sqlite3.connect('data/knowledge/chunkao.db')
cursor = conn.cursor()
cursor.execute("SELECT id, bank_id, number, score FROM questions WHERE score IS NULL")
missing = cursor.fetchall()
if missing:
    print("以下题目缺少分值：")
    for q in missing:
        print(f"  题库: {q[1]}, 题号: {q[2]}, ID: {q[0]}")
else:
    print("所有题目都有分值，可以放心使用答题卡。")
conn.close()