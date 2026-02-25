# backend/azure_invoice_process_functions.py

import fitz  # pymupdf
import pandas as pd
from PIL import Image
import pytesseract
import io
import os
from pathlib import Path
from backend.log_utils import app_logger


SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def get_file_extension(file_path: str) -> str:
    return Path(file_path).suffix.lower()


def validate_file(file_path: str) -> bool:
    """Check if file exists and is a supported type."""
    if not os.path.exists(file_path):
        app_logger.error(f"File not found: {file_path}")
        return False
    ext = get_file_extension(file_path)
    if ext not in SUPPORTED_EXTENSIONS:
        app_logger.error(f"Unsupported file type: {ext}")
        return False
    return True


# ─── PDF Parser ───────────────────────────────────────────────
def parse_pdf(file_path: str) -> list[dict]:
    """Extract text from each page of a PDF."""
    app_logger.info(f"Parsing PDF: {file_path}")
    chunks = []
    try:
        doc = fitz.open(file_path)
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text().strip()
            if text:
                chunks.append({
                    "source": os.path.basename(file_path),
                    "page": page_num,
                    "content": text,
                })
        app_logger.info(f"PDF parsed: {len(chunks)} pages extracted from {file_path}")
    except Exception as e:
        app_logger.error(f"Failed to parse PDF {file_path}: {e}")
    return chunks


# ─── CSV Parser ───────────────────────────────────────────────
def parse_csv(file_path: str) -> list[dict]:
    """Convert CSV rows into text chunks."""
    app_logger.info(f"Parsing CSV: {file_path}")
    chunks = []
    try:
        df = pd.read_csv(file_path)
        df.columns = [str(c).strip() for c in df.columns]
        # Full table as one chunk
        chunks.append({
            "source": os.path.basename(file_path),
            "page": 1,
            "content": df.to_string(index=False),
        })
        app_logger.info(f"CSV parsed: {len(df)} rows from {file_path}")
    except Exception as e:
        app_logger.error(f"Failed to parse CSV {file_path}: {e}")
    return chunks


# ─── XLSX Parser ──────────────────────────────────────────────
def parse_xlsx(file_path: str) -> list[dict]:
    """Convert each sheet of an XLSX into text chunks."""
    app_logger.info(f"Parsing XLSX: {file_path}")
    chunks = []
    try:
        xl = pd.ExcelFile(file_path)
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            df.columns = [str(c).strip() for c in df.columns]
            content = df.to_string(index=False)
            if content.strip():
                chunks.append({
                    "source": os.path.basename(file_path),
                    "page": sheet_name,
                    "content": content,
                })
        app_logger.info(f"XLSX parsed: {len(chunks)} sheets from {file_path}")
    except Exception as e:
        app_logger.error(f"Failed to parse XLSX {file_path}: {e}")
    return chunks


# ─── Image Parser ─────────────────────────────────────────────
def parse_image(file_path: str) -> list[dict]:
    """Extract text from invoice images using OCR (pytesseract)."""
    app_logger.info(f"Parsing Image: {file_path}")
    chunks = []
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img).strip()
        if text:
            chunks.append({
                "source": os.path.basename(file_path),
                "page": 1,
                "content": text,
            })
            app_logger.info(f"Image parsed: text extracted from {file_path}")
        else:
            app_logger.warning(f"No text found in image: {file_path}")
    except Exception as e:
        app_logger.error(f"Failed to parse image {file_path}: {e}")
    return chunks


# ─── Master Parser ────────────────────────────────────────────
def parse_file(file_path: str) -> list[dict]:
    """
    Route file to the correct parser based on extension.
    Returns a list of chunks: [{ source, page, content }, ...]
    """
    if not validate_file(file_path):
        return []

    ext = get_file_extension(file_path)

    if ext == ".pdf":
        return parse_pdf(file_path)
    elif ext == ".csv":
        return parse_csv(file_path)
    elif ext in {".xlsx", ".xls"}:
        return parse_xlsx(file_path)
    elif ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        return parse_image(file_path)
    else:
        app_logger.error(f"No parser found for extension: {ext}")
        return []