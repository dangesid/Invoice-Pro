# backend/memory_store.py

from typing import List, Dict, Optional
from threading import Lock
from backend.log_utils import app_logger


class MemoryState:
    """
    Session-level conversational memory for invoice chatbot.

    Responsibilities:
    - Track currently active invoice
    - Maintain chat history
    - Store last query + retrieved context
    - Provide reset capability on new upload
    """

    def __init__(self):
        self._lock = Lock()
        self._reset_state()
        app_logger.info("MemoryState reset")

    # ─────────────────────────────────────────────
    # Internal state reset (no lock — caller must hold it)
    # ─────────────────────────────────────────────
    def _reset_state(self):
        """Internal reset — must be called with lock already held (or from __init__)."""
        self.current_invoice: Optional[str] = None
        self.chat_history: List[Dict] = []
        self.last_query: Optional[str] = None
        self.last_context: List[Dict] = []

    # ─────────────────────────────────────────────
    # Core Reset (public — acquires lock itself)
    # ─────────────────────────────────────────────
    def reset(self):
        """Reset full memory (called when new invoice uploaded)."""
        with self._lock:
            self._reset_state()
        app_logger.info("MemoryState reset")

    # ─────────────────────────────────────────────
    # Active Invoice
    # ─────────────────────────────────────────────
    def set_active_invoice(self, invoice_name: str):
        """Set currently active invoice and reset memory."""
        with self._lock:
            self._reset_state()  # ✅ uses internal reset — no double lock
            self.current_invoice = invoice_name
        app_logger.info(f"Active invoice set: {invoice_name}")

    def get_active_invoice(self) -> Optional[str]:
        """Return active invoice."""
        return self.current_invoice

    # ─────────────────────────────────────────────
    # Chat History
    # ─────────────────────────────────────────────
    def add_chat_turn(self, query: str, answer: str, sources: List[Dict]):
        """Store one chat turn."""
        with self._lock:
            self.chat_history.append(
                {
                    "query": query,
                    "answer": answer,
                    "sources": sources,
                }
            )
        app_logger.debug("Chat turn added to memory")

    def get_chat_history(self) -> List[Dict]:
        """Return full chat history."""
        return self.chat_history

    # ─────────────────────────────────────────────
    # Retrieval Memory (useful for followups)
    # ─────────────────────────────────────────────
    def set_last_interaction(self, query: str, context: List[Dict]):
        """Store last query + retrieved context."""
        with self._lock:
            self.last_query = query
            self.last_context = context

    def get_last_context(self) -> List[Dict]:
        """Return last retrieved context."""
        return self.last_context

    # ─────────────────────────────────────────────
    # Debug / Observability
    # ─────────────────────────────────────────────
    def snapshot(self) -> Dict:
        """Return memory snapshot (for debugging)."""
        return {
            "active_invoice": self.current_invoice,
            "history_length": len(self.chat_history),
            "last_query": self.last_query,
            "last_context_chunks": len(self.last_context),
        }


# ─────────────────────────────────────────────
# Singleton instance (import everywhere)
# ─────────────────────────────────────────────
memory_state = MemoryState()