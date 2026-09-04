import os
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ocr_engine import run_ocr
from preprocessing import preprocess

app = FastAPI(title="BraillLens OCR Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/ocr")
async def ocr(
    image: UploadFile = File(...),
    documentSource: str = Form("upload"),
    lang: str = Form("th+en"),
):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")

    try:
        processed, scale, warped_preview = preprocess(
            image_bytes, document_source=documentSource
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}")

    result = run_ocr(processed, scale=scale, lang=lang)
    if warped_preview:
        # Perspective-corrected page; the frontend uses this as the preview
        # it draws bounding boxes on so the boxes line up with the text.
        result["warped"] = True
        result["warpedImage"] = warped_preview
    return result


@app.get("/health")
async def health():
    return {"status": "ok"}


# Mount static files so frontend and backend run seamlessly on port 8000
_workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.exists(_workspace_root):
    app.mount("/", StaticFiles(directory=_workspace_root, html=True), name="static")

