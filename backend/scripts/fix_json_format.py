#!/usr/bin/env python3
"""
fix_json_format.py - 自动修复 JSON 格式问题
"""

import os
import re
import json
import argparse
from pathlib import Path

def clean_json_content(content):
    """清理 JSON 字符串中的常见格式错误"""
    # 移除 BOM
    if content.startswith('\ufeff'):
        content = content[1:]
    # 移除尾部逗号（在 } 或 ] 之前）
    content = re.sub(r',\s*([}\]])', r'\1', content)
    return content

def try_parse_json(content):
    """尝试多种方式解析 JSON"""
    # 方法1：标准 json
    try:
        return json.loads(content), "std"
    except:
        pass
    # 方法2：清理尾部逗号后再试
    try:
        cleaned = clean_json_content(content)
        return json.loads(cleaned), "cleaned"
    except:
        pass
    # 方法3：使用 ast.literal_eval（处理单引号）
    try:
        import ast
        # 将单引号字符串转为双引号（保守替换）
        # 这里不做全局替换，因为容易误伤；ast.literal_eval 本身支持单引号
        data = ast.literal_eval(content)
        return data, "ast"
    except:
        pass
    # 方法4：使用 json5
    try:
        import json5
        return json5.loads(content), "json5"
    except:
        pass
    return None, None

def fix_and_save(file_path, dry_run=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        raw = f.read()
    data, method = try_parse_json(raw)
    if data is None:
        print(f"❌ 无法解析: {file_path}")
        return False
    if dry_run:
        print(f"✅ 可解析 ({method}): {file_path}")
        return True
    # 重新写入标准格式
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ 已修复 ({method}): {file_path}")
    return True

def scan_and_fix(directories, dry_run=False):
    fixed, failed = 0, 0
    for dir_path in directories:
        p = Path(dir_path)
        if not p.exists():
            print(f"⚠️ 目录不存在: {dir_path}")
            continue
        for json_file in p.glob("**/*.json"):
            if fix_and_save(json_file, dry_run):
                fixed += 1
            else:
                failed += 1
    print(f"\n📊 统计: 成功 {fixed}, 失败 {failed}")
    return fixed, failed

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--dirs", nargs="+", default=[
        "data/docs/chinese/2026",
        "data/docs/math/2026",
        "data/docs/english/2026",
        "data/exams"
    ])
    args = parser.parse_args()
    scan_and_fix(args.dirs, args.dry_run)