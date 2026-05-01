"""
One-time / scheduled corpus indexer.

Reads markdown files from ./corpus, derives stable IDs via content hash,
and upserts them to the sandbox datasource via the Indexing API.

Idempotent: re-running does not create duplicates.
"""
from __future__ import annotations

import argparse
import hashlib
import logging
from pathlib import Path

from .config import load_config
from .glean_client import IndexingClient

log = logging.getLogger(__name__)

CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus"
SUPPORTED_EXTENSIONS = (".md", ".txt")
MIME_BY_EXT = {".md": "text/markdown", ".txt": "text/plain"}


def _stable_id(prefix: str, content: str) -> str:
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _slugify(stem: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "-" for c in stem)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def _build_document(path: Path, datasource: str, instance: str) -> dict:
    content = path.read_text(encoding="utf-8")
    ext = path.suffix.lower()
    # First non-empty line as title, falling back to filename.
    title = next(
        (line.lstrip("# ").strip() for line in content.splitlines() if line.strip()),
        path.stem,
    )
    doc_id = _stable_id(datasource, content)

    # The exact schema depends on the Indexing API version — confirm against
    # sandbox docs. This shape matches the common Glean custom-datasource schema.
    # NOTE: viewURL must match the datasource's configured URL pattern.
    # Pattern for interviewds: https://internal.example.com/policies/.*
    return {
        "id": doc_id,
        "title": title,
        "datasource": datasource,
        "viewURL": f"https://internal.example.com/policies/{_slugify(path.stem)}",
        "body": {
            "mimeType": MIME_BY_EXT.get(ext, "text/plain"),
            "textContent": content,
        },
        "permissions": {
            # Prototype: world-readable within the sandbox tenant.
            # Production: real ACLs derived from the source system.
            "allowAnonymousAccess": True,
        },
    }


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Index ./corpus into Glean.")
    parser.add_argument(
        "--bulk",
        action="store_true",
        help="Use /bulkindexdocuments for full-sync (drops docs absent from the upload).",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=50,
        help="Documents per page when --bulk is set.",
    )
    parser.add_argument(
        "--force-restart",
        action="store_true",
        help="With --bulk: restart any prior interrupted upload sharing this uploadId.",
    )
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    cfg = load_config()
    logging.basicConfig(level=cfg.log_level)
    client = IndexingClient(cfg)

    if not CORPUS_DIR.exists():
        raise SystemExit(f"Corpus directory not found: {CORPUS_DIR}")

    files = sorted(p for p in CORPUS_DIR.iterdir() if p.suffix.lower() in SUPPORTED_EXTENSIONS)
    if not files:
        raise SystemExit(f"No {'/'.join(SUPPORTED_EXTENSIONS)} files in {CORPUS_DIR}")

    documents = [_build_document(p, cfg.glean_datasource, cfg.glean_instance) for p in files]
    mode = "bulk" if args.bulk else "upsert"
    log.info(
        "indexing_start",
        extra={"mode": mode, "count": len(documents), "datasource": cfg.glean_datasource},
    )

    if args.bulk:
        results = client.bulk_index_documents(
            documents,
            page_size=args.page_size,
            force_restart_upload=args.force_restart,
        )
        total_latency = sum(r.latency_ms for r in results)
        log.info(
            "indexing_complete",
            extra={
                "mode": mode,
                "count": len(documents),
                "pages": len(results),
                "total_latency_ms": total_latency,
                "last_request_id": results[-1].request_id,
            },
        )
        print(
            f"Bulk-indexed {len(documents)} documents into {cfg.glean_datasource} "
            f"across {len(results)} page(s)."
        )
        return

    # Batch if the API requires it; for ~20 docs a single call is fine.
    result = client.index_documents(documents)
    log.info(
        "indexing_complete",
        extra={
            "mode": mode,
            "count": len(documents),
            "request_id": result.request_id,
            "latency_ms": result.latency_ms,
        },
    )
    print(f"Indexed {len(documents)} documents into {cfg.glean_datasource}.")


if __name__ == "__main__":
    run()