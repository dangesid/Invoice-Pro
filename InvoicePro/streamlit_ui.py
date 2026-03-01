# streamlit_ui.py

import os
import base64
import html as html_lib
import json
import streamlit as st
import streamlit.components.v1 as components
from backend.invoice_api import ingest_file, chat
from backend.azure_invoice_process_functions import parse_file
from backend.config import Config

st.set_page_config(
    page_title="InvoicePro AI",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="collapsed",
)

def pdf_to_images(file_path: str):
    try:
        import fitz
        doc = fitz.open(file_path)
        images = []
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8))
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        return images
    except Exception:
        return []

# ── Global CSS ────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body, [class*="css"], .stApp { font-family:'DM Sans',sans-serif; background:#fff !important; color:#0a0a0a; }
#MainMenu, footer, header { visibility:hidden; }
.block-container { padding:1.2rem 2rem 2rem !important; max-width:100% !important; }
[data-testid="stSidebar"] { display:none; }

.topbar { display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; border-bottom:1.5px solid #0a0a0a; margin-bottom:24px; }
.topbar-logo { font-family:'Fraunces',serif; font-weight:600; font-size:1.15rem; letter-spacing:-0.3px; display:flex; align-items:center; gap:8px; }
.ldot { width:7px; height:7px; background:#00e676; border-radius:50%; display:inline-block; animation:lp 2s infinite; }
@keyframes lp { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
.tbadge { font-family:'DM Mono',monospace; font-size:0.62rem; background:#f4f4f4; border:1.5px solid #0a0a0a; border-radius:20px; padding:3px 11px; }

.upload-hero { font-family:'Fraunces',serif; font-size:2.6rem; font-weight:600; letter-spacing:-1px; line-height:1.1; margin-bottom:8px; }
.upload-hero span { color:#00b894; font-style:italic; font-weight:400; }
.upload-sub { font-size:0.86rem; color:#888; font-weight:300; margin-bottom:28px; max-width:340px; line-height:1.65; font-family:'DM Sans',sans-serif; }
.fmt-tag { font-family:'DM Mono',monospace; font-size:0.58rem; color:#bbb; letter-spacing:0.06em; margin-top:12px; text-align:center; }
.file-picked { margin:8px 0 12px; background:#f0faf5; border:1.5px solid #00b894; border-radius:10px; padding:9px 14px; font-size:0.8rem; font-family:'DM Mono',monospace; color:#00704a; }

.panel-hdr { display:flex; align-items:center; justify-content:space-between; padding-bottom:9px; border-bottom:1.5px solid #ebebeb; margin-bottom:12px; }
.panel-title { font-family:'Fraunces',serif; font-weight:600; font-size:0.82rem; letter-spacing:0.02em; color:#0a0a0a; }
.panel-tag { font-family:'DM Mono',monospace; font-size:0.58rem; background:#0a0a0a; color:#fff; padding:2px 7px; border-radius:3px; }

.pdf-wrap { margin-bottom:14px; border:1.5px solid #e8e8e8; border-radius:10px; overflow:hidden; }
.pdf-lbl { font-family:'DM Mono',monospace; font-size:0.58rem; color:#bbb; padding:4px 10px; border-bottom:1px solid #f0f0f0; text-transform:uppercase; letter-spacing:0.08em; background:#fafafa; }
.txt-chunk { background:#fafafa; border:1.5px solid #ebebeb; border-radius:10px; padding:13px 15px; font-size:0.79rem; line-height:1.8; color:#1a1a1a; white-space:pre-wrap; word-break:break-word; font-weight:300; margin-bottom:10px; font-family:'DM Sans',sans-serif; }
.chunk-lbl { font-family:'DM Mono',monospace; font-size:0.56rem; color:#ccc; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }

.stButton > button { background:#0a0a0a !important; border:none !important; color:#fff !important; border-radius:10px !important; font-family:'Fraunces',serif !important; font-size:0.85rem !important; font-weight:600 !important; padding:0.42rem 1.1rem !important; transition:all 0.15s !important; letter-spacing:0.01em !important; }
.stButton > button:hover { background:#2a2a2a !important; transform:translateY(-1px) !important; }
.stButton > button[kind="secondary"] { background:#f5f5f5 !important; color:#0a0a0a !important; border:1.5px solid #ddd !important; font-family:'DM Sans',sans-serif !important; font-weight:400 !important; }
.stButton > button[kind="secondary"]:hover { background:#ececec !important; border-color:#0a0a0a !important; }
[data-testid="stFileUploader"] section { background:#fafafa !important; border:2px dashed #ddd !important; border-radius:12px !important; }
[data-testid="stFileUploader"] section:hover { border-color:#0a0a0a !important; }
::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#e0e0e0; border-radius:2px; }
</style>
""", unsafe_allow_html=True)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
SUPPORTED = ["pdf", "xlsx", "xls", "csv", "png", "jpg", "jpeg", "tiff", "bmp"]

defaults = {
    "screen": "upload",
    "active_file": None,
    "file_path": None,
    "doc_chunks": [],
    "pdf_images": [],
    "chat_history": [],
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

model_name = Config.OLLAMA_MODEL if Config.MODEL_PROVIDER == "ollama" else Config.AZURE_OPENAI_DEPLOYMENT

# ══════════════════════════════════════════════════════════════
# QUERY PARAM BRIDGE
# JS sets ?q=<question> in the URL → Streamlit reads it here,
# calls chat() directly (same process, same memory_state),
# stores result in session_state.chat_history, clears the param.
# ══════════════════════════════════════════════════════════════
params = st.query_params
incoming_q = params.get("q", "").strip()

if incoming_q and st.session_state.get("screen") == "viewer":
    # Clear the param immediately so it doesn't re-trigger
    st.query_params.clear()
    try:
        result = chat(incoming_q)
        answer = result.get("answer", "No answer.")
        sources = result.get("sources", [])
    except Exception as e:
        answer = f"Error: {str(e)}"
        sources = []
    st.session_state.chat_history.append({"role": "user",  "text": incoming_q, "sources": []})
    st.session_state.chat_history.append({"role": "bot",   "text": answer,     "sources": sources})
    # Rerun so the JS popup gets the updated chat_history JSON
    st.rerun()

# ── Topbar ────────────────────────────────────────────────────
st.markdown(f"""
<div class="topbar">
  <div class="topbar-logo">
    <span class="ldot"></span>InvoicePro
    <span style="font-weight:300;color:#aaa;margin-left:2px;font-family:'DM Sans',sans-serif;font-size:1rem;">AI</span>
  </div>
  <div class="tbadge">⚡ {Config.MODEL_PROVIDER.upper()} · {model_name}</div>
</div>
""", unsafe_allow_html=True)


# ═══ SCREEN 1 — UPLOAD ═══════════════════════════════════════
if st.session_state.screen == "upload":
    _, center, _ = st.columns([1, 2, 1])
    with center:
        st.markdown("""
        <div class="upload-hero">Your invoice,<br/><span>decoded instantly.</span></div>
        <div class="upload-sub">Drop any invoice or financial doc. AI reads it, you ask questions.</div>
        """, unsafe_allow_html=True)

        uploaded_file = st.file_uploader("file", type=SUPPORTED, accept_multiple_files=False, label_visibility="collapsed", key="up1")

        if uploaded_file:
            size_kb = round(len(uploaded_file.getbuffer()) / 1024, 1)
            st.markdown(f'<div class="file-picked">✅ <strong>{uploaded_file.name}</strong> · {size_kb} KB</div>', unsafe_allow_html=True)
            if st.button("⚡ Ingest & Analyse", use_container_width=True):
                file_path = os.path.join(UPLOAD_DIR, uploaded_file.name)
                with open(file_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                with st.spinner("Processing..."):
                    try:
                        count = ingest_file(file_path)
                        if count > 0:
                            chunks = list(parse_file(file_path))
                            pdf_images = pdf_to_images(file_path) if uploaded_file.name.lower().endswith(".pdf") else []
                            st.session_state.update({
                                "active_file": uploaded_file.name,
                                "file_path": file_path,
                                "doc_chunks": chunks,
                                "pdf_images": pdf_images,
                                "screen": "viewer",
                                "chat_history": [],
                            })
                            st.rerun()
                        else:
                            st.warning("⚠️ No content extracted.")
                    except Exception as e:
                        st.error(f"❌ {str(e)}")

        st.markdown('<div class="fmt-tag">PDF · XLSX · CSV · PNG · JPG · TIFF</div>', unsafe_allow_html=True)


# ═══ SCREEN 2 — VIEWER ═══════════════════════════════════════
elif st.session_state.screen == "viewer":

    # Action bar
    c1, _, c2 = st.columns([2, 3, 3])
    with c1:
        if st.button("← Upload New Invoice", type="secondary"):
            st.session_state.update({
                "screen": "upload", "active_file": None, "file_path": None,
                "doc_chunks": [], "pdf_images": [], "chat_history": []
            })
            st.query_params.clear()
            st.rerun()
    with c2:
        ext = st.session_state.active_file.split(".")[-1].upper()
        icon = {"PDF": "📄", "XLSX": "📊", "XLS": "📊", "CSV": "📋"}.get(ext, "🖼️")
        st.markdown(f"""
        <div style="text-align:right;font-family:'DM Mono',monospace;font-size:0.64rem;color:#aaa;display:flex;align-items:center;justify-content:flex-end;gap:6px;">
          <span style="background:#0a0a0a;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.56rem;">{ext}</span>
          {icon} {st.session_state.active_file}
          <span style="background:#00e676;color:#000;padding:1px 6px;border-radius:3px;font-size:0.56rem;font-weight:500;font-family:'DM Sans',sans-serif;">{len(st.session_state.doc_chunks)} chunks</span>
        </div>""", unsafe_allow_html=True)

    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    left_col, right_col = st.columns([1, 1], gap="large")

    # LEFT — Visual
    with left_col:
        st.markdown('<div class="panel-hdr"><span class="panel-title">📄 Document</span><span class="panel-tag">VISUAL</span></div>', unsafe_allow_html=True)
        if st.session_state.pdf_images:
            for i, b64 in enumerate(st.session_state.pdf_images):
                st.markdown(f'<div class="pdf-wrap"><div class="pdf-lbl">Page {i+1}</div><img src="data:image/png;base64,{b64}" style="width:100%;display:block;"/></div>', unsafe_allow_html=True)
        elif st.session_state.doc_chunks:
            for i, chunk in enumerate(st.session_state.doc_chunks):
                lines = chunk.get("content", "").split("\n")
                rows = "".join([f"<div style='padding:2px 0;border-bottom:1px solid #f8f8f8;font-size:0.76rem;color:#1a1a1a;font-weight:300;'>{html_lib.escape(l) if l.strip() else '&nbsp;'}</div>" for l in lines[:80]])
                trunc = "<div style='color:#ccc;font-size:0.68rem;margin-top:5px;'>... truncated</div>" if len(lines) > 80 else ""
                st.markdown(f'<div class="pdf-wrap"><div class="pdf-lbl">Sheet · {chunk.get("page", i+1)}</div><div style="padding:14px 16px;background:#fff;">{rows}{trunc}</div></div>', unsafe_allow_html=True)
        else:
            st.markdown('<div style="text-align:center;padding:3rem;color:#ccc;font-size:0.82rem;font-weight:300;">📭 No visual content</div>', unsafe_allow_html=True)

    # RIGHT — Extracted text
    with right_col:
        st.markdown('<div class="panel-hdr"><span class="panel-title">📝 Extracted Text</span><span class="panel-tag">RAW</span></div>', unsafe_allow_html=True)
        if st.session_state.doc_chunks:
            for i, chunk in enumerate(st.session_state.doc_chunks):
                st.markdown(f'<div class="chunk-lbl">Page · {chunk.get("page", i+1)}</div>', unsafe_allow_html=True)
                safe = html_lib.escape(chunk.get("content", "")[:2500])
                trunc = "..." if len(chunk.get("content", "")) > 2500 else ""
                st.markdown(f'<div class="txt-chunk">{safe}{trunc}</div>', unsafe_allow_html=True)
        else:
            st.markdown('<div style="text-align:center;padding:3rem;color:#ccc;font-size:0.82rem;font-weight:300;">📭 No text extracted</div>', unsafe_allow_html=True)

    # ── Embed chat history JSON for the popup to read ─────────
    chat_history_json = json.dumps(st.session_state.chat_history)
    active_file_safe = html_lib.escape(st.session_state.active_file or "")

    # ── JS Popup — original design, query-param bridge ────────
    components.html(f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
(function() {{
  const existing = window.parent.document.getElementById('invoicepro-chat-root');
  if (existing) existing.remove();
  const styleEl = window.parent.document.getElementById('ip-chat-styles');
  if (styleEl) styleEl.remove();

  const ACTIVE_FILE = '{active_file_safe}';
  // Chat history injected fresh on every Streamlit rerun
  const HISTORY = {chat_history_json};

  if (!window.parent.document.getElementById('ip-fonts')) {{
    const l = window.parent.document.createElement('link');
    l.id = 'ip-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,400&family=DM+Sans:wght@300;400&family=DM+Mono:wght@400&display=swap';
    window.parent.document.head.appendChild(l);
  }}

  const s = window.parent.document.createElement('style');
  s.id = 'ip-chat-styles';
  s.textContent = `
    #ip-fab {{
      position:fixed; bottom:24px; right:24px; z-index:99999;
      width:52px; height:52px; background:#0a0a0a; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:1.3rem; cursor:pointer; border:none;
      box-shadow:0 4px 24px rgba(0,0,0,0.22);
      transition:transform 0.2s; user-select:none;
    }}
    #ip-fab:hover {{ transform:scale(1.1); }}
    #ip-popup {{
      position:fixed; bottom:86px; right:24px; z-index:99998;
      width:340px; background:#fff; border:1.5px solid #0a0a0a; border-radius:16px;
      box-shadow:0 8px 40px rgba(0,0,0,0.15);
      display:flex; flex-direction:column; overflow:hidden; max-height:460px;
      transform:scale(0.94) translateY(16px); opacity:0; pointer-events:none;
      transition:transform 0.22s cubic-bezier(0.34,1.4,0.64,1), opacity 0.16s ease;
      font-family:'DM Sans',sans-serif;
    }}
    #ip-popup.ip-open {{ transform:scale(1) translateY(0); opacity:1; pointer-events:all; }}
    .ip-hdr {{ padding:12px 14px 10px; border-bottom:1px solid #f0f0f0; background:#fafafa; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }}
    .ip-hdr-l {{ display:flex; align-items:center; gap:9px; }}
    .ip-av {{ width:30px; height:30px; background:#0a0a0a; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; }}
    .ip-ttl {{ font-family:'Fraunces',serif; font-weight:600; font-size:0.88rem; color:#0a0a0a; }}
    .ip-sub {{ font-family:'DM Mono',monospace; font-size:0.56rem; color:#00b894; display:flex; align-items:center; gap:3px; margin-top:1px; }}
    .ip-ld {{ width:5px; height:5px; background:#00e676; border-radius:50%; animation:ip-lp 2s infinite; }}
    @keyframes ip-lp {{ 0%,100%{{opacity:1;}} 50%{{opacity:0.3;}} }}
    .ip-cls {{ background:none; border:none; cursor:pointer; color:#bbb; font-size:0.95rem; padding:3px 6px; border-radius:5px; }}
    .ip-cls:hover {{ background:#f0f0f0; color:#0a0a0a; }}
    #ip-msgs {{ flex:1; overflow-y:auto; padding:12px 12px 6px; display:flex; flex-direction:column; gap:8px; min-height:160px; max-height:320px; }}
    .ip-empty {{ display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:160px; color:#ccc; text-align:center; gap:6px; }}
    .ip-empty .ei {{ font-size:1.8rem; }}
    .ip-empty p {{ font-size:0.76rem; font-weight:300; color:#ccc; max-width:170px; line-height:1.6; margin:0; }}
    .ip-mu {{ display:flex; justify-content:flex-end; }}
    .ip-bu {{ background:#0a0a0a; color:#fff; border-radius:12px 12px 2px 12px; padding:8px 12px; max-width:82%; font-size:0.8rem; line-height:1.5; word-break:break-word; font-weight:300; }}
    .ip-mb {{ display:flex; align-items:flex-start; gap:6px; }}
    .ip-bav {{ width:22px; height:22px; background:#f0f0f0; border:1.5px solid #0a0a0a; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.6rem; flex-shrink:0; margin-top:2px; }}
    .ip-bb {{ background:#f5f5f5; color:#0a0a0a; border:1px solid #ebebeb; border-radius:2px 12px 12px 12px; padding:8px 12px; max-width:82%; font-size:0.8rem; line-height:1.55; font-weight:300; word-break:break-word; }}
    .ip-src {{ margin-top:5px; padding-top:5px; border-top:1px solid #e0e0e0; display:flex; flex-wrap:wrap; gap:3px; }}
    .ip-sc {{ font-family:'DM Mono',monospace; font-size:0.54rem; background:#fff; border:1px solid #ddd; border-radius:20px; padding:1px 6px; color:#888; }}
    .ip-typing {{ display:flex; gap:3px; align-items:center; padding:8px 11px; background:#f5f5f5; border:1px solid #ebebeb; border-radius:2px 12px 12px 12px; width:fit-content; }}
    .ip-td {{ width:5px; height:5px; background:#bbb; border-radius:50%; animation:ip-tb 1.2s infinite; }}
    .ip-td:nth-child(2){{animation-delay:0.2s;}} .ip-td:nth-child(3){{animation-delay:0.4s;}}
    @keyframes ip-tb {{ 0%,60%,100%{{transform:translateY(0);}} 30%{{transform:translateY(-4px);}} }}
    #ip-ibar {{ padding:9px 11px 11px; border-top:1px solid #f0f0f0; background:#fff; display:flex; gap:7px; align-items:center; flex-shrink:0; }}
    #ip-ci {{ flex:1; background:#f8f8f8; border:1.5px solid #e0e0e0; border-radius:9px; padding:7px 11px; font-size:0.8rem; font-family:'DM Sans',sans-serif; color:#0a0a0a; outline:none; }}
    #ip-ci:focus {{ border-color:#0a0a0a; }}
    #ip-ci::placeholder {{ color:#ccc; }}
    #ip-cs {{ background:#0a0a0a; color:#fff; border:none; border-radius:9px; padding:7px 13px; font-family:'Fraunces',serif; font-weight:600; font-size:0.8rem; cursor:pointer; white-space:nowrap; }}
    #ip-cs:hover {{ background:#333; }}
    #ip-cs:disabled {{ background:#ddd; cursor:not-allowed; }}
    #ip-msgs::-webkit-scrollbar {{ width:2px; }}
    #ip-msgs::-webkit-scrollbar-thumb {{ background:#e8e8e8; }}
  `;
  window.parent.document.head.appendChild(s);

  const root = window.parent.document.createElement('div');
  root.id = 'invoicepro-chat-root';
  root.innerHTML = `
    <button id="ip-fab" title="Chat with invoice">💬</button>
    <div id="ip-popup">
      <div class="ip-hdr">
        <div class="ip-hdr-l">
          <div class="ip-av">🤖</div>
          <div>
            <div class="ip-ttl">Invoice Assistant</div>
            <div class="ip-sub"><span class="ip-ld"></span>` + ACTIVE_FILE + `</div>
          </div>
        </div>
        <button class="ip-cls" id="ip-close">✕</button>
      </div>
      <div id="ip-msgs"></div>
      <div id="ip-ibar">
        <input id="ip-ci" type="text" placeholder="Ask about your invoice..." autocomplete="off"/>
        <button id="ip-cs">Send</button>
      </div>
    </div>
  `;
  window.parent.document.body.appendChild(root);

  const pd = window.parent.document;
  // Restore open state from sessionStorage so rerun doesn't collapse the popup
  let isOpen = window.parent.sessionStorage.getItem('ip-chat-open') === '1';

  function esc(str) {{
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
  }}

  function renderHistory(history) {{
    const msgs = pd.getElementById('ip-msgs');
    if (!msgs) return;
    msgs.innerHTML = '';
    if (!history || history.length === 0) {{
      msgs.innerHTML = '<div class="ip-empty"><div class="ei">🧾</div><p>Ask anything — totals, vendors, dates, line items.</p></div>';
      return;
    }}
    for (const msg of history) {{
      if (msg.role === 'user') {{
        msgs.innerHTML += '<div class="ip-mu"><div class="ip-bu">' + esc(msg.text) + '</div></div>';
      }} else {{
        let src = '';
        if (msg.sources && msg.sources.length) {{
          src = '<div class="ip-src">' + msg.sources.slice(0,3).map(s =>
            '<span class="ip-sc">' + esc(s.source||'') + ' p' + esc(String(s.page||'')) + '</span>'
          ).join('') + '</div>';
        }}
        msgs.innerHTML += '<div class="ip-mb"><div class="ip-bav">🤖</div><div class="ip-bb">' + esc(msg.text) + src + '</div></div>';
      }}
    }}
    scrollB();
  }}

  function scrollB() {{
    const m = pd.getElementById('ip-msgs');
    if (m) m.scrollTop = m.scrollHeight;
  }}

  function toggle() {{
    isOpen = !isOpen;
    window.parent.sessionStorage.setItem('ip-chat-open', isOpen ? '1' : '0');
    pd.getElementById('ip-popup').classList.toggle('ip-open', isOpen);
    pd.getElementById('ip-fab').textContent = isOpen ? '✕' : '💬';
    if (isOpen) {{ scrollB(); setTimeout(() => pd.getElementById('ip-ci')?.focus(), 200); }}
  }}

  // Apply restored open state immediately (no animation flash)
  if (isOpen) {{
    pd.getElementById('ip-popup').classList.add('ip-open');
    pd.getElementById('ip-fab').textContent = '✕';
  }}

  function send() {{
    const inp = pd.getElementById('ip-ci');
    const btn = pd.getElementById('ip-cs');
    const q = inp.value.trim();
    if (!q) return;

    // Show user bubble + typing indicator immediately
    const msgs = pd.getElementById('ip-msgs');
    const empty = msgs.querySelector('.ip-empty');
    if (empty) empty.remove();
    msgs.innerHTML += '<div class="ip-mu"><div class="ip-bu">' + esc(q) + '</div></div>';
    msgs.innerHTML += '<div class="ip-mb" id="ip-typing-row"><div class="ip-bav">🤖</div><div class="ip-typing"><div class="ip-td"></div><div class="ip-td"></div><div class="ip-td"></div></div></div>';
    scrollB();
    inp.value = '';
    inp.disabled = true;
    btn.disabled = true;

    // ── KEY FIX: set ?q= on the PARENT window URL to trigger Streamlit rerun ──
    const url = new URL(window.parent.location.href);
    url.searchParams.set('q', q);
    window.parent.history.pushState({{}}, '', url.toString());
    // Dispatch a popstate so Streamlit's router picks up the change
    window.parent.dispatchEvent(new PopStateEvent('popstate', {{ state: {{}} }}));
  }}

  // Render whatever history was baked in at render time
  renderHistory(HISTORY);

  pd.getElementById('ip-fab').addEventListener('click', toggle);
  pd.getElementById('ip-close').addEventListener('click', toggle);
  pd.getElementById('ip-cs').addEventListener('click', send);
  pd.getElementById('ip-ci').addEventListener('keydown', e => {{ if (e.key === 'Enter') send(); }});
}})();
</script>
</body></html>""", height=0, scrolling=False)