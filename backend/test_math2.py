import requests
import time

PROMPT = """在△ABC中，角A、B、C所对的边分别为a、b、c，且c=5。
(1)若 a/(4b) = sinB/sinA，C = π/2，求a；
(2)若ab=20，求△ABC的面积的最大值。

请给出详细的解题步骤和最终答案。"""

MODELS = [
    ("qwen2-math:1.5b", "轻量快速模式"),
    ("qwen2-math:7b", "中量快速模式"),
    ("qwen2.5-coder:7b", "平衡模式"),
    ("qwen2.5:7b", "美观模式"),
]

print("="*60)
print("高中数学题测试 - 解三角形")
print("="*60)
print("\n题目:")
print(PROMPT)
print("\n开始测试各模型...")

for model_id, name in MODELS:
    print(f"\n{'='*50}")
    print(f"测试: {name} ({model_id})")
    print('='*50)
    
    try:
        start = time.time()
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": model_id,
                "prompt": PROMPT,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 1500
                }
            },
            timeout=120
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            result = response.json()
            answer = result.get('response', '')
            
            print(f"\n⏱️ 耗时: {elapsed:.2f} 秒")
            print(f"📝 长度: {len(answer)} 字符")
            print(f"\n📄 回答:\n{'-'*40}")
            print(answer[:1200])
            if len(answer) > 1200:
                print(f"\n... (共{len(answer)}字符)")
            
            # 检查关键结果
            if '(1)' in answer and 'a=' in answer:
                print("\n✅ 第(1)问给出了 a 的值")
            if '(2)' in answer and ('最大值' in answer or 'max' in answer.lower()):
                print("✅ 第(2)问给出了面积的最大值")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 错误: {e}")

print("\n" + "="*60)
print("测试完成！")
print("="*60)