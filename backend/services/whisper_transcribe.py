import sys
import json
from faster_whisper import WhisperModel

def transcribe(audio_path):
    # 使用 small 模型（速度快，准确率够用）
    # 可选：'tiny', 'base', 'small', 'medium', 'large'
    model = WhisperModel("small", device="cpu", compute_type="int8")
    
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language="zh",  # 中文
        vad_filter=True  # 语音活动检测
    )
    
    full_text = " ".join([segment.text for segment in segments])
    return full_text

if __name__ == "__main__":
    audio_file = sys.argv[1]
    text = transcribe(audio_file)
    print(json.dumps({"text": text}, ensure_ascii=False))