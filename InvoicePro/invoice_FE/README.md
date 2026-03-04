# InvoicePro — Frontend

React + TypeScript + Vite frontend for the InvoicePro AI invoice parsing app.  
Connects to a Python backend running Ollama (llama3.2).

---

## Prerequisites

- Node.js 18+
- Your backend running on port **8000** (set `APP_PORT=8000` in backend `.env`)
- Ollama running locally on port **11434** with `llama3.2` pulled

---

## Setup & Run

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure environment
The `.env` file is already pre-configured for local development:
```env
VITE_API_URL=http://127.0.0.1:8000
```
Change `VITE_API_URL` only if your backend runs on a different host/port.

### 3. Start development server
```bash
npm run dev
```
Frontend runs on → **http://localhost:8080**  
All `/api/*` requests are proxied → `http://127.0.0.1:8000/*`

### 4. Build for production
```bash
npm run build
# Serve the dist/ folder with nginx or any static file server
```

---

## Backend API Contract

The frontend expects these endpoints on your backend:

### `POST /upload`
Upload an invoice file for text extraction.
- **Request**: `multipart/form-data`, field name: `file`
- **Accepted types**: PDF, XLSX, CSV, PNG, JPG, TIFF
- **Response**:
  ```json
  { "text": "extracted invoice content..." }
  ```
  *(also accepts `extracted_text` or `content` as the key)*

### `POST /chat`
Ask a question about an uploaded invoice.
- **Request**:
  ```json
  {
    "question": "What is the total amount?",
    "extracted_text": "...full invoice text...",
    "history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
- **Response**:
  ```json
  { "answer": "The total amount is $110.00" }
  ```
  *(also accepts `response`, `message`, or `text` as the key)*

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with HMR on port 8080 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
