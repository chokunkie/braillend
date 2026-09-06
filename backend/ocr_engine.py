"""
EasyOCR wrapper. The reader is initialized once (module import) and reused
across requests, since loading the Thai+English recognition models is
expensive.
"""

import re
import statistics
from typing import Any, Dict, List

import cv2
import easyocr

# One EasyOCR reader per language set, built lazily and reused (loading the
# recognition models is expensive). "th+en" is the default; "th" is offered
# for Thai-only documents, where dropping the English character set removes a
# whole class of confusions (e.g. ก/n, ล/a, ธ/6) and measurably lifts
# accuracy on pure-Thai pages.
_readers: Dict[str, "easyocr.Reader"] = {}

_LANG_SETS = {
    "th": ["th"],
    "tha": ["th"],
    "en": ["en"],
    "eng": ["en"],
    "th+en": ["th", "en"],
    "tha+eng": ["th", "en"],
}


def get_reader(lang: str = "th+en") -> "easyocr.Reader":
    key = lang if lang in _LANG_SETS else "th+en"
    if key not in _readers:
        langs = _LANG_SETS[key]
        # NOTE: default path is still easyocr.Reader(["th", "en"], ...).
        _readers[key] = easyocr.Reader(langs, gpu=False, verbose=False)
    return _readers[key]


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


# Detections below this per-word confidence are treated as detector noise
# (stray marks on cluttered backgrounds -- solder pads, silkscreen, glare --
# misread as text) and excluded from the assembled text, though they're
# still returned in `words` so the inspector UI can show what was seen and
# rejected. Text run through a real camera/PCB shot regularly produces a
# handful of these alongside a correctly-read line; averaging them into the
# one overall-confidence gate let a good line get diluted by attached noise
# instead of being isolated and dropped on its own.
_MIN_WORD_CONFIDENCE = 35.0


