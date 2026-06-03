#!/usr/bin/env python3
"""测试 JSON 导入数据库功能 - 支持知识点和题库"""

import requests
import json
import sys
from pathlib import Path

API_BASE = "http://localhost:3001/api"

def test_knowledge_import(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # 注意：后端接口期望 multipart/form-data，这里模拟前端上传
    files = {'file': (file_path.name, json.dumps(data, ensure_ascii=False), 'application/json')}
    resp = requests.post(f"{API_BASE}/knowledge/import-json", files=files)
    if resp.status_code == 200:
        return True, resp.json()
    else:
        return False, resp.text

def test_bank_import(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    files = {'file': (file_path.name, json.dumps(data, ensure_ascii=False), 'application/json')}
    resp = requests.post(f"{API_BASE}/banks/import-json", files=files)
    if resp.status_code == 200:
        return True, resp.json()
    else:
        return False, resp.text

def scan_and_test():
    success_count, fail_count = 0, 0
    # 测试知识点文件
    for lang in ['chinese', 'math', 'english']:
        dir_path = Path(f"data/docs/{lang}/2026")
        if dir_path.exists():
            for json_file in dir_path.glob("*.json"):
                print(f"测试知识点导入: {json_file.name}")
                ok, result = test_knowledge_import(json_file)
                if ok:
                    print(f"  ✅ 成功: {result.get('summary', {})}")
                    success_count += 1
                else:
                    print(f"  ❌ 失败: {result[:200]}")
                    fail_count += 1
    # 测试真题文件
    for subject in ['chinese', 'math', 'english']:
        dir_path = Path(f"data/exams/{subject}")
        if dir_path.exists():
            for json_file in dir_path.glob("**/qwen_*.json"):
                print(f"测试题库导入: {json_file.name}")
                ok, result = test_bank_import(json_file)
                if ok:
                    print(f"  ✅ 成功: 题库 {result.get('title', '')} 题目数 {result.get('totalQuestions',0)}")
                    success_count += 1
                else:
                    print(f"  ❌ 失败: {result[:200]}")
                    fail_count += 1
    print(f"\n总计: 成功 {success_count}, 失败 {fail_count}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--single':
        # 单独测试一个文件
        fp = Path(sys.argv[2])
        if 'knowledge' in sys.argv:
            ok, res = test_knowledge_import(fp)
        else:
            ok, res = test_bank_import(fp)
        print(json.dumps(res, indent=2, ensure_ascii=False) if ok else res)
    else:
        scan_and_test()