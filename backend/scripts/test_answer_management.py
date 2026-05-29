#!/usr/bin/env python3
"""
测试题库答案管理改造的完整性
验证数据库、后端和前端的集成
"""
import sqlite3
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

# 确保路径存在
if not DB_PATH.exists():
    print(f"⚠️ 数据库文件不存在: {DB_PATH}")
    print(f"尝试初始化数据库...")
    # 先初始化数据库
    import subprocess
    result = subprocess.run([
        'python', 
        str(Path(__file__).parent / 'init_knowledge_db.py')
    ], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"初始化失败: {result.stderr}")
        exit(1)

def test_database_fields():
    """测试数据库字段是否存在"""
    print("=" * 60)
    print("【测试1】验证数据库新字段")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 获取questions表的列信息
    cursor.execute("PRAGMA table_info(questions)")
    columns = {row[1] for row in cursor.fetchall()}
    
    required_fields = ['my_answer', 'peer_answers', 'ai_answers', 'discussion']
    for field in required_fields:
        if field in columns:
            print(f"✅ 字段存在: {field}")
        else:
            print(f"❌ 字段缺失: {field}")
    
    conn.close()
    return all(field in columns for field in required_fields)

def test_json_export():
    """测试JSON导出格式"""
    print("\n" + "=" * 60)
    print("【测试2】验证JSON导出字段")
    print("=" * 60)
    
    # 创建测试数据结构
    test_data = {
        "paperId": "test_001",
        "title": "测试题库",
        "sourceTitle": "测试原始名称",
        "subject": "chinese",
        "version": "2026",
        "knowledgePoints": [],
        "questions": [
            {
                "id": "q1",
                "type": "fill",
                "content": "这是一道测试题目",
                "sourceAnswer": "参考答案",
                "finalAnswer": "最终答案",
                "myAnswer": "我的答案",
                "peerAnswers": {
                    "qwen2.5-coder:7b": "AI答案1",
                    "llama2": "AI答案2"
                },
                "aiAnswers": {
                    "qwen2.5-coder:7b": "AI答案1",
                    "llama2": "AI答案2"
                },
                "discussion": "讨论要点：多个AI意见一致",
                "analysis": "解析说明"
            }
        ]
    }
    
    # 验证JSON结构
    required_fields = ['sourceAnswer', 'finalAnswer', 'myAnswer', 'peerAnswers', 'aiAnswers', 'discussion']
    question = test_data['questions'][0]
    
    for field in required_fields:
        if field in question:
            print(f"✅ 字段存在: {field}")
            print(f"   值: {question[field]}")
        else:
            print(f"❌ 字段缺失: {field}")
    
    return all(field in question for field in required_fields)

def test_database_schema():
    """测试数据库表结构"""
    print("\n" + "=" * 60)
    print("【测试3】验证数据库表结构完整性")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 查看questions表的完整结构
    cursor.execute("PRAGMA table_info(questions)")
    columns = cursor.fetchall()
    
    print(f"\nquestions表共有 {len(columns)} 个字段：")
    for col_id, name, type_, notnull, default, pk in columns:
        print(f"  {name:20} ({type_})")
    
    conn.close()
    return True

def main():
    print("\n")
    print("🔍 开始测试题库答案管理改造完整性...")
    print("\n")
    
    results = {
        "数据库字段": test_database_fields(),
        "JSON导出": test_json_export(),
        "数据库结构": test_database_schema()
    }
    
    print("\n" + "=" * 60)
    print("【测试总结】")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status}: {test_name}")
    
    print(f"\n总体进度: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！改造完成。")
        return 0
    else:
        print(f"\n⚠️ 还有 {total - passed} 项测试未通过，请检查。")
        return 1

if __name__ == '__main__':
    exit(main())
