"""本机 Ollama 模型名（与 ollama list 一致）。"""

# 难度批量评估优先用小模型（快）；大模型仅作备选
SUBJECT_MODELS = {
    "math": ["qwen2.5-coder-fast:latest", "gemma3:4b", "qwen2-math:7b"],
    "chinese": ["qwen2.5-coder-fast:latest", "gemma3:4b", "qwen2.5-coder:7b"],
    "english": ["gemma3:4b", "qwen2.5-coder-fast:latest", "qwen2.5-coder:7b"],
}

# 知识点 AI 匹配等单题精任务可用稍大模型
SUBJECT_MODELS_QUALITY = {
    "math": ["qwen2-math:7b", "qwen2.5-coder:7b"],
    "chinese": ["qwen2.5-coder:7b", "gemma3:4b"],
    "english": ["gemma3:4b", "qwen2.5-coder:7b"],
}

DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b"
