"""
EasyOCR wrapper. The reader is initialized once (module import) and reused
across requests, since loading the Thai+English recognition models is
expensive.
"""

from typing import Any, Dict, List

import easyocr

_reader = None


def get_reader() -> "easyocr.Reader":
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["th", "en"], gpu=False)
    return _reader


def _bbox_to_rect(points: List[List[float]], scale: float) -> Dict[str, float]:
    """scale maps the (possibly resized) image the OCR ran on back to the
    original upload dimensions the frontend inspector draws on."""
    xs = [p[0] / scale for p in points]
    ys = [p[1] / scale for p in points]
    return {
        "x0": float(min(xs)),
        "y0": float(min(ys)),
        "x1": float(max(xs)),
        "y1": float(max(ys)),
    }


def run_ocr(image, scale: float = 1.0) -> Dict[str, Any]:
    reader = get_reader()
    raw_results = reader.readtext(image, decoder="beamsearch", paragraph=False)

    words = []
    confidences = []
    text_parts = []
    for bbox_points, text, confidence in raw_results:
        text = text.strip()
        if not text:
            continue
        conf_pct = float(confidence) * 100.0
        words.append(
            {
                "text": text,
                "bbox": _bbox_to_rect(bbox_points, scale),
                "confidence": conf_pct,
            }
        )
        confidences.append(conf_pct)
        text_parts.append(text)

    overall_confidence = (sum(confidences) / len(confidences)) if confidences else 0.0

    return {
        "text": " ".join(text_parts),
        "confidence": overall_confidence,
        "words": words,
    }
