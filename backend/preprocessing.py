"""
Image preprocessing pipeline for Thai-focused EasyOCR accuracy.

Order: decode -> detect document quad & perspective-warp (deskew) -> resize
into coarse bounds (short side >= 640 with a gentle upscale cap, long side
<= 2800; run_ocr does the precise OCR-optimal sizing later) -> grayscale ->
CLAHE contrast enhancement
(skipped entirely on a crisp black-on-white image) -> adaptive threshold
(only on a non-clean image whose lighting looks uneven AND that isn't
already sharp/high-contrast) -> denoise (intensity tuned by documentSource,
since camera captures are noisier than clean uploads).

preprocess() returns (processed_img, scale, warped_preview_data_url). The
third value is a JPEG data URL of the perspective-corrected colour image
when a document quad was found and warped (so the frontend can show the
"scanned" page and draw bounding boxes that actually line up), or None when
no warp was applied.
"""

import base64
import io

import cv2
import numpy as np
from PIL import Image

# Coarse bounds only. This step no longer tries to hit an OCR-optimal glyph
# size - run_ocr() does that precisely by measuring the detected text height
# and re-running at ~46px/glyph (EasyOCR's sweet spot). It only has to make
# sure the first detection pass has enough pixels to find the text (a low
# floor) without a huge image making that pass slow (a ceiling), and it must
# UPSCALE GENTLY: if this step doubles a small image and run_ocr then has to
# halve it again, that up-then-down round trip smears the thin Thai strokes.
#
# History: was 1100, chosen to upscale tightly-cropped phone captures whose
# glyphs fell to ~12-18px. But 1100 *upscales a clean single-word upload*
# (~90px glyphs -> ~180px) straight into EasyOCR's fragmentation zone
# (>~70px/glyph), which is where "โชกุน -> เชกน", "พิตต้า -> พตตา" came from.
MIN_SHORT_SIDE = 640
MAX_LONG_SIDE = 2800
MAX_UPSCALE = 1.8

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

# A crisp black-on-white scan/screenshot/render has a strongly bimodal
# histogram - almost every pixel is near-white paper or near-black ink, very
# few mid-greys. On an image like that both CLAHE and adaptive-threshold do
# nothing useful and actively eat the hairline strokes of Thai vowels / tone
# marks (ิ ี ึ ื ่ ้). This catches those even when they carry a big white
# margin that drags global std below _HIGH_QUALITY_STD (a single word on a
# page), which the std/Laplacian gate alone misses.
_BILEVEL_MIDTONE_MAX_FRAC = 0.06  # fraction of pixels allowed in the [64,192] mid-band


def decode_image(image_bytes: bytes) -> np.ndarray:
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb = np.array(pil_img)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


# --- document quad detection & perspective correction ----------------------
#
# The frontend guide frame is a visual aid only - it never crops to the real
# page. A photo taken at an angle leaves the text keystoned, which hurts the
# recognizer far more than a bit of blur. Here we look for the largest
# 4-sided convex contour that plausibly is the sheet of paper and warp it
# flat. Deliberately conservative: if nothing clean is found we return the
# frame untouched rather than risk warping to a book spine / table edge.

_QUAD_MIN_AREA_FRAC = 0.18   # quad must cover at least this fraction of the frame
_QUAD_MAX_AREA_FRAC = 0.985  # ...but not (essentially) the whole frame - that's just "no border visible"


def _order_quad(pts: np.ndarray) -> np.ndarray:
    """Orders 4 points as [top-left, top-right, bottom-right, bottom-left]."""
    pts = pts.reshape(4, 2).astype("float32")
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    d = np.diff(pts, axis=1).ravel()
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect


def detect_document_quad(img: np.ndarray):
    """Returns a (4,2) float32 corner array for the document sheet, or None."""
    h, w = img.shape[:2]
    area_img = float(h * w)
    if area_img <= 0:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 60, 180)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_area = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < _QUAD_MIN_AREA_FRAC * area_img or area > _QUAD_MAX_AREA_FRAC * area_img:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        if area > best_area:
            best_area = area
            best = approx

    return _order_quad(best) if best is not None else None


def warp_document(img: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Perspective-warps the quad region of img to a flat rectangle."""
    rect = _order_quad(quad)
    tl, tr, br, bl = rect
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    if width < 80 or height < 80:
        return img
    dst = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, matrix, (width, height))


def _to_jpeg_data_url(bgr_img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", bgr_img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def resize_min_side(img: np.ndarray, min_side: int = MIN_SHORT_SIDE,
                    max_side: int = MAX_LONG_SIDE) -> tuple:
    """Clamps the image into [min_side (short), max_side (long)] and returns
    (resized_img, scale). scale is 1.0 when no resize was needed - callers
    must divide bbox coordinates by scale to map back to the original
    (pre-resize) image the frontend inspector actually displays.

    Upscales a too-small image so the detection pass has pixels to work with;
    downscales a huge one for speed. It does NOT chase an OCR-optimal glyph
    size - run_ocr() does that afterwards from the measured text height."""
    h, w = img.shape[:2]
    short_side = min(h, w)
    long_side = max(h, w)
    if short_side == 0:
        return img, 1.0

    scale = 1.0
    if short_side < min_side:
        scale = min(min_side / short_side, MAX_UPSCALE)
    elif long_side > max_side:
        scale = max_side / long_side

    if abs(scale - 1.0) < 0.02:
        return img, 1.0
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
    return cv2.resize(img, (new_w, new_h), interpolation=interp), scale


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


def _is_clean_bilevel(gray: np.ndarray) -> bool:
    """True for a crisp black-on-white image (scan / screenshot / render):
    histogram strongly bimodal, so contrast/threshold enhancement can only
    hurt the thin Thai diacritic strokes."""
    total = gray.size
    if total == 0:
        return False
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    midtone_frac = float(hist[64:192].sum()) / float(total)
    return midtone_frac < _BILEVEL_MIDTONE_MAX_FRAC


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
    """Returns (preprocessed_img, scale, warped_preview_data_url).

    See resize_min_side() for what scale means. warped_preview_data_url is a
    JPEG data URL of the deskewed colour page when a document quad was found
    and warped (bbox coords the caller returns are in that image's space,
    divided by scale), else None.
    """
    img = decode_image(image_bytes)

    warped_preview = None
    try:
        quad = detect_document_quad(img)
        if quad is not None:
            candidate = warp_document(img, quad)
            ch, cw = candidate.shape[:2]
            if ch >= 80 and cw >= 80:
                img = candidate
                warped_preview = _to_jpeg_data_url(img) or None
    except Exception:
        # Deskew is best-effort - never fail the whole request over it.
        warped_preview = None

    img, scale = resize_min_side(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # A crisp black-on-white image is left untouched - CLAHE and adaptive
    # threshold only erode the hairline Thai diacritic strokes on an image
    # that has nothing to fix. Contrast/threshold work stays for real
    # photographs (uneven light, low contrast, glare).
    clean = _is_clean_bilevel(gray)
    if clean:
        enhanced = gray
    else:
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

    if not clean and _is_lighting_uneven(enhanced) and not _is_already_high_quality(gray):
        enhanced = cv2.adaptiveThreshold(
            enhanced,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=10,
        )

    is_camera = document_source == "camera"
    if is_camera:
        denoise_strength = 6
        denoised = cv2.fastNlMeansDenoising(
            enhanced, h=denoise_strength, templateWindowSize=7, searchWindowSize=21
        )
        return denoised, scale, warped_preview

    return enhanced, scale, warped_preview
