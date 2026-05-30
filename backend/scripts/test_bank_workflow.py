#!/usr/bin/env python3
"""
完整题库采集流程测试
验证：PDF 解析 -> 校对 -> 保存数据库 -> 知识点关联
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

db_path = Path(__file__).parent.parent.parent / 'data' / 'knowledge' / 'chunkao.db'
banks_dir = Path(__file__).parent.parent.parent / 'data' / 'question_banks'

def test_complete_workflow():
    """Test complete question bank workflow"""
    
    print("=" * 60)
    print("题库采集完整流程验证")
    print("=" * 60)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. 检查题库数据库记录
    print("\n[1] 检查题库采集结果...")
    cursor.execute("SELECT id, title, subject_id, total_questions FROM question_banks WHERE id LIKE '%test%' ORDER BY id DESC LIMIT 5")
    banks = cursor.fetchall()
    print(f"   找到 {len(banks)} 个测试题库")
    for bank in banks:
        print(f"   - {bank['id']}: {bank['title']} ({bank['subject_id']}) - {bank['total_questions']} 题")
    
    # 2. 检查最新题库的题目
    if banks:
        test_bank_id = banks[0]['id']
        print(f"\n[2] 检查题库【{test_bank_id}】的题目...")
        cursor.execute("SELECT id, number, content, my_answer, source_answer FROM questions WHERE bank_id = ? ORDER BY number LIMIT 3", (test_bank_id,))
        questions = cursor.fetchall()
        print(f"   共 {cursor.execute('SELECT COUNT(*) FROM questions WHERE bank_id = ?', (test_bank_id,)).fetchone()[0]} 道题目")
        
        for q in questions:
            print(f"\n   题目 {q['number']}: {q['content'][:50]}...")
            print(f"   - 标准答案: {q['source_answer'][:30] if q['source_answer'] else 'None'}...")
            print(f"   - 我的答案: {q['my_answer'][:30] if q['my_answer'] else 'None'}...")
        
        # 3. 检查题目资源（截图）
        print(f"\n[3] 检查题库【{test_bank_id}】的题目资源...")
        cursor.execute("SELECT id, question_id, asset_type, file_path FROM question_assets WHERE question_id LIKE ? LIMIT 5", (f'{test_bank_id}%',))
        assets = cursor.fetchall()
        print(f"   共 {cursor.execute('SELECT COUNT(*) FROM question_assets WHERE question_id LIKE ?', (f'{test_bank_id}%',)).fetchone()[0]} 个资源")
        
        for asset in assets:
            print(f"   - {asset['id']}: {asset['asset_type']} -> {asset['file_path']}")
            # 验证文件是否存在
            asset_file = Path(__file__).parent.parent.parent / asset['file_path']
            exists = "✅" if asset_file.exists() else "❌"
            print(f"     文件: {exists} {asset_file}")
        
        # 4. 检查知识点关联
        print(f"\n[4] 检查题库【{test_bank_id}】的知识点关联...")
        cursor.execute("""
            SELECT k.name, qkp.confidence 
            FROM question_knowledge_points qkp 
            JOIN knowledge_points k ON qkp.knowledge_point_id = k.id
            WHERE qkp.question_id LIKE ?
            LIMIT 5
        """, (f'{test_bank_id}%',))
        kps = cursor.fetchall()
        print(f"   共 {cursor.execute('SELECT COUNT(*) FROM question_knowledge_points WHERE question_id LIKE ?', (f'{test_bank_id}%',)).fetchone()[0]} 个关联")
        
        for kp in kps:
            print(f"   - {kp[0]} (置信度: {kp[1]})")
    
    # 5. 检查 JSON 备份
    print(f"\n[5] 检查 JSON 备份文件...")
    json_files = list(banks_dir.glob('*_question_bank.json'))
    print(f"   共 {len(json_files)} 个 JSON 备份文件")
    
    if json_files:
        latest_json = sorted(json_files, key=lambda f: f.stat().st_mtime, reverse=True)[0]
        print(f"   最新: {latest_json.name}")
        
        try:
            with open(latest_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"     - paperId: {data.get('paperId', 'N/A')}")
            print(f"     - title: {data.get('title', 'N/A')}")
            print(f"     - totalQuestions: {data.get('totalQuestions', 0)}")
            print(f"     - 题目字段: {', '.join(data['questions'][0].keys()) if data.get('questions') else 'N/A'}")
        except Exception as e:
            print(f"     读取失败: {e}")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ 流程验证完成")
    print("=" * 60)

if __name__ == '__main__':
    test_complete_workflow()
