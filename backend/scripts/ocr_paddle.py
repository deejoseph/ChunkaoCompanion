import json
import sys

from paddleocr import PaddleOCR


def normalize_result(result):
    blocks = []
    for page in result or []:
        for item in page or []:
            if len(item) != 2:
                continue

            box, rec = item
            if not rec or len(rec) != 2:
                continue

            text, score = rec
            y = min(point[1] for point in box)
            x = min(point[0] for point in box)
            blocks.append({
                "text": text,
                "score": float(score),
                "box": box,
                "x": float(x),
                "y": float(y),
            })

    blocks.sort(key=lambda block: (round(block["y"] / 12) * 12, block["x"]))
    text = "\n".join(block["text"] for block in blocks)
    return blocks, text


def recognize_text(image_path):
    # Force CPU mode so the current GPU Paddle package does not require CUDA/cuDNN.
    ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False, use_gpu=False)
    result = ocr.ocr(image_path, cls=True)
    blocks, text = normalize_result(result)
    return {
        "success": True,
        "text": text,
        "blocks": blocks,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "missing image path"}, ensure_ascii=False))
        sys.exit(1)

    try:
        print(json.dumps(recognize_text(sys.argv[1]), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
