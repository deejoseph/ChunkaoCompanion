import os
import json
import requests
from pathlib import Path

API_BASE = "http://localhost:3001/api/banks/import-json"
EXAMS_DIR = Path("data/exams")

def import_json(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': (file_path.name, f, 'application/json')}
        try:
            resp = requests.post(API_BASE, files=files)
            if resp.status_code == 200:
                result = resp.json()
                print(f"✅ {file_path} -> {result.get('title')} ({result.get('totalQuestions')} 题)")
            else:
                print(f"❌ {file_path} 失败: {resp.text}")
        except Exception as e:
            print(f"❌ {file_path} 异常: {e}")

def main():
    # 遍历所有 qwen_*.json 文件
    for json_file in Path(EXAMS_DIR).rglob("qwen_*.json"):
        import_json(json_file)

if __name__ == "__main__":
    main()