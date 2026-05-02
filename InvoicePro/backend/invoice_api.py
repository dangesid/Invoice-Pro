# backend/invoice_api.py

import os
import json
import asyncio
import httpx
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.memory_store import memory_state
from backend.log_utils import app_logger
from backend.azure_invoice_process_functions import parse_file
from backend.config import Config
from backend.database import get_db, User, Invoice
from backend.auth import get_password_hash, verify_password, create_access_token, decode_access_token

import chromadb
from chromadb.utils import embedding_functions

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

# ===============================
# FastAPI INIT
# ===============================
app = FastAPI(title="InvoicePro RAG API")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ===============================
# AUTH UTILS
# ===============================
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Directory where extracted text JSONs are saved ──────────
EXTRACTED_TEXT_DIR = "extracted_text"
os.makedirs(EXTRACTED_TEXT_DIR, exist_ok=True)

# ===============================
# GLOBAL CHROMA
# ===============================
CHROMA_PATH = Config.CHROMA_PATH
COLLECTION_NAME = "invoices"

embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

os.makedirs(CHROMA_PATH, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedding_fn,
)

app_logger.info("✅ Chroma collection initialized (global)")


# ===============================
# CLEAR COLLECTION (single invoice mode)
# ===============================
def clear_collection():
    try:
        existing = collection.get()
        if existing and existing["ids"]:
            collection.delete(ids=existing["ids"])
            app_logger.info(f"🗑️ Cleared {len(existing['ids'])} old chunks from ChromaDB")
        else:
            app_logger.info("ChromaDB already empty — nothing to clear")
    except Exception as e:
        app_logger.warning(f"Failed to clear collection: {e}")


