# streamlit_ui.py

import os
import shutil
import streamlit as st
from backend.invoice_api import ingest_file, chat
from backend.config import Config

# ─── Page Config ──────────────────────────────────────────────
st.set_page_config(
    page_title="InvoicePro AI",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Custom CSS ───────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');

    /* ── Root & Background ── */
    html, body, [class*="css"] {
        font-family: 'IBM Plex Sans', sans-serif;
        background-color: #0f1117;
        color: #e2e8f0;
    }

    .stApp {
        background-color: #0f1117;
    }

    /* ── Sidebar ── */
    [data-testid="stSidebar"] {
        background-color: #161b27;
        border-right: 1px solid #2d3748;
    }

    [data-testid="stSidebar"] .block-container {
        padding-top: 2rem;
    }

    /* ── Header ── */
    .header-container {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 1.5rem 0 1rem 0;
        border-bottom: 1px solid #2d3748;
        margin-bottom: 1.5rem;
    }

    .header-icon {
        font-size: 2rem;
    }

    .header-title {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 1.6rem;
        font-weight: 600;
        color: #f0f4ff;
        letter-spacing: -0.5px;
    }

    .header-subtitle {
        font-size: 0.78rem;
        color: #64748b;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-top: 2px;
    }

    /* ── Provider Badge ── */
    .provider-badge {
        display: inline-block;
        background: #1e2a3a;
        border: 1px solid #2d4a6e;
        border-radius: 6px;
        padding: 4px 10px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.72rem;
        color: #60a5fa;
        margin-bottom: 1rem;
    }

    /* ── Upload Area ── */
    .upload-section {
        background: #161b27;
        border: 1px dashed #2d3748;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: border-color 0.2s;
    }

    .upload-section:hover {
        border-color: #4a6fa5;
    }

    .section-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.72rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 0.75rem;
    }

    /* ── File Card ── */
    .file-card {
        background: #1a2235;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 10px 14px;
        margin: 6px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.82rem;
    }

    .file-card-success {
        border-left: 3px solid #22c55e;
    }

    .file-card-error {
        border-left: 3px solid #ef4444;
    }

    /* ── Chat Container ── */
    .chat-container {
        background: #161b27;
        border: 1px solid #2d3748;
        border-radius: 12px;
        padding: 1.5rem;
        min-height: 400px;
        max-height: 560px;
        overflow-y: auto;
        margin-bottom: 1rem;
    }

    /* ── Chat Messages ── */
    .msg-user {
        display: flex;
        justify-content: flex-end;
        margin: 12px 0;
    }

    .msg-user-bubble {
        background: #1e3a5f;
        border: 1px solid #2d4a6e;
        border-radius: 12px 12px 2px 12px;
        padding: 10px 16px;
        max-width: 75%;
        font-size: 0.9rem;
        color: #e2e8f0;
        line-height: 1.5;
    }

    .msg-bot {
        display: flex;
        justify-content: flex-start;
        margin: 12px 0;
        gap: 10px;
    }

    .msg-bot-avatar {
        width: 30px;
        height: 30px;
        background: #1a3a2a;
        border: 1px solid #22c55e33;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .msg-bot-bubble {
        background: #1a2235;
        border: 1px solid #2d3748;
        border-radius: 2px 12px 12px 12px;
        padding: 10px 16px;
        max-width: 75%;
        font-size: 0.9rem;
        color: #e2e8f0;
        line-height: 1.5;
    }

    .msg-sources {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #2d3748;
        font-size: 0.72rem;
        color: #64748b;
        font-family: 'IBM Plex Mono', monospace;
    }

    .source-tag {
        display: inline-block;
        background: #1e2a3a;
        border: 1px solid #2d4a6e;
        border-radius: 4px;
        padding: 2px 7px;
        margin: 2px 3px 2px 0;
        color: #60a5fa;
        font-size: 0.68rem;
    }

    /* ── Empty State ── */
    .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #4a5568;
    }

    .empty-state-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .empty-state-text {
        font-size: 0.9rem;
        line-height: 1.6;
    }

    /* ── Stats Cards ── */
    .stats-row {
        display: flex;
        gap: 10px;
        margin-bottom: 1rem;
    }

    .stat-card {
        flex: 1;
        background: #161b27;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
    }

    .stat-value {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 1.4rem;
        font-weight: 600;
        color: #60a5fa;
    }

    .stat-label {
        font-size: 0.7rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 2px;
    }

    /* ── Buttons ── */
    .stButton > button {
        background: #1e3a5f !important;
        border: 1px solid #2d4a6e !important;
        color: #60a5fa !important;
        border-radius: 8px !important;
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 0.8rem !important;
        padding: 0.4rem 1rem !important;
        transition: all 0.2s !important;
    }

    .stButton > button:hover {
        background: #2d4a6e !important;
        border-color: #60a5fa !important;
    }

    /* ── Input ── */
    .stTextInput > div > div > input,
    .stChatInput > div > div > input {
        background: #1a2235 !important;
        border: 1px solid #2d3748 !important;
        border-radius: 8px !important;
        color: #e2e8f0 !important;
        font-family: 'IBM Plex Sans', sans-serif !important;
    }

    /* ── File Uploader ── */
    [data-testid="stFileUploader"] {
        background: #1a2235;
        border-radius: 8px;
    }

    /* ── Divider ── */
    hr {
        border-color: #2d3748 !important;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #0f1117; }
    ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: #4a5568; }
</style>
""", unsafe_allow_html=True)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
SUPPORTED = ["pdf", "xlsx", "xls", "csv", "png", "jpg", "jpeg", "tiff", "bmp"]


# ─── Session State ────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []
if "ingested_files" not in st.session_state:
    st.session_state.ingested_files = []


# ─── Sidebar ──────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div class="header-container">
        <div class="header-icon">🧾</div>
        <div>
            <div class="header-title">InvoicePro</div>
            <div class="header-subtitle">AI Document Analyst</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Provider badge
    model_name = Config.OLLAMA_MODEL if Config.MODEL_PROVIDER == "ollama" else Config.AZURE_OPENAI_DEPLOYMENT
    st.markdown(f"""
    <div class="provider-badge">
        ⚡ {Config.MODEL_PROVIDER.upper()} · {model_name}
    </div>
    """, unsafe_allow_html=True)

    # ── Upload Section ──
    st.markdown('<div class="section-label">📂 Upload Invoices</div>', unsafe_allow_html=True)

    uploaded_files = st.file_uploader(
        "Drop files here",
        type=SUPPORTED,
        accept_multiple_files=True,
        label_visibility="collapsed",
    )

    if uploaded_files:
        if st.button("⚡ Ingest Files", use_container_width=True):
            for uploaded_file in uploaded_files:
                file_path = os.path.join(UPLOAD_DIR, uploaded_file.name)
                with open(file_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())

                with st.spinner(f"Processing {uploaded_file.name}..."):
                    try:
                        count = ingest_file(file_path)
                        if count > 0:
                            if uploaded_file.name not in st.session_state.ingested_files:
                                st.session_state.ingested_files.append(uploaded_file.name)
                            st.success(f"✅ {uploaded_file.name} — {count} chunk(s)")
                        else:
                            st.warning(f"⚠️ {uploaded_file.name} — no content found")
                    except Exception as e:
                        st.error(f"❌ {uploaded_file.name} — {str(e)}")

    st.markdown("---")

    # ── Ingested Files List ──
    if st.session_state.ingested_files:
        st.markdown('<div class="section-label">✅ Ingested Files</div>', unsafe_allow_html=True)

        for i, fname in enumerate(st.session_state.ingested_files):
            ext = fname.split(".")[-1].upper()
            icon = {"PDF": "📄", "XLSX": "📊", "XLS": "📊", "CSV": "📋"}.get(ext, "🖼️")

            col1, col2 = st.columns([5, 1])
            with col1:
                st.markdown(f"""
                <div class="file-card file-card-success">
                    {icon} <span style="font-size:0.78rem">{fname}</span>
                </div>
                """, unsafe_allow_html=True)
            with col2:
                if st.button("✕", key=f"del_{i}_{fname}", help=f"Delete {fname}"):
                    # Delete from ChromaDB
                    try:
                        from backend.invoice_api import get_chroma_collection
                        collection = get_chroma_collection()
                        all_data = collection.get()
                        ids_to_delete = [
                            doc_id for doc_id, meta in zip(all_data["ids"], all_data["metadatas"])
                            if meta.get("source") == fname
                        ]
                        if ids_to_delete:
                            collection.delete(ids=ids_to_delete)
                    except Exception as e:
                        st.error(f"DB cleanup error: {e}")

                    # Remove from session
                    st.session_state.ingested_files.remove(fname)
                    st.rerun()

        st.markdown("---")

        # Stats
        st.markdown(f"""
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value">{len(st.session_state.ingested_files)}</div>
                <div class="stat-label">Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{len(st.session_state.messages) // 2}</div>
                <div class="stat-label">Queries</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Delete All
        if st.button("🗑️ Delete All Files", use_container_width=True):
            # NOTE: Files are intentionally kept in uploads/ folder
            shutil.rmtree("processed_reports/chroma_db", ignore_errors=True)
            st.session_state.ingested_files = []
            st.session_state.messages = []
            st.rerun()

    st.markdown("---")

    # ── Clear Chat ──
    if st.button("🗑️ Clear Chat", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

# ─── Main Area ────────────────────────────────────────────────
st.markdown("""
<div style="padding: 1rem 0 0.5rem 0;">
    <div style="font-family: 'IBM Plex Mono', monospace; font-size: 1.1rem; color: #f0f4ff; font-weight: 600;">
        Chat with your Invoices
    </div>
    <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">
        Upload invoice files on the left, then ask questions below. Answers come strictly from your documents.
    </div>
</div>
<hr/>
""", unsafe_allow_html=True)

# ── Chat Window ──
chat_box = st.container()

with chat_box:
    if not st.session_state.messages:
        st.markdown("""
        <div class="empty-state">
            <div class="empty-state-icon">🧾</div>
            <div class="empty-state-text">
                No conversation yet.<br/>
                Upload invoice files on the left and start asking questions.
            </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        for msg in st.session_state.messages:
            if msg["role"] == "user":
                st.markdown(f"""
                <div class="msg-user">
                    <div class="msg-user-bubble">{msg["content"]}</div>
                </div>
                """, unsafe_allow_html=True)
            else:
                sources_html = ""
                if msg.get("sources"):
                    tags = "".join([
                        f'<span class="source-tag">📎 {s["source"]} · p{s["page"]}</span>'
                        for s in msg["sources"]
                    ])
                    sources_html = f'<div class="msg-sources">Sources: {tags}</div>'

                st.markdown(f"""
                <div class="msg-bot">
                    <div class="msg-bot-avatar">🤖</div>
                    <div class="msg-bot-bubble">
                        {msg["content"]}
                        {sources_html}
                    </div>
                </div>
                """, unsafe_allow_html=True)

# ── Chat Input ──
st.markdown("<div style='height: 1rem'></div>", unsafe_allow_html=True)

if prompt := st.chat_input("Ask a question about your invoices..."):
    if not st.session_state.ingested_files:
        st.warning("⚠️ Please upload and ingest at least one invoice file first.")
    else:
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})

        # Get answer
        with st.spinner("Thinking..."):
            result = chat(prompt)

        # Add bot message
        st.session_state.messages.append({
            "role": "assistant",
            "content": result["answer"],
            "sources": result["sources"],
        })

        st.rerun()