# main.py

import argparse
from backend.invoice_api import ingest_folder, ingest_file, chat
from backend.config import Config
from backend.log_utils import app_logger


def run_ingest(folder: str = "uploads"):
    """Ingest all files from a folder."""
    print(f"\n📂 Scanning folder: {folder}")
    summary = ingest_folder(folder)

    print("\n✅ Successfully ingested:")
    if summary["success"]:
        for item in summary["success"]:
            print(f"   → {item['file']} ({item['chunks']} chunks)")
    else:
        print("   None")

    if summary["skipped"]:
        print("\n⚠️  Skipped (no content extracted):")
        for f in summary["skipped"]:
            print(f"   → {f}")

    if summary["failed"]:
        print("\n❌ Failed:")
        for item in summary["failed"]:
            print(f"   → {item['file']}: {item['error']}")

    print(f"\n📊 Summary: {len(summary['success'])} ingested, {len(summary['skipped'])} skipped, {len(summary['failed'])} failed\n")


def run_chat():
    """Interactive CLI chat loop."""
    print("\n🤖 InvoicePro Chat — type 'exit' to quit\n")
    print(f"   Provider : {Config.MODEL_PROVIDER}")
    print(f"   Model    : {Config.OLLAMA_MODEL if Config.MODEL_PROVIDER == 'ollama' else Config.AZURE_OPENAI_DEPLOYMENT}")
    print("-" * 50)

    while True:
        query = input("\nYou: ").strip()
        if not query:
            continue
        if query.lower() in {"exit", "quit", "q"}:
            print("Goodbye! 👋")
            break

        result = chat(query)
        print(f"\n🤖 Answer: {result['answer']}")
        if result["sources"]:
            print("📎 Sources:")
            for s in result["sources"]:
                print(f"   → {s['source']} (page: {s['page']})")


def main():
    parser = argparse.ArgumentParser(
        description="InvoicePro — AI Invoice Analyzer",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command")

    # ─── ingest command ───────────────────────────────────────
    ingest_parser = subparsers.add_parser("ingest", help="Ingest files into vector DB")
    ingest_parser.add_argument(
        "--folder",
        type=str,
        default="uploads",
        help="Folder to scan for invoice files (default: uploads/)",
    )
    ingest_parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Ingest a single specific file",
    )

    # ─── chat command ─────────────────────────────────────────
    subparsers.add_parser("chat", help="Start interactive chat with ingested documents")

    args = parser.parse_args()

    if args.command == "ingest":
        if args.file:
            print(f"\n📄 Ingesting single file: {args.file}")
            count = ingest_file(args.file)
            print(f"✅ Ingested {count} chunks from {args.file}\n")
        else:
            run_ingest(args.folder)

    elif args.command == "chat":
        run_chat()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()