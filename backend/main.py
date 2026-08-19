from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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
async def ocr(image: UploadFile = File(...), documentSource: str = Form("upload")):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")

    try:
        processed, scale = preprocess(image_bytes, document_source=documentSource)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}")

    result = run_ocr(processed, scale=scale)
    return result


@app.get("/health")
async def health():
    return {"status": "ok"}
