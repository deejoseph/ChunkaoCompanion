import os
import requests
from pathlib import Path

API_BASE = "http://localhost:3001/api/banks/import-json"
MATH_DIR = Path("data/exams/math")

for json_file in MATH_DIR.rglob("qwen_*.json"):
    print(f"导入: {json_file}")
    with open(json_file, 'rb') as f:
        files = {'file': (json_file.name, f, 'application/json')}
        resp = requests.post(API_BASE, files=files)
        if resp.status_code == 200:
            print(f"  ✅ 成功: {resp.json().get('title')}")
        else:
            print(f"  ❌ 失败: {resp.text}")