# ===============================
# SAVE EXTRACTED TEXT TO JSON
# ===============================
def save_extracted_text(file_path: str, chunks: list) -> str:
    """
    Persist extracted chunks to extracted_text/<filename>.json
    immediately after parsing, before ChromaDB ingestion.

    Schema:
    {
      "source_file": "invoice.pdf",
      "extracted_at": "2024-01-01T12:00:00Z",
      "total_chunks": 3,
      "chunks": [
        { "chunk_index": 0, "page": 1, "source": "...", "content": "..." },
        ...
      ]
    }
    """
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(EXTRACTED_TEXT_DIR, f"{base_name}_{timestamp}.json")

    payload = {
        "source_file": os.path.basename(file_path),
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "total_chunks": len(chunks),
        "chunks": [
            {
                "chunk_index": i,
                "page": chunk.get("page", i),
                "source": chunk.get("source", file_path),
                "content": chunk.get("content", ""),
            }
            for i, chunk in enumerate(chunks)
        ],
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    app_logger.info(f"💾 Extracted text saved → {out_path}")
    return out_path


# ===============================
# INGEST CORE LOGIC
# ===============================
def ingest_file(file_path: str) -> int:
    try:
        app_logger.info(f"Ingesting file: {file_path}")
        clear_collection()
        chunks = list(parse_file(file_path))

        if not chunks:
            app_logger.warning("No chunks extracted.")
            return 0

        # ── Save extracted text to JSON immediately ──────────
        save_extracted_text(file_path, chunks)

        documents, metadatas, ids = [], [], []
        for i, chunk in enumerate(chunks):
            doc_id = f"{os.path.basename(file_path)}_chunk_{i}"
            documents.append(chunk["content"])
            metadatas.append({
                "source": chunk.get("source", file_path),
                "page": str(chunk.get("page", i))
            })
            ids.append(doc_id)

        app_logger.info(f"Embedding + upsert starting ({len(documents)} chunks)")
        collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
        app_logger.info("Embedding + upsert DONE")
        memory_state.set_active_invoice(os.path.basename(file_path))
        return len(chunks)

    except Exception as e:
        app_logger.exception("Ingest pipeline failed")
        raise e


# ===============================
# RETRIEVE
# ===============================
def retrieve_context(query: str, n_results: int = 5):
    try:
        # Guard: don't query an empty collection (causes crash in some chroma versions)
        existing = collection.get()
        if not existing or not existing.get("ids"):
            app_logger.warning("ChromaDB collection is empty — nothing to retrieve")
            return []

        actual_n = min(n_results, len(existing["ids"]))
        results = collection.query(query_texts=[query], n_results=actual_n)

        contexts = []
        if not results:
            return contexts

        documents  = results.get("documents")  or [[]]
        metadatas  = results.get("metadatas")  or [[]]

        docs_list  = documents[0]  if documents  else []
        metas_list = metadatas[0]  if metadatas  else []

        for i, doc in enumerate(docs_list):
            # meta may be None for individual entries — guard each one
            meta = metas_list[i] if i < len(metas_list) else None
            meta = meta or {}
            contexts.append({
                "content": doc or "",
                "source":  meta.get("source", "unknown"),
                "page":    meta.get("page",   "?"),
            })

        return contexts
    except Exception as e:
        app_logger.exception(f"retrieve_context failed: {e}")
        return []
    

# ===============================
# LLM
# ===============================
def ask_llm(query: str, context_chunks, system_prompt: str = None):
    if not context_chunks:
        return "No relevant info found."

    context_text = "\n\n".join(
        f"[{c['source']} p{c['page']}]\n{c['content']}"
        for c in context_chunks
    )

    if not system_prompt:
        system_prompt = (
            "You are an invoice assistant. Answer questions using ONLY the provided invoice context. "
            "Be specific and extract exact values (amounts, dates, names, line items) from the context. "
            "If the answer to the question is not explicitly found in the context, your response MUST be "
            "exactly 'No {information} in invoice uploaded' where {information} is the subject of the question."
        )
    user_prompt = f"Invoice context:\n{context_text}\n\nQuestion: {query}"

    if Config.MODEL_PROVIDER == "ollama":
        try:
            with httpx.Client(timeout=300.0) as client:
                response = client.post(
                    f"{Config.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": Config.OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "stream": False,
                    },
                )
                response.raise_for_status()
                return response.json()["message"]["content"]
        except httpx.TimeoutException:
            app_logger.error("Ollama request timed out after 300s")
            return "LLM request timed out. Please try again."
        except Exception as e:
            app_logger.exception("Ollama request failed")
            return f"LLM error: {str(e)}"

    return "Model provider not configured"


# ===============================
# CHAT CORE LOGIC
# ===============================
def chat(query: str):
    try:
        active_invoice = memory_state.get_active_invoice()
    except Exception:
        active_invoice = None

    if not active_invoice:
        return {
            "query":   query,
            "answer":  "No document uploaded yet. Please upload a file first.",
            "sources": [],
        }

    context_chunks = retrieve_context(query)

    try:
        memory_state.set_last_interaction(query, context_chunks)
    except Exception:
        pass  # non-fatal

    answer = ask_llm(query, context_chunks)

    sources = [
        {"source": c.get("source", "unknown"), "page": c.get("page", "?")}
        for c in context_chunks
    ]

    result = {
        "query":          query,
        "answer":         answer,
        "active_invoice": active_invoice,
        "sources":        sources,
        "recommendations": [
            "Total amount due?",
            "List all line items",
            "What is the invoice date?",
            "Who is the vendor?"
        ]
    }

    try:
        memory_state.add_chat_turn(query, answer, sources)
    except Exception:
        pass  # non-fatal

    return result



# ===============================
# API MODELS
# ===============================
class ChatRequest(BaseModel):
    question: str

class UserAuth(BaseModel):
    email: str
    password: str
    name: str = None
    company: str = None
    role: str = None
    industry: str = None

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: str


# ===============================
# ROUTES
# ===============================
@app.post("/signup", response_model=Token)
def signup(user_data: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email, 
        hashed_password=hashed_pwd,
        name=user_data.name,
        company=user_data.company,
        role=user_data.role,
        industry=user_data.industry
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login", response_model=Token)
def login(user_data: UserAuth, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # For security, don't reveal if user exists, but here we can just say success
        return {"message": "If that email exists, a reset link has been sent."}
    
    # Mock email sending
    print(f"\n[EMAIL MOCK] To: {req.email}")
    print(f"[EMAIL MOCK] Subject: Password Reset Request")
    print(f"[EMAIL MOCK] Body: Hello {user.name or 'User'}, please click the link below to reset your password:")
    print(f"[EMAIL MOCK] Link: http://localhost:5173/reset-password?token=mock_token_for_{user.id}\n")
    
    return {"message": "Password reset link sent successfully!"}

@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "name": current_user.name,
        "company": current_user.company,
        "role": current_user.role,
        "industry": current_user.industry
    }

@app.get("/health")
def health():
    active = memory_state.get_active_invoice()
    return {"status": "ok", "active_invoice": active or "none"}


@app.post("/ingest-file")
async def api_ingest_file(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        contents = await file.read()
        await file.close()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        app_logger.info(f"File saved to {file_path} ({len(contents)} bytes)")
        count = await asyncio.to_thread(ingest_file, file_path)
        
        # ─── EXTRACTION LOGIC ──────────────────────────────────
        chunks = await asyncio.to_thread(parse_file, file_path)
        full_text = "\n".join([c["content"] for c in chunks])
        
        # Use LLM for structured extraction
        app_logger.info(f"LLM Extraction starting for {file.filename}...")
        # Hybrid Prompt: Guide AI to structured format but allow fallback
        prompt = (
            "Extract ALL invoice data into a structured JSON object. "
            "If JSON is difficult, use two Markdown tables (FIELDS and LINE_ITEMS).\n\n"
            "JSON STRUCTURE:\n"
            "{\n"
            "  \"Vendor_Name\": \"...\", \"Invoice_Date\": \"...\", \"Invoice_Number\": \"...\",\n"
            "  \"Total_Amount\": \"...\", \"Tax_Amount\": \"...\", \"Currency\": \"...\",\n"
            "  \"Line_Items\": [ [\"Desc\", \"Qty\", \"Price\", \"Total\"] ]\n"
            "}\n\n"
            f"TEXT TO EXTRACT:\n{full_text[:3000]}"
        )
        
        extraction_system_prompt = (
            "You are a specialized data extraction bot. Your ONLY job is to convert invoice text into a valid JSON object. "
            "Do not engage in conversation. Do not explain your actions. Return ONLY the JSON."
        )
        raw_extraction = await asyncio.to_thread(ask_llm, prompt, [{"content": full_text, "source": file.filename, "page": 1}], extraction_system_prompt)
        app_logger.info(f"LLM Extraction response received (length: {len(raw_extraction)})")
        
        extracted_data = {}
        
        # Helper: Smart field extractor from dict
        def get_val(d, keys):
            for k in keys:
                for dk in d.keys():
                    if k.lower().replace("_", " ").strip() == dk.lower().replace("_", " ").strip():
                        return d[dk]
            return None

        # 1. TRY JSON PARSE FIRST
        try:
            start = raw_extraction.find("{")
            end = raw_extraction.rfind("}") + 1
            if start != -1 and end != -1:
                json_str = raw_extraction[start:end]
                # Cleanup common LLM JSON errors
                import re
                json_str = re.sub(r'(?<=[:",\[])\s*\n\s*(?=[^\]\},])', ' ', json_str)
                data = json.loads(json_str)
                
                sections = []
                v_name = get_val(data, ["Vendor_Name", "Vendor", "Seller"])
                v_addr = get_val(data, ["Vendor_Address", "Address"])
                if v_name: sections.append({"section": "Vendor Information", "fields": [{"key": "Vendor", "value": v_name}, {"key": "Address", "value": v_addr or "N/A"}]})
                
                i_num = get_val(data, ["Invoice_Number", "Invoice #", "Bill #"])
                i_date = get_val(data, ["Invoice_Date", "Date"])
                if i_num or i_date: sections.append({"section": "Document Details", "fields": [{"key": "Invoice #", "value": i_num or "N/A"}, {"key": "Date", "value": i_date or "N/A"}]})
                
                t_amt = get_val(data, ["Total_Amount", "Total", "Grand Total"])
                t_tax = get_val(data, ["Tax_Amount", "Tax", "GST"])
                if t_amt: sections.append({"section": "Financial Totals", "fields": [{"key": "Total", "value": t_amt}, {"key": "Tax", "value": t_tax or "0.00"}]})

                extracted_data = {
                    "sections": sections,
                    "line_items": {"headers": ["Description", "Qty", "Price", "Total"], "rows": get_val(data, ["Line_Items", "Items"]) or []},
                    "summary": f"Invoice from {v_name or 'Unknown'} for {t_amt or 'N/A'}."
                }
                app_logger.info("✅ JSON extraction successful")
        except Exception as e:
            app_logger.warning(f"JSON parse failed, falling back to Markdown: {e}")

        # 2. FALLBACK TO MARKDOWN TABLES IF JSON FAILED
        if not extracted_data or not extracted_data.get("sections"):
            app_logger.info("Parsing Markdown fallback...")
            def parse_md_table(text, title_marker):
                start = text.find(title_marker)
                if start == -1: return []
                lines = text[start:].split("\n")
                rows = []
                for line in lines:
                    if "|" in line and "---" not in line:
                        cols = [c.strip() for c in line.split("|") if c.strip()]
                        if cols: rows.append(cols)
                return rows[1:] if rows else []

            field_rows = parse_md_table(raw_extraction, "TABLE 1") or parse_md_table(raw_extraction, "FIELDS")
            item_rows  = parse_md_table(raw_extraction, "TABLE 2") or parse_md_table(raw_extraction, "LINE_ITEMS")

            if field_rows:
                fields = [{"key": r[0], "value": r[1]} for r in field_rows if len(r) >= 2]
                extracted_data = {
                    "sections": [{"section": "Extracted Details", "fields": fields}],
                    "line_items": {"headers": ["Item", "Qty", "Price", "Total"], "rows": [r for r in item_rows if len(r) >= 2]},
                    "summary": "Data extracted from Markdown tables."
                }
                app_logger.info("✅ Markdown extraction successful")

        # 3. FINAL FALLBACK: RAW DATA (If everything failed)
        if not extracted_data or not extracted_data.get("sections"):
            extracted_data = {
                "sections": [{"section": "Raw Content", "fields": [{"key": "Data", "value": raw_extraction[:300] + "..."}]}],
                "summary": "AI returned unstructured response."
            }
            app_logger.info("⚠️ Falling back to raw data display")

        # Generate a quick summary for database storage
        summary_val = extracted_data.get("summary")
        if isinstance(summary_val, dict):
            summary_text = json.dumps(summary_val)
        else:
            summary_text = str(summary_val or "Invoice uploaded.")

        db_invoice = Invoice(
            filename=file.filename,
            user_id=current_user.id,
            analysis_summary=summary_text
        )
        db = next(get_db())
        db.add(db_invoice)
        db.commit()
        db.refresh(db_invoice)

        return {
            "status": "success",
            "file": file.filename,
            "chunks": count,
            "invoice_id": db_invoice.id,
            "summary": summary_text,
            "extracted_data": extracted_data,
            "message": f"Processed: {file.filename}",
        }
    except Exception as e:
        app_logger.exception("API ingest failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def api_chat(
    req: ChatRequest, 
    current_user: User = Depends(get_current_user)
):
    try:
        result = await asyncio.to_thread(chat, req.question)
        return result
    except Exception as e:
        app_logger.exception("API chat failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract")
async def api_extract(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        # Ensure file exists (it should have been uploaded by ingest-file just before)
        if not os.path.exists(file_path):
            contents = await file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(contents)
        
        chunks = await asyncio.to_thread(parse_file, file_path)
        if not chunks:
            raise HTTPException(status_code=400, detail="Could not extract text from file")
            
        full_text = "\n".join([c["content"] for c in chunks])
        
        # Use LLM to extract structured data
        prompt = (
            "Extract structured data from this invoice text. Return ONLY a JSON object with this structure: "
            "{ \"sections\": [ { \"section\": \"SECTION_NAME\", \"fields\": [ { \"key\": \"FIELD_NAME\", \"value\": \"VALUE\" } ] } ], "
            "\"line_items\": { \"headers\": [\"COL1\", \"COL2\"], \"rows\": [ [\"VAL1\", \"VAL2\"] ] }, \"summary\": \"BRIEF_SUMMARY\" }. "
            "Focus on Document Info, Vendor Info, Client Info, and Totals. "
            f"Invoice Text:\n{full_text[:4000]}" # Limit text to avoid token limits
        )
        
        extraction_system_prompt = (
            "You are a specialized data extraction bot. Your ONLY job is to convert invoice text into a valid JSON object. "
            "Do not engage in conversation. Do not explain your actions. Return ONLY the JSON."
        )
        raw_extraction = await asyncio.to_thread(ask_llm, prompt, [{"content": full_text, "source": file.filename, "page": 1}], extraction_system_prompt)
        
        # Try to parse the JSON from LLM response
        try:
            # Find the first { and last } to extract JSON if LLM added text
            start = raw_extraction.find("{")
            end = raw_extraction.rfind("}") + 1
            if start != -1 and end != -1:
                json_str = raw_extraction[start:end]
                extracted_data = json.loads(json_str)
            else:
                raise ValueError("No JSON found in LLM response")
        except Exception:
            # Fallback if LLM fails to provide valid JSON
            app_logger.error(f"LLM failed to provide valid JSON for extraction: {raw_extraction}")
            extracted_data = {
                "sections": [{"section": "Error", "fields": [{"key": "Status", "value": "LLM failed to structure data"}]}],
                "summary": "Manual review required."
            }
            
        return extracted_data
    except Exception as e:
        app_logger.exception("API extract failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/invoices")
def list_invoices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.upload_date.desc()).all()
    return [{
        "id": inv.id,
        "filename": inv.filename,
        "upload_date": inv.upload_date.isoformat(),
        "summary": inv.analysis_summary
    } for inv in invoices]

@app.delete("/invoices")
def clear_invoices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Invoice).filter(Invoice.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All invoices cleared successfully"}

@app.get("/invoices/{invoice_id}/download")
def download_analysis(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fpdf import FPDF
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == current_user.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(200, 10, txt="Invoice Analysis Report", ln=True, align='C')
    pdf.ln(10)
    
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Filename: {invoice.filename}", ln=True)
    pdf.cell(200, 10, txt=f"Upload Date: {invoice.upload_date.strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
    pdf.ln(10)
    
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(200, 10, txt="Summary Analysis", ln=True)
    pdf.set_font("Arial", size=11)
    
    # Clean up summary text
    summary_text = invoice.analysis_summary or "No summary available."
    pdf.multi_cell(0, 10, txt=summary_text)
    
    from tempfile import NamedTemporaryFile
    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        pdf.output(tmp.name)
        tmp_path = tmp.name
        
    from fastapi.responses import FileResponse
    return FileResponse(tmp_path, filename=f"Analysis_{invoice.filename}.pdf", media_type="application/pdf")


# ===============================
# STARTUP
# ===============================
@app.on_event("startup")
async def startup_event():
    app_logger.info("🚀 Server started. Pre-warming Ollama model...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{Config.OLLAMA_BASE_URL}/api/generate",
                json={"model": Config.OLLAMA_MODEL, "prompt": "hi", "stream": False},
            )
        app_logger.info("✅ Ollama model pre-warmed")
    except Exception as e:
        app_logger.warning(f"Model pre-warm failed (non-fatal): {e}")