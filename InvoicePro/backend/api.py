# backend/api.py

from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os

from backend.invoice_api import ingest_file, ingest_folder, chat

app = FastAPI(title="InvoicePro API")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# -----------------------------
# Health check
# -----------------------------
@app.get("/")
def root():
    return {"message": "InvoicePro API running"}


# -----------------------------
# Upload + ingest
# -----------------------------
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks = ingest_file(file_path)

        return {
            "message": "File uploaded and ingested",
            "file": file.filename,
            "chunks": chunks,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# Ingest entire folder
# -----------------------------
@app.post("/ingest-folder")
def ingest_all():
    return ingest_folder("uploads")


# -----------------------------
# Chat
# -----------------------------
@app.get("/chat")
def chat_endpoint(query: str):
    try:
        response = chat(query)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))