def filter_confident_words(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drops detections below _MIN_WORD_CONFIDENCE - the noise this filters
    out never reaches assemble_text() or the overall-confidence average."""
    return [w for w in words if w["confidence"] >= _MIN_WORD_CONFIDENCE]


# A detection box shorter than this fraction of the tallest box on the page
# is treated as fine print / a logo caption rather than the subject text -
# e.g. photographing a sign whose headline reads fine but whose bottom strip
# of sponsor logos ("AIS Academy", "NIA", "okmd") gets misread and glued on
# as "als academy ni okmd". Only applied when there IS a clear headline to
# compare against, and small boxes that sit on the same line as a kept box
# are still kept.
_SMALL_BOX_HEIGHT_RATIO = 0.45
_BOTTOM_STRIP_FRAC = 0.12  # boxes whose centre is in the bottom 12% of the frame...
_BOTTOM_STRIP_MIN_ABOVE = 2  # ...are dropped only when this many boxes sit above them

_LETTER_RE = re.compile(r"[A-Za-zก-๏]")


def _letter_ratio(text: str) -> float:
    stripped = text.replace(" ", "")
    if not stripped:
        return 0.0
    return len(_LETTER_RE.findall(stripped)) / len(stripped)


def _looks_like_text(text: str, overall_confidence: float) -> bool:
    """Rejects results that are mostly digits/symbols with barely any real
    letters - i.e. OCR hallucinating '1 , 111 โ ) 1' out of wood grain.

    The confidence-only escape hatch is gone: once the detector thresholds
    were loosened to keep faint Thai diacritics, faint background noise
    started reading "confidently" too. A genuine pure-number OCR target -
    a phone number, an ID, an account number - is instead LONG, so the
    low-letter branch only lets through a string with a real run of digits.
    """
    if not text.strip():
        return False
    if _letter_ratio(text) >= 0.35:
        return True
    digits = sum(c.isdigit() for c in text)
    return digits >= 7 and overall_confidence >= 65.0


def _filter_layout_noise(words: List[Dict[str, Any]], img_height: float) -> List[Dict[str, Any]]:
    if len(words) < 3:
        return words

    heights = [w["bbox"]["y1"] - w["bbox"]["y0"] for w in words]
    max_h = max(heights) if heights else 0.0
    if max_h <= 0:
        return words

    big = [w for w in words if (w["bbox"]["y1"] - w["bbox"]["y0"]) >= _SMALL_BOX_HEIGHT_RATIO * max_h]
    if not big:
        return words

    def on_a_big_line(w: Dict[str, Any]) -> bool:
        return any(_vertical_overlap_ratio(w["bbox"], b["bbox"]) >= _LINE_OVERLAP_THRESHOLD for b in big)

    kept: List[Dict[str, Any]] = []
    for w in words:
        h = w["bbox"]["y1"] - w["bbox"]["y0"]
        y_centre = (w["bbox"]["y0"] + w["bbox"]["y1"]) / 2.0

        # tiny box that isn't riding along a headline line -> fine print
        if h < _SMALL_BOX_HEIGHT_RATIO * max_h and not on_a_big_line(w):
            continue
        # box parked in the bottom strip while real content sits above -> logo row
        if img_height > 0 and y_centre > img_height * (1.0 - _BOTTOM_STRIP_FRAC):
            above = sum(1 for o in words if o is not w and
                        ((o["bbox"]["y0"] + o["bbox"]["y1"]) / 2.0) < img_height * 0.80)
            if above >= _BOTTOM_STRIP_MIN_ABOVE and not on_a_big_line(w):
                continue
        kept.append(w)

    return kept if kept else words


# EasyOCR's recognizer has a sweet spot around 30-70px per glyph. Push text
# much bigger and the *detector* fragments a word into pieces and the
# recognizer drops characters - this is where "โชกุน -> เชกน", "พิตต้า ->
# พตตา", "สกาย -> สาย" came from (a clean upload whose ~90px glyphs got
# upscaled to ~180px by the old fixed resize). run_ocr() reads once, measures
# the text height it actually found, and if it's WELL outside the band,
# resizes toward ~46px/glyph and reads again - keeping the re-read only if it
# didn't lose text or confidence (multi-line pages with lots of context read
# fine at larger sizes and a downscale-then-reread can only hurt them).
_TARGET_GLYPH_PX = 46.0
_GLYPH_PX_LO = 30.0            # no-retry band (measured pass-1 median height)
_GLYPH_PX_HI = 70.0
_RETRY_TOO_SMALL = 22.0       # ...but only actually retry outside this wider margin
_RETRY_TOO_BIG = 92.0
_RESIZE_MIN = 0.12
_RESIZE_MAX = 2.8
# Only relevant when preprocess UPSCALED a small image (scale > 1): don't then
# crush it back down past ~35% of the original - that up-then-down round trip
# smears the thin Thai strokes worse than a slightly-too-large read. When
# preprocess downscaled a big photo (scale < 1) there's no round trip, so a
# further clean single downscale toward the sweet spot is fine.
_EFF_SCALE_FLOOR = 0.35


def _readtext(reader: "easyocr.Reader", image, allowlist: str = None):
    """One detection+recognition pass with Thai-tuned detector knobs: a
    slightly lower text_threshold so faint diacritic strokes stay in their
    box, a higher y_ths so an above/below vowel merges into its line instead
    of orphaning, a small add_margin so tone marks aren't clipped off the
    top. text_threshold isn't dropped hard - that also makes faint background
    noise read 'confidently'."""
    try:
        kwargs = {
            "decoder": "beamsearch",
            "paragraph": False,
            "text_threshold": 0.6,
            "y_ths": 1.5,
            "x_ths": 1.0,
            "add_margin": 0.1,
        }
        if allowlist:
            kwargs["allowlist"] = allowlist
        return reader.readtext(
            image,
            **kwargs,
        )
    except Exception:
        kwargs = {"decoder": "beamsearch", "paragraph": False}
        if allowlist:
            kwargs["allowlist"] = allowlist
        return reader.readtext(image, **kwargs)


def _median_glyph_height(raw_results) -> float:
    heights = []
    for box, text, _conf in raw_results:
        if not str(text).strip():
            continue
        ys = [p[1] for p in box]
        heights.append(max(ys) - min(ys))
    return float(statistics.median(heights)) if heights else 0.0


def _text_volume(raw_results) -> int:
    return sum(len(str(t).strip()) for _b, t, _c in raw_results)


def _mean_conf(raw_results) -> float:
    cs = [float(c) for _b, t, c in raw_results if str(t).strip()]
    return sum(cs) / len(cs) if cs else 0.0


def _confident_volume(raw_results) -> int:
    """Characters that would survive the downstream confidence filter. A
    re-read that keeps every box but drops one line's confidence through the
    floor loses volume HERE even though _text_volume() looks unchanged."""
    floor = _MIN_WORD_CONFIDENCE / 100.0
    return sum(len(str(t).strip()) for _b, t, c in raw_results
              if str(t).strip() and float(c) >= floor)


# A mixed Thai/English page must keep legitimate runs such as
# "เรียน OpenAI 2026". What is suspicious is a script switch *inside one
# whitespace-delimited token* ("wตตา") or a long repeated Latin run of the
# kind produced when Thai strokes fragment ("wnnnnnnส.e"). These are the two
# real failures this rescue targets; ordinary Thai and English words on the
# same line are deliberately left alone.
_THAI_CHAR_RE = re.compile(r"[ก-๏]")
_LATIN_CHAR_RE = re.compile(r"[A-Za-z]")
_REPEATED_LATIN_RE = re.compile(r"([A-Za-z])\1{3,}", re.IGNORECASE)
_THAI_LETTER_MARK_RE = re.compile(r"[\u0E01-\u0E3A\u0E40-\u0E4E]")
_THAI_COMBINING_RE = re.compile(r"[ัิีึืฺุู็่้๊๋์ํ๎]")
_THAI_ALLOWLIST = "".join(chr(c) for c in range(0x0E01, 0x0E5C)) + "0123456789 .,!?%()-/"


def _has_suspicious_script_mix(text: str) -> bool:
    """True for likely Thai-as-Latin hallucinations, not normal mixed text."""
    if not text:
        return False
    if _REPEATED_LATIN_RE.search(text):
        return True

    for token in re.findall(r"\S+", text):
        thai_count = len(_THAI_CHAR_RE.findall(token))
        latin_count = len(_LATIN_CHAR_RE.findall(token))
        if thai_count and latin_count:
            # A small Latin island surrounded by Thai is the common ก/n,
            # พ/w confusion. A genuine product/name such as "รุ่นiPhone"
            # has a substantial Latin run and is not rewritten automatically.
            if thai_count >= 2 and latin_count <= 3:
                return True
            latin = "".join(_LATIN_CHAR_RE.findall(token)).lower()
            if len(latin) >= 4 and len(set(latin)) <= 3:
                return True
    return False


def _has_separate_latin_token(text: str) -> bool:
    """True when a line contains an actual standalone English token.

    A Thai-only rescue is allowed for an embedded lookalike such as ``wตตา``
    but must never replace a whole genuinely mixed line such as
    ``ชื่อ Pete`` and thereby erase its English content.
    """
    return any(
        _LATIN_CHAR_RE.search(token) and not _THAI_CHAR_RE.search(token)
        for token in re.findall(r"\S+", text or "")
    )


def _raw_words(raw_results) -> List[Dict[str, Any]]:
    """EasyOCR tuples -> temporary word dictionaries in OCR-image space."""
    words = []
    for idx, (points, text, confidence) in enumerate(raw_results):
        text = str(text).strip()
        if not text:
            continue
        xs = [float(p[0]) for p in points]
        ys = [float(p[1]) for p in points]
        words.append({
            "text": text,
            "bbox": {"x0": min(xs), "y0": min(ys), "x1": max(xs), "y1": max(ys)},
            "confidence": float(confidence) * 100.0,
            "_raw_index": idx,
        })
    return words


def _offset_raw_results(raw_results, dx: float, dy: float):
    adjusted = []
    for points, text, confidence in raw_results:
        shifted = [[float(p[0]) + dx, float(p[1]) + dy] for p in points]
        adjusted.append((shifted, text, confidence))
    return adjusted


def _is_plausible_thai_extension(original: str, candidate: str) -> bool:
    """Whether a padded reread plausibly recovered omitted Thai glyphs.

    EasyOCR sometimes boxes only the baseline consonants, excluding stacked
    vowels/tone marks (and occasionally the final spacing vowel). We accept
    only a *longer* Thai candidate whose consonant skeleton preserves the
    original in order, adds at most one non-combining Thai character, and
    adds no more than three Thai code points overall. This intentionally
    cannot rewrite a same-length spelling guess.
    """
    original_chars = "".join(_THAI_LETTER_MARK_RE.findall(original or ""))
    candidate_chars = "".join(_THAI_LETTER_MARK_RE.findall(candidate or ""))
    if not original_chars or len(candidate_chars) <= len(original_chars):
        return False
    if len(candidate_chars) - len(original_chars) > 3:
        return False

    original_base = _THAI_COMBINING_RE.sub("", original_chars)
    candidate_base = _THAI_COMBINING_RE.sub("", candidate_chars)
    base_delta = len(candidate_base) - len(original_base)
    if not original_base or base_delta < 0 or base_delta > 1:
        return False
    if base_delta == 0:
        return candidate_base == original_base
    # The one permitted spacing character must extend the detected word at
    # its right edge (e.g. a missed final า). Never accept a new leading or
    # internal base glyph: that produced false rewrites such as พชร -> ไพัชรี
    # in a real regression fixture.
    return candidate_base.startswith(original_base)


def _recover_missing_thai_marks(raw_results, image, reader=None):
    """Reread Thai-only lines with a padded direct recognition box.

    Unlike ``readtext()``, ``Reader.recognize()`` uses the supplied rectangle
    directly. Extending that rectangle one line-height upward keeps detached
    สระ/วรรณยุกต์ inside the recognizer even when the detector omitted them.
    Accepted candidates are deliberately narrow (see the helper above) and
    are surfaced as rescued metadata so the frontend still asks the user to
    confirm before sending them to Braille.
    """
    words = _raw_words(raw_results)
    if not words:
        return raw_results, 0
    try:
        lines = _group_into_lines(words)
        img_h, img_w = image.shape[:2]
    except Exception:
        return raw_results, 0

    thai_reader = reader or get_reader("th")
    drop_indices = set()
    replacements = []
    recovered_lines = 0

    for line in lines:
        line_text = _join_line(line)
        if not _THAI_CHAR_RE.search(line_text) or _LATIN_CHAR_RE.search(line_text):
            continue

        x0 = min(w["bbox"]["x0"] for w in line)
        y0 = min(w["bbox"]["y0"] for w in line)
        x1 = max(w["bbox"]["x1"] for w in line)
        y1 = max(w["bbox"]["y1"] for w in line)
        line_w = max(1.0, x1 - x0)
        line_h = max(1.0, y1 - y0)
        side_pad = max(12.0, min(line_w * 0.30, line_h * 0.75))
        box = [
            max(0, int(x0 - side_pad)),
            min(img_w, int(x1 + side_pad)),
            max(0, int(y0 - line_h)),
            min(img_h, int(y1 + line_h * 0.30)),
        ]
        if box[1] - box[0] < 20 or box[3] - box[2] < 20:
            continue

        try:
            candidate_raw = thai_reader.recognize(
                image,
                horizontal_list=[box],
                free_list=[],
                decoder="beamsearch",
                allowlist=_THAI_ALLOWLIST,
                detail=1,
            )
        except Exception:
            continue

        candidate_words = filter_confident_words(_raw_words(candidate_raw))
        candidate_text = assemble_text(candidate_words)
        if (_LATIN_CHAR_RE.search(candidate_text)
                or _mean_conf(candidate_raw) < 0.45
                or not _is_plausible_thai_extension(line_text, candidate_text)):
            continue

        drop_indices.update(w["_raw_index"] for w in line)
        replacements.extend(candidate_raw)
        recovered_lines += 1

    if not recovered_lines:
        return raw_results, 0
    kept = [r for idx, r in enumerate(raw_results) if idx not in drop_indices]
    return kept + replacements, recovered_lines


def _rescue_suspicious_thai_lines(raw_results, image, reader=None):
    """Re-read only suspicious mixed-script lines with a Thai allowlist.

    The crop is padded heavily above the detected boxes so detached Thai
    vowels/tone marks remain available. A rescue is accepted only when it
    removes the script anomaly, keeps a reasonable amount of content, and
    has usable confidence. Legitimate separated Thai + English words never
    enter this path.
    """
    words = _raw_words(raw_results)
    if not words:
        return raw_results, 0

    try:
        lines = _group_into_lines(words)
        img_h, img_w = image.shape[:2]
    except Exception:
        return raw_results, 0

    suspicious_lines = [line for line in lines if _has_suspicious_script_mix(_join_line(line))]
    if not suspicious_lines:
        return raw_results, 0

    # A dedicated Thai reader is materially more accurate than applying a
    # Thai allowlist to the mixed reader. Run it once on the same full image
    # first: retaining page context proved more accurate on real name images
    # than immediately cutting a tight crop. The crop remains a fallback when
    # no corresponding Thai line can be aligned.
    thai_reader = reader or get_reader("th")
    try:
        thai_full_raw = _readtext(thai_reader, image, allowlist=_THAI_ALLOWLIST)
        thai_full_lines = _group_into_lines(_raw_words(thai_full_raw))
    except Exception:
        thai_full_raw = []
        thai_full_lines = []

    def line_rect(line):
        return {
            "x0": min(w["bbox"]["x0"] for w in line),
            "y0": min(w["bbox"]["y0"] for w in line),
            "x1": max(w["bbox"]["x1"] for w in line),
            "y1": max(w["bbox"]["y1"] for w in line),
        }

    def match_score(a, b):
        inter_x = max(0.0, min(a["x1"], b["x1"]) - max(a["x0"], b["x0"]))
        inter_y = max(0.0, min(a["y1"], b["y1"]) - max(a["y0"], b["y0"]))
        min_w = max(1.0, min(a["x1"] - a["x0"], b["x1"] - b["x0"]))
        min_h = max(1.0, min(a["y1"] - a["y0"], b["y1"] - b["y0"]))
        return (inter_y / min_h) * 2.0 + (inter_x / min_w)

    drop_indices = set()
    replacements = []
    rescued_lines = 0

    for line in suspicious_lines:
        line_text = _join_line(line)
        # The rescue replaces the complete detected line. Keep genuinely
        # mixed lines untouched and merely flag them for user confirmation;
        # otherwise a Thai pass could silently delete a real English word.
        if _has_separate_latin_token(line_text):
            continue

        x0 = min(w["bbox"]["x0"] for w in line)
        y0 = min(w["bbox"]["y0"] for w in line)
        x1 = max(w["bbox"]["x1"] for w in line)
        y1 = max(w["bbox"]["y1"] for w in line)
        line_w = max(1.0, x1 - x0)
        line_h = max(1.0, y1 - y0)
        cx0 = max(0, int(x0 - max(12.0, line_w * 0.10)))
        cx1 = min(img_w, int(x1 + max(12.0, line_w * 0.10)))
        cy0 = max(0, int(y0 - max(18.0, line_h * 0.70)))
        cy1 = min(img_h, int(y1 + max(12.0, line_h * 0.35)))
        rescue = []
        if thai_full_lines:
            original_rect = line_rect(line)
            matched_line = max(thai_full_lines, key=lambda candidate: match_score(original_rect, line_rect(candidate)))
            if match_score(original_rect, line_rect(matched_line)) >= 0.50:
                rescue = [thai_full_raw[w["_raw_index"]] for w in matched_line]

        if not rescue:
            if cx1 - cx0 < 20 or cy1 - cy0 < 20:
                continue
            try:
                rescue = _readtext(
                    thai_reader, image[cy0:cy1, cx0:cx1], allowlist=_THAI_ALLOWLIST
                )
            except Exception:
                continue
            rescue = _offset_raw_results(rescue, cx0, cy0)
        rescue_words = filter_confident_words(_raw_words(rescue))
        rescue_text = assemble_text(rescue_words)
        rescue_thai = len(_THAI_CHAR_RE.findall(rescue_text))
        rescue_latin = len(_LATIN_CHAR_RE.findall(rescue_text))
        original_content = max(1, len(_THAI_CHAR_RE.findall(line_text)) + len(_LATIN_CHAR_RE.findall(line_text)))
        rescue_content = rescue_thai + rescue_latin
        rescue_mean_conf = _mean_conf(rescue)

        if (rescue_thai >= 2
                and rescue_latin == 0
                and not _has_suspicious_script_mix(rescue_text)
                and rescue_content >= 0.35 * original_content
                and rescue_mean_conf >= 0.30):
            drop_indices.update(w["_raw_index"] for w in line)
            replacements.extend(rescue)
            rescued_lines += 1

    if not rescued_lines:
        return raw_results, 0
    kept = [r for idx, r in enumerate(raw_results) if idx not in drop_indices]
    return kept + replacements, rescued_lines


def run_ocr(image, scale: float = 1.0, lang: str = "th+en") -> Dict[str, Any]:
    reader = get_reader(lang)
    raw_results = _readtext(reader, image)

    factor = 1.0
    ocr_image = image
    med_h = _median_glyph_height(raw_results)
    if med_h > 0.0 and (med_h < _RETRY_TOO_SMALL or med_h > _RETRY_TOO_BIG):
        f = max(_RESIZE_MIN, min(_RESIZE_MAX, _TARGET_GLYPH_PX / med_h))
        if f < 1.0 and scale > 1.0:
            # preprocess upscaled - don't undo that and then some
            f = max(f, _EFF_SCALE_FLOOR / scale)
        if abs(f - 1.0) >= 0.15:
            try:
                interp = cv2.INTER_AREA if f < 1.0 else cv2.INTER_CUBIC
                resized = cv2.resize(image, None, fx=f, fy=f, interpolation=interp)
                retry = _readtext(reader, resized)
                # Accept the re-read only if it held onto the text that would
                # actually survive the downstream confidence filter. That
                # single check is what protects a multi-line page (a lossy
                # downscale-then-reread dropped one line to 0.2 confidence -
                # its characters stop counting here) WITHOUT also blocking the
                # far more common win: a single word that pass 1 read
                # confidently-but-WRONG at a huge size, replaced by a correct
                # re-read at the sweet spot (which often reads less
                # "confidently" than the wrong-but-sure original). The mean
                # confidence check is only a catastrophe backstop.
                if (_median_glyph_height(retry) > 0.0
                        and _confident_volume(retry) >= 0.7 * _confident_volume(raw_results)
                        and _mean_conf(retry) >= _mean_conf(raw_results) - 0.35):
                    raw_results, factor, ocr_image = retry, f, resized
            except Exception:
                pass

    normalized_lang = lang if lang in _LANG_SETS else "th+en"
    script_rescued_lines = 0
    if normalized_lang in ("th+en", "tha+eng"):
        raw_results, script_rescued_lines = _rescue_suspicious_thai_lines(
            raw_results, ocr_image
        )
        raw_results, recovered_lines = _recover_missing_thai_marks(
            raw_results, ocr_image
        )
    else:
        recovered_lines = 0

    rescued_lines = script_rescued_lines + recovered_lines

    eff_scale = scale * factor

    words = []
    for bbox_points, text, confidence in raw_results:
        text = text.strip()
        if not text:
            continue
        words.append(
            {
                "text": text,
                "bbox": _bbox_to_rect(bbox_points, eff_scale),
                "confidence": float(confidence) * 100.0,
            }
        )

    try:
        img_height = float(image.shape[0]) / scale if scale else float(image.shape[0])
    except Exception:
        img_height = 0.0

    kept_words = _filter_layout_noise(filter_confident_words(words), img_height)
    overall_confidence = (
        (sum(w["confidence"] for w in kept_words) / len(kept_words)) if kept_words else 0.0
    )

    text = assemble_text(kept_words)
    if not _looks_like_text(text, overall_confidence):
        text = ""

    suspicious = _has_suspicious_script_mix(text)
    warnings = []
    if suspicious:
        warnings.append("suspicious-script-mix")
    if script_rescued_lines:
        warnings.append("thai-line-rescued")
    if recovered_lines:
        warnings.append("thai-marks-recovered")

    return {
        "text": text,
        "confidence": overall_confidence,
        "words": words,
        "engine": "easyocr",
        "langUsed": normalized_lang,
        "rescuedLines": rescued_lines,
        "recoveredLines": recovered_lines,
        "suspicious": suspicious,
        "warnings": warnings,
        "failureReason": None if text else "no-text",
    }


# --- gap-aware text assembly ------------------------------------------------
#
# EasyOCR's detector (paragraph=False) returns one box per visually-grouped
# text region, not one box per linguistic word. Thai has no inter-word
# spacing, so a single word can get split across two detection boxes when
# stacked tone marks/vowels create an irregular horizontal gap that the
# detector reads as a region break. Blindly joining every box with " "
# turns that false split into a literal space (e.g. "ภานุวัฒน์" splits into
# "ภา" + "นุวัฒน์" and comes out as "ภา นุวัฒน์"). For a Braille reader a
# space is significant -- a blank cell means "separate word" -- so a false
# positive space is worse than two real words left glued together (which
# Thai text is routinely written/read without spaces anyway). So: group
# boxes into lines, then only insert a space between two adjacent boxes on
# a line when the horizontal gap between them clearly exceeds one
# character's width for that line. Anything borderline defaults to no
# space.

_LINE_OVERLAP_THRESHOLD = 0.4  # vertical-overlap fraction (of the shorter box) to call two boxes "same line"

# INTERIM value, calibrated against rendered-font text run through the real
# EasyOCR reader, not real photographs (see backend/test_ocr_text_assembly.py
# for the calibration harness). Two genuine inter-word gaps measured 0.365
# and 0.444x char width; this sits just below that floor so real sentence
# spaces survive, with a small margin. No genuine false-split-within-a-word
# case was reproducible in that calibration run (single Thai words, even
# heavily stacked ones, came back as one detection box every time), so the
# upper boundary of this value is still unvalidated against real data.
# Re-calibrate with actual camera-captured photos before trusting this near
# a production deploy -- real capture conditions (blur, angle, lighting)
# may shift the gap distribution in either direction.
_SPACE_GAP_RATIO = 0.35  # gap must exceed this multiple of the line's avg char width to count as a real space


def _vertical_overlap_ratio(a: Dict[str, float], b: Dict[str, float]) -> float:
    top = max(a["y0"], b["y0"])
    bottom = min(a["y1"], b["y1"])
    overlap = max(0.0, bottom - top)
    shorter = min(a["y1"] - a["y0"], b["y1"] - b["y0"])
    if shorter <= 0:
        return 0.0
    return overlap / shorter


def _group_into_lines(words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Clusters detection boxes into text lines by vertical overlap.

    Union-find so a box that transitively overlaps two others already
    judged to be on the same line joins that line too, even if it doesn't
    directly overlap both of them.
    """
    n = len(words)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        for j in range(i + 1, n):
            if _vertical_overlap_ratio(words[i]["bbox"], words[j]["bbox"]) >= _LINE_OVERLAP_THRESHOLD:
                union(i, j)

    clusters: Dict[int, List[Dict[str, Any]]] = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(words[i])

    lines = list(clusters.values())
    for line in lines:
        line.sort(key=lambda w: w["bbox"]["x0"])
    lines.sort(key=lambda line: sum((w["bbox"]["y0"] + w["bbox"]["y1"]) / 2 for w in line) / len(line))
    return lines


def _line_char_width(line: List[Dict[str, Any]]) -> float:
    """Estimates a typical glyph width for a line, as the unit gaps are
    judged against. Aggregated across the whole line (total box width /
    total character count) rather than per-box, since a single- or
    two-character box gives a noisy per-box estimate.

    Falls back to the line's *median* box height (not any one box's own
    height) if there's no text to measure width from. Median, not per-box,
    because stacked Thai tone marks/vowels (่ ้ ๊ ๋ ั ิ ี ึ ื ุ ู) make some
    boxes taller than others for the same logical text size -- using a
    single box's height would misjudge what "one character" looks like on
    this line.
    """
    total_width = 0.0
    total_chars = 0
    for w in line:
        bbox = w["bbox"]
        total_width += bbox["x1"] - bbox["x0"]
        total_chars += len(w["text"])

    if total_chars > 0:
        return total_width / total_chars

    heights = [w["bbox"]["y1"] - w["bbox"]["y0"] for w in line]
    return statistics.median(heights) if heights else 0.0


def _join_line(line: List[Dict[str, Any]]) -> str:
    if not line:
        return ""

    char_width = _line_char_width(line)
    parts = [line[0]["text"]]

    for prev, cur in zip(line, line[1:]):
        gap = cur["bbox"]["x0"] - prev["bbox"]["x1"]
        # Ties/borderline gaps default to NOT inserting a space (see module
        # docstring above): a missed space degrades gracefully, a spurious
        # one doesn't.
        if char_width > 0 and gap > _SPACE_GAP_RATIO * char_width:
            parts.append(" ")
        parts.append(cur["text"])

    return "".join(parts)


def assemble_text(words: List[Dict[str, Any]]) -> str:
    """Reassembles detection boxes into a single string, inserting spaces
    only where the horizontal gap between same-line boxes indicates a real
    word boundary rather than a detector split."""
    lines = _group_into_lines(words)
    return " ".join(_join_line(line) for line in lines)
