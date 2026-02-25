# backend/invoice_api.py

import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"
import chromadb
from chromadb.utils import embedding_functions
from backend.config import Config
from backend.log_utils import app_logger
from backend.azure_invoice_process_functions import parse_file

# ─── Batch Ingest from Folder ─────────────────────────────────
def ingest_folder(folder_path: str = "uploads") -> dict:
    """
    Scan a folder and ingest all supported files into ChromaDB.
    Returns summary of what was ingested.
    """
    supported = {".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
    summary = {"success": [], "failed": [], "skipped": []}

    if not os.path.exists(folder_path):
        app_logger.warning(f"Folder not found: {folder_path}")
        return summary

    files = [f for f in os.listdir(folder_path) if os.path.splitext(f)[1].lower() in supported]

    if not files:
        app_logger.warning(f"No supported files found in: {folder_path}")
        return summary

    for filename in files:
        file_path = os.path.join(folder_path, filename)
        try:
            count = ingest_file(file_path)
            if count > 0:
                summary["success"].append({"file": filename, "chunks": count})
            else:
                summary["skipped"].append(filename)
        except Exception as e:
            app_logger.error(f"Failed to ingest {filename}: {e}")
            summary["failed"].append({"file": filename, "error": str(e)})

    app_logger.info(f"Folder ingest complete: {len(summary['success'])} success, {len(summary['failed'])} failed, {len(summary['skipped'])} skipped")
    return summary

# ─── ChromaDB Setup ───────────────────────────────────────────
CHROMA_PATH = "processed_reports/chroma_db"
COLLECTION_NAME = "invoices"

# Local sentence-transformer embeddings (no API call needed)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


def get_chroma_collection():
    """Initialize ChromaDB client and return the invoices collection."""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
    )
    return collection


# ─── Ingest ───────────────────────────────────────────────────
def ingest_file(file_path: str) -> int:
    """
    Parse a file and store its chunks in ChromaDB.
    Returns number of chunks ingested.
    """
    app_logger.info(f"Ingesting file: {file_path}")
    chunks = parse_file(file_path)

    if not chunks:
        app_logger.warning(f"No chunks extracted from: {file_path}")
        return 0

    collection = get_chroma_collection()

    documents = []
    metadatas = []
    ids = []

    for i, chunk in enumerate(chunks):
        doc_id = f"{os.path.basename(file_path)}_chunk_{i}"
        documents.append(chunk["content"])
        metadatas.append({
            "source": chunk["source"],
            "page": str(chunk["page"]),
        })
        ids.append(doc_id)

    # Upsert so re-uploading same file doesn't duplicate
    collection.upsert(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
    )

    app_logger.info(f"Ingested {len(chunks)} chunks from {file_path}")
    return len(chunks)


# ─── Retrieve ─────────────────────────────────────────────────
def retrieve_context(query: str, n_results: int = 5) -> list[dict]:
    """
    Retrieve the most relevant chunks from ChromaDB for a query.
    """
    collection = get_chroma_collection()
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
    )

    contexts = []
    if results and results["documents"]:
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            contexts.append({
                "content": doc,
                "source": meta.get("source", "unknown"),
                "page": meta.get("page", "?"),
            })

    app_logger.info(f"Retrieved {len(contexts)} context chunks for query: '{query}'")
    return contexts


# ─── LLM Call ─────────────────────────────────────────────────
def ask_llm(query: str, context_chunks: list[dict]) -> str:
    """
    Send query + retrieved context to Ollama or Azure.
    Strictly instructs the model to answer only from context.
    """
    if not context_chunks:
        return "I could not find any relevant information in the uploaded documents to answer your question."

    # Build context string
    context_text = "\n\n".join([
        f"[Source: {c['source']} | Page: {c['page']}]\n{c['content']}"
        for c in context_chunks
    ])

    system_prompt = """You are an invoice analysis assistant.
Your job is to answer questions STRICTLY based on the document context provided below.
Rules:
- NEVER make up or guess any information.
- If the answer is not found in the context, say: "I could not find this information in the uploaded documents."
- Always mention the source file and page number when referencing data.
- Be concise and precise."""

    user_prompt = f"""Context from uploaded documents:
---
{context_text}
---

Question: {query}

Answer strictly based on the context above:"""

    # ─── Ollama ──────────────────────────────────────────────
    if Config.MODEL_PROVIDER == "ollama":
        import ollama
        app_logger.info(f"Calling Ollama model: {Config.OLLAMA_MODEL}")
        response = ollama.chat(
            model=Config.OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response["message"]["content"]

    # ─── Azure OpenAI ────────────────────────────────────────
    elif Config.MODEL_PROVIDER == "azure":
        from openai import AzureOpenAI
        app_logger.info(f"Calling Azure deployment: {Config.AZURE_OPENAI_DEPLOYMENT}")
        client = AzureOpenAI(
            api_key=Config.AZURE_OPENAI_API_KEY,
            azure_endpoint=Config.AZURE_OPENAI_ENDPOINT,
            api_version=Config.AZURE_OPENAI_API_VERSION,
        )
        response = client.chat.completions.create(
            model=Config.AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content

    else:
        raise ValueError(f"Unknown MODEL_PROVIDER: {Config.MODEL_PROVIDER}")


# ─── Main Chat Function ───────────────────────────────────────
def chat(query: str) -> dict:
    """
    Full RAG pipeline: retrieve context → ask LLM → return answer.
    """
    app_logger.info(f"Chat query: '{query}'")
    context_chunks = retrieve_context(query)
    answer = ask_llm(query, context_chunks)
    return {
        "query": query,
        "answer": answer,
        "sources": [{"source": c["source"], "page": c["page"]} for c in context_chunks],
    }
