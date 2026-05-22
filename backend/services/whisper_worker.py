import json
import os
import sys
import traceback

os.environ["PATH"] = r"C:\ffmpeg\ffmpeg\bin;" + os.environ.get("PATH", "")
os.environ["GLOG_minloglevel"] = "3"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from faster_whisper import WhisperModel

MODEL_CACHE = {}


def get_model(model_size):
    if model_size not in MODEL_CACHE:
        MODEL_CACHE[model_size] = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
        )
    return MODEL_CACHE[model_size]


def transcribe_audio(audio_path, model_size="small", language="en"):
    model = get_model(model_size)
    beam_size = 1 if model_size in ("tiny", "base") else 3

    segments, info = model.transcribe(
        audio_path,
        beam_size=beam_size,
        language=language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 350},
        condition_on_previous_text=False,
    )

    result = {
        "text": "",
        "segments": [],
        "language": info.language,
        "duration": info.duration,
        "model_size": model_size,
    }

    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        result["segments"].append({
            "text": text,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
        })
        result["text"] += text + " "

    result["text"] = result["text"].strip()
    return result


def write_response(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            audio_path = request["audio_path"]
            model_size = request.get("model_size", "small")
            language = request.get("language", "en")
            request_id = request.get("id")

            result = transcribe_audio(audio_path, model_size, language)
            write_response({"success": True, "id": request_id, "result": result})
        except Exception as exc:
            write_response({
                "success": False,
                "id": locals().get("request", {}).get("id") if "request" in locals() else None,
                "error": str(exc),
                "trace": traceback.format_exc(),
            })


if __name__ == "__main__":
    main()
