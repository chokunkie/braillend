"""
Image preprocessing pipeline for Thai-focused EasyOCR accuracy.

Order: decode -> resize (shorter side >= 640px) -> grayscale -> CLAHE contrast
enhancement -> adaptive threshold (only if lighting looks uneven) -> denoise
(intensity tuned by documentSource, since camera captures are noisier than
clean uploads).
"""

import io

import cv2
import numpy as np
from PIL import Image

MIN_SHORT_SIDE = 640


def decode_image(image_bytes: bytes) -> np.ndarray:
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb = np.array(pil_img)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def resize_min_side(img: np.ndarray, min_side: int = MIN_SHORT_SIDE) -> tuple:
    """Returns (resized_img, scale). scale is 1.0 when no resize was needed -
    callers must divide bbox coordinates by scale to map back to the original
    (pre-resize) image the frontend inspector actually displays."""
    h, w = img.shape[:2]
    short_side = min(h, w)
    if short_side >= min_side or short_side == 0:
        return img, 1.0
    scale = min_side / short_side
    new_w, new_h = round(w * scale), round(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC), scale


def _is_lighting_uneven(gray: np.ndarray) -> bool:
    """Heuristic: compare local mean brightness across quadrants/tiles.
    Large spread between tiles indicates uneven lighting (shadows, glare)."""
    h, w = gray.shape[:2]
    tile_h, tile_w = max(1, h // 4), max(1, w // 4)
    means = []
    for y in range(0, h, tile_h):
        for x in range(0, w, tile_w):
            tile = gray[y:y + tile_h, x:x + tile_w]
            if tile.size > 0:
                means.append(float(tile.mean()))
    if len(means) < 2:
        return False
    return (max(means) - min(means)) > 55.0


def preprocess(image_bytes: bytes, document_source: str = "upload") -> tuple:
    """Returns (preprocessed_img, scale) - see resize_min_side() for what scale means."""
    img = decode_image(image_bytes)
    img, scale = resize_min_side(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    if _is_lighting_uneven(enhanced):
        enhanced = cv2.adaptiveThreshold(
            enhanced,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=10,
        )

    is_camera = document_source == "camera"
    denoise_strength = 10 if is_camera else 4
    denoised = cv2.fastNlMeansDenoising(
        enhanced, h=denoise_strength, templateWindowSize=7, searchWindowSize=21
    )

    return denoised, scale
