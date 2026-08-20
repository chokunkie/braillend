"""
Image preprocessing pipeline for Thai-focused EasyOCR accuracy.

Order: decode -> resize (shorter side >= 640px) -> grayscale -> CLAHE contrast
enhancement -> adaptive threshold (only if lighting looks uneven AND the raw
image doesn't already look sharp/high-contrast) -> denoise (intensity tuned
by documentSource, since camera captures are noisier than clean uploads).
"""

import io

import cv2
import numpy as np
from PIL import Image

MIN_SHORT_SIDE = 640

# Tile is treated as blank/background rather than real content if its own
# internal std falls below this. Calibrated against rendered Thai text:
# background-only tiles measured std == 0.00 (clean synthetic renders) while
# every tile touching actual glyphs measured std >= ~53 (see the preprocessing
# calibration notes below _is_lighting_uneven). 15 sits with wide margin
# below the text-tile floor while comfortably clearing ordinary sensor noise
# on a real photo's paper/background (typically single-digit std).
_BLANK_TILE_STD = 15.0

# "Already good enough that adaptive-threshold's local binarization is more
# likely to destroy fine strokes than help" -- calibrated against 4 clean
# synthetic renders (std 52-70, laplacian_var 29-38) which all cleared these
# with margin, and meant to sit below any of them.
_HIGH_QUALITY_STD = 40.0
_HIGH_QUALITY_LAPLACIAN_VAR = 15.0


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
    Large spread between tiles indicates uneven lighting (shadows, glare).

    Blank/near-uniform tiles (std below _BLANK_TILE_STD) are excluded from
    the comparison first. Without this, a tile that's empty page margin
    reads near-white while a tile that happens to contain glyph ink reads
    darker purely because of text density/layout -- not lighting -- and on
    a short, tightly-cropped capture (a single name, a short phrase) that
    margin-vs-content gap alone can exceed the spread threshold on its own.
    Comparing only tiles that actually have content isolates genuine
    location-dependent brightness (shadow/glare) from that confound. If
    fewer than 2 tiles have real content (e.g. an almost entirely blank
    frame), falls back to comparing all tiles so a genuine lighting
    gradient across blank background can still be caught.
    """
    h, w = gray.shape[:2]
    tile_h, tile_w = max(1, h // 4), max(1, w // 4)
    all_means = []
    content_means = []
    for y in range(0, h, tile_h):
        for x in range(0, w, tile_w):
            tile = gray[y:y + tile_h, x:x + tile_w]
            if tile.size == 0:
                continue
            mean = float(tile.mean())
            all_means.append(mean)
            if float(tile.std()) >= _BLANK_TILE_STD:
                content_means.append(mean)

    means = content_means if len(content_means) >= 2 else all_means
    if len(means) < 2:
        return False
    return (max(means) - min(means)) > 55.0


def _is_already_high_quality(gray: np.ndarray) -> bool:
    """Second, independent safety net: even if _is_lighting_uneven() says
    uneven, skip adaptive-threshold when the raw image is already sharp and
    high-contrast -- local binarization is far more likely to clip the thin
    stacked strokes of Thai tone marks/vowels than to help an image that
    doesn't need it. Requires both good global contrast (std) and good
    sharpness (Laplacian variance) so a smeared-but-high-contrast or a
    sharp-but-washed-out image doesn't slip through either check alone."""
    std = float(gray.std())
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return std >= _HIGH_QUALITY_STD and laplacian_var >= _HIGH_QUALITY_LAPLACIAN_VAR


def preprocess(image_bytes: bytes, document_source: str = "upload") -> tuple:
    """Returns (preprocessed_img, scale) - see resize_min_side() for what scale means."""
    img = decode_image(image_bytes)
    img, scale = resize_min_side(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    if _is_lighting_uneven(enhanced) and not _is_already_high_quality(gray):
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
