import os
import sys
import json

# 设置 ffmpeg 路径
os.environ['PATH'] = r'C:\ffmpeg\ffmpeg\bin;' + os.environ.get('PATH', '')

from faster_whisper import WhisperModel

_model_cache = {}

def get_model(model_size="small"):
    if model_size not in _model_cache:
        print(f"加载 Whisper 模型: {model_size}")
        _model_cache[model_size] = WhisperModel(
            model_size, 
            device="cpu", 
            compute_type="int8"
        )
    return _model_cache[model_size]

def transcribe_audio(audio_path, model_size="small", language="en"):
    model = get_model(model_size)
    
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language=language,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500
        )
    )
    
    result = {
        "text": "",
        "segments": [],
        "language": info.language,
        "duration": info.duration
    }
    
    for segment in segments:
        result["segments"].append({
            "text": segment.text,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2)
        })
        result["text"] += segment.text + " "
    
    result["text"] = result["text"].strip()
    return result

if __name__ == "__main__":
    audio_file = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "small"
    language = sys.argv[3] if len(sys.argv) > 3 else "en"
    
    result = transcribe_audio(audio_file, model_size, language)
    print(json.dumps(result, ensure_ascii=False))