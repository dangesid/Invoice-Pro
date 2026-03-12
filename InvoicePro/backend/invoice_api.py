# backend/invoice_api.py

import os
import json
import asyncio
import httpx
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.memory_store import memory_state
from backend.log_utils import app_logger
from backend.azure_invoice_process_functions import parse_file
from backend.config import Config

import chromadb
from chromadb.utils import embedding_functions

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

# ===============================
# FastAPI INIT
# ===============================
app = FastAPI(title="InvoicePro RAG API")

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
CHROMA_PATH = "processed_reports/chroma_db"
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
def ask_llm(query: str, context_chunks):
    if not context_chunks:
        return "No relevant info found."

    context_text = "\n\n".join(
        f"[{c['source']} p{c['page']}]\n{c['content']}"
        for c in context_chunks
    )

    system_prompt = (
        "You are an invoice assistant. Answer questions using ONLY the provided invoice context. "
        "Be specific and extract exact values (amounts, dates, names, line items) from the context. "
        "If the answer is not in the context, say 'Not found in the invoice.'"
    )
    user_prompt = f"Invoice context:\n{context_text}\n\nQuestion: {query}"

    if Config.MODEL_PROVIDER == "ollama":
        try:
            with httpx.Client(timeout=120.0) as client:
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
            app_logger.error("Ollama request timed out after 120s")
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


# ===============================
# ROUTES
# ===============================
@app.get("/health")
def health():
    active = memory_state.get_active_invoice()
    return {"status": "ok", "active_invoice": active or "none"}


@app.post("/ingest-file")
async def api_ingest_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        contents = await file.read()
        await file.close()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        app_logger.info(f"File saved to {file_path} ({len(contents)} bytes)")
        count = await asyncio.to_thread(ingest_file, file_path)
        return {
            "status": "success",
            "file": file.filename,
            "chunks": count,
            "message": f"Previous invoice cleared. Now chatting about: {file.filename}",
        }
    except Exception as e:
        app_logger.exception("API ingest failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def api_chat(req: ChatRequest):
    try:
        result = await asyncio.to_thread(chat, req.question)
        return result
    except Exception as e:
        app_logger.exception("API chat failed")
        raise HTTPException(status_code=500, detail=str(e))


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