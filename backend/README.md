# BraillLens OCR Backend (EasyOCR, Thai + English)

FastAPI service that replaces the old in-browser Tesseract.js OCR with
EasyOCR, focused on Thai accuracy. Preprocesses images with OpenCV/Pillow
(document-quad detection + perspective warp to deskew, resize so the short
side is >= 1100px, CLAHE contrast, adaptive threshold when lighting is
uneven, and source-aware denoising) before running EasyOCR. A reader is
cached per language set - `th+en` (default) or `th` only, which is more
accurate on pure-Thai pages.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

First run downloads the EasyOCR detection + Thai/English recognition
model weights (~100MB) in addition to the PyTorch install above -
expect the first `pip install` and the first OCR request to each take
a while.

## Run

```bash
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

The server listens on `http://localhost:8000`. `js/ocr.js` on the
frontend is hardcoded to POST to `http://localhost:8000/ocr` - update
`OCR_BACKEND_URL` there if you run the backend elsewhere.

## API

`POST /ocr` - multipart form:
- `image`: image file (JPEG/PNG)
- `documentSource`: `"upload"` or `"camera"` (tunes preprocessing intensity only)
- `lang`: `"th+en"` (default) or `"th"` (Thai-only recognition)

Response:
```json
{
  "text": "string",
  "confidence": 87.5,
  "words": [
    { "text": "string", "bbox": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 }, "confidence": 91.2 }
  ],
  "warped": true,
  "warpedImage": "data:image/jpeg;base64,..."
}
```

`warped` / `warpedImage` are present only when a document quad was found and
perspective-corrected; bbox coordinates are then in the warped image's space.

`GET /health` - liveness check.
