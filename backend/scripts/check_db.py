import sqlite3, json

db='data/knowledge/chunkao.db'
conn=sqlite3.connect(db)
c=conn.cursor()
try:
    c.execute("SELECT id,title,total_questions,created_at FROM question_banks WHERE id=?",('test_chinese_sample',))
    bank=c.fetchone()
    print('BANK:', bank)
    c.execute("SELECT id,bank_id,number,content,source_answer,final_answer,my_answer,peer_answers,ai_answers FROM questions WHERE bank_id=?",('test_chinese_sample',))
    rows=c.fetchall()
    print('QUESTIONS_COUNT:', len(rows))
    for r in rows:
        print(r)
except Exception as e:
    print('ERROR', e)
finally:
    conn.close()
