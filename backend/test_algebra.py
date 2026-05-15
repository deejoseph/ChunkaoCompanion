import requests
import time

PROMPT = """记M(a)={t|t=f(x)-f(a), x≥a}，L(a)={t|t=f(x)-f(a), x≤a}．
(1)若f(x)=x²+1，求M(1)和L(1)；
(2)若f(x)=x³-3x²，求证：对于任意a∈R，都有M(a)⊆[-4,+∞)，且存在a，使得-4∈M(a)．
(3)已知定义在R上f(x)有最小值，求证“f(x)是偶函数”的充要条件是“对于任意正实数c，均有M(-c)=L(c)”．

请给出详细的解题步骤和证明过程。"""

MODELS = [
    ("qwen2-math:1.5b", "轻量快速模式"),
    ("qwen2-math:7b", "中量快速模式"),
    ("qwen2.5-coder:7b", "平衡模式"),
    ("qwen2.5:7b", "美观模式"),
]

print("="*60)
print("高中数学题测试 - 函数与集合")
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
            print(f"📝 长度: {len(answer)} 字符")
            print(f"\n📄 回答:\n{'-'*40}")
            print(answer[:1500])
            if len(answer) > 1500:
                print(f"\n... (共{len(answer)}字符)")
            
            # 检查关键内容
            checks = []
            if '(1)' in answer and ('M(1)' in answer or 'M1' in answer):
                checks.append("✅ 第(1)问有回答")
            if '(2)' in answer and ('M(a)' in answer):
                checks.append("✅ 第(2)问有回答")
            if '(3)' in answer and ('偶函数' in answer or 'M(-c)' in answer):
                checks.append("✅ 第(3)问有回答")
            
            for c in checks:
                print(c)
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 错误: {e}")

print("\n" + "="*60)
print("测试完成！")
print("="*60)