# backend/config.py

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ─── Provider ────────────────────────────────────────────────
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "ollama").lower()

    # ─── Ollama ──────────────────────────────────────────────────
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

    # ─── Azure OpenAI ────────────────────────────────────────────
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4-turbo")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

    # ─── App ─────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", 50))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def validate(cls):
        """Validate config on startup and warn about missing values."""
        if cls.MODEL_PROVIDER == "azure":
            missing = []
            if not cls.AZURE_OPENAI_API_KEY:
                missing.append("AZURE_OPENAI_API_KEY")
            if not cls.AZURE_OPENAI_ENDPOINT:
                missing.append("AZURE_OPENAI_ENDPOINT")
            if missing:
                raise ValueError(
                    f"Azure provider selected but missing env vars: {', '.join(missing)}"
                )
        elif cls.MODEL_PROVIDER == "ollama":
            print(f"[Config] Using Ollama → model: {cls.OLLAMA_MODEL} @ {cls.OLLAMA_BASE_URL}")
        else:
            raise ValueError(
                f"Unknown MODEL_PROVIDER: '{cls.MODEL_PROVIDER}'. Use 'ollama' or 'azure'."
            )

    @classmethod
    def get_provider_summary(cls) -> dict:
        """Returns a summary dict — useful for logging/debugging."""
        if cls.MODEL_PROVIDER == "ollama":
            return {
                "provider": "ollama",
                "model": cls.OLLAMA_MODEL,
                "base_url": cls.OLLAMA_BASE_URL,
            }
        return {
            "provider": "azure",
            "deployment": cls.AZURE_OPENAI_DEPLOYMENT,
            "endpoint": cls.AZURE_OPENAI_ENDPOINT,
            "api_version": cls.AZURE_OPENAI_API_VERSION,
        }