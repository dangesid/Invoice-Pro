# 🧾 InvoicePro AI

An AI-powered invoice analysis tool that lets you upload invoice files (PDF, XLSX, CSV, Images) and chat with them using a local LLM — strictly no hallucination, all answers sourced from your documents.

---

## 🗂️ Project Structure

```
InvoicePro/
├── backend/
│   ├── config.py                          # Ollama/Azure provider switching
│   ├── log_utils.py                       # Logging setup
│   ├── azure_invoice_process_functions.py # File parsers (PDF, XLSX, CSV, Image)
│   ├── invoice_api.py                     # RAG engine (ChromaDB + LLM)
│   └── requirements.txt                   # Python dependencies
├── generate_test_data/
│   └── test_data.py                       # Generate sample invoice files
├── logs/                                  # Auto-generated logs
├── uploads/                               # Place invoice files here
├── processed_reports/                     # ChromaDB vector store
├── streamlit_ui.py                        # Streamlit web UI
├── main.py                                # CLI entry point
└── .env                                   # Environment configuration
```

---

## ⚙️ Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) installed locally
- Tesseract OCR (for image invoices)

### Install Tesseract

```bash
# Mac
brew install tesseract

# Ubuntu/Debian
sudo apt install tesseract-ocr -y
```

---

## 🚀 Setup (First Time Only)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd Invoice-Pro
```

### 2. Create and activate virtual environment

```bash
python -m venv invoiceVenv
source invoiceVenv/bin/activate
```

### 3. Install dependencies

```bash
cd InvoicePro
pip install -r backend/requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` to set your provider:

```env
# Options: "ollama" or "azure"
MODEL_PROVIDER=ollama

# Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Azure OpenAI (fill in when you have access)
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4-turbo
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 5. Pull Ollama model (first time only)

```bash
ollama pull llama3.2
```

### 6. Generate test invoice data (optional)

```bash
python generate_test_data/test_data.py
```

This creates 10 PDFs, 5 XLSX, and 5 image invoice files in `uploads/`.

---

## 🏃 Running the Project

### Every time you start:

**Terminal 1 — Start Ollama:**
```bash
ollama serve
```

**Terminal 2 — Activate env and launch UI:**
```bash
cd Invoice-Pro/InvoicePro
source ../invoiceVenv/bin/activate
streamlit run streamlit_ui.py
```

Open browser at: **http://localhost:8501**

---

## 🖥️ Using the UI

1. **Upload files** — drag and drop PDF, XLSX, CSV, or image files into the sidebar
2. **Click ⚡ Ingest Files** — wait for ✅ on each file
3. **Ask questions** in the chat box
4. **✕** next to a file — removes it from the session (file stays in `uploads/`)
5. **🗑️ Delete All Files** — wipes ChromaDB and clears session
6. **🗑️ Clear Chat** — clears chat history only

---

## 💻 CLI Usage

```bash
# Ingest all files from uploads/ folder
python main.py ingest

# Ingest a single specific file
python main.py ingest --file uploads/INV-001.pdf

# Ingest from a custom folder
python main.py ingest --folder /path/to/invoices

# Start interactive chat in terminal
python main.py chat
```

---

## 🔁 Fresh Start (Clear All Data)

If you want to start completely fresh:

```bash
rm -rf processed_reports/chroma_db
streamlit run streamlit_ui.py
```

---

## 🔀 Switching from Ollama to Azure GPT

Just update your `.env` file — no code changes needed:

```env
MODEL_PROVIDER=azure
AZURE_OPENAI_API_KEY=your_actual_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4-turbo
```

Then restart Streamlit.

---

## 📁 Supported File Types

| Type   | Extensions                        |
|--------|-----------------------------------|
| PDF    | `.pdf`                            |
| Excel  | `.xlsx`, `.xls`                   |
| CSV    | `.csv`                            |
| Images | `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp` |

---

## 🛠️ Tech Stack

| Component     | Technology                        |
|---------------|-----------------------------------|
| LLM           | Ollama (llama3.2) / Azure OpenAI  |
| Vector Store  | ChromaDB                          |
| Embeddings    | sentence-transformers (MiniLM)    |
| PDF Parsing   | PyMuPDF (fitz)                    |
| OCR           | Tesseract + pytesseract           |
| UI            | Streamlit                         |
| Config        | python-dotenv                     |
| Logging       | Loguru                            |

---

## 📝 Notes

- Answers are strictly based on uploaded documents — no hallucination
- Every answer includes source file and page number
- ChromaDB persists between sessions — always click **Delete All** or run `rm -rf processed_reports/chroma_db` before a fresh start
- `uploads/` folder files are never deleted by the UI