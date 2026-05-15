#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import json
import time

PROMPT = """已知双曲线 \\frac{x^2}{a^2}-\\frac{y^2}{6-a^2}=1 (a>0) 的左、右焦点分别为 F₁、F₂。通过 F₂ 且倾斜角为 \\frac{\\pi}{3} 的直线与双曲线交于第一象限的点 A，延长 AF₂ 至 B 使得 AB=AF₁。若 \\triangle BF₁F₂ 的面积为 3\\sqrt{6}，则 a 的值为多少？请给出详细的解题步骤。"""

MODELS = [
    ("轻量快速模式", "qwen2-math:1.5b"),
    ("中量快速模式", "qwen2-math:7b"),
    ("平衡模式", "qwen2.5-coder:7b"),
    ("美观模式", "qwen2.5:7b"),
]

def test_model(name, model_id):
    print(f"\n{'='*60}")
    print(f"测试模型: {name}")
    print(f"模型ID: {model_id}")
    print('='*60)
    
    try:
        start = time.time()
        
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": model_id,
                "prompt": PROMPT,
                "stream": False,
                "options": {
                    "temperature": 0.6,
                    "num_predict": 2000
                }
            },
            timeout=180
        )
        
        elapsed = time.time() - start
        
        if response.status_code == 200:
            result = response.json()
            answer = result.get('response', '')
            
            print(f"\n⏱️ 耗时: {elapsed:.2f} 秒")
            print(f"📝 字数: {len(answer)} 字符")
            print(f"\n📄 回答内容:\n{'-'*40}")
            print(answer[:2000])
            if len(answer) > 2000:
                print(f"\n... (共{len(answer)}字符，已截断)")
            
            # 检查答案
            if 'a=' in answer or 'a ＝' in answer or 'a =' in answer:
                print("\n✅ 模型给出了 a 的值")
            else:
                print("\n⚠️ 模型未明确给出 a 的值")
        else:
            print(f"\n❌ HTTP错误: {response.status_code}")
            print(response.text[:500])
            
    except requests.exceptions.Timeout:
        print(f"\n❌ 超时 (>{180}秒)")
    except Exception as e:
        print(f"\n❌ 错误: {e}")

def main():
    print("="*60)
    print("高中数学题测试 - 双曲线问题")
    print("="*60)
    print("\n题目:")
    print(PROMPT)
    print("\n开始测试各模型...")
    
    for name, model_id in MODELS:
        test_model(name, model_id)
    
    print("\n" + "="*60)
    print("测试完成！")
    print("="*60)

if __name__ == "__main__":
    main()