"""
One-time / scheduled corpus indexer.

Reads markdown files from ./corpus, derives stable IDs via content hash,
and upserts them to the sandbox datasource via the Indexing API.

Idempotent: re-running does not create duplicates.
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from .config import load_config
from .glean_client import GleanClient

log = logging.getLogger(__name__)

CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus"


def _stable_id(prefix: str, content: str) -> str:
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _build_document(path: Path, datasource: str) -> dict:
    content = path.read_text(encoding="utf-8")
    # First non-empty line as title, falling back to filename.
    title = next(
        (line.lstrip("# ").strip() for line in content.splitlines() if line.strip()),
        path.stem,
    )
    doc_id = _stable_id(datasource, content)

    # The exact schema depends on the Indexing API version — confirm against
    # sandbox docs. This shape matches the common Glean custom-datasource schema.
    return {
        "id": doc_id,
        "title": title,
        "datasource": datasource,
        "viewURL": f"file://{path.resolve()}",   # placeholder for local corpus
        "body": {
            "mimeType": "text/markdown",
            "textContent": content,
        },
        "permissions": {
            # Prototype: world-readable within the sandbox tenant.
            # Production: real ACLs derived from the source system.
            "allowAnonymousAccess": True,
        },
    }


def run() -> None:
    cfg = load_config()
    logging.basicConfig(level=cfg.log_level)
    client = GleanClient(cfg)

    if not CORPUS_DIR.exists():
        raise SystemExit(f"Corpus directory not found: {CORPUS_DIR}")

    files = sorted(CORPUS_DIR.glob("*.md"))
    if not files:
        raise SystemExit(f"No markdown files in {CORPUS_DIR}")

    documents = [_build_document(p, cfg.glean_datasource) for p in files]
    log.info("indexing_start", extra={"count": len(documents), "datasource": cfg.glean_datasource})

    # Batch if the API requires it; for ~20 docs a single call is fine.
    result = client.index_documents(documents)
    log.info(
        "indexing_complete",
        extra={
            "count": len(documents),
            "request_id": result.request_id,
            "latency_ms": result.latency_ms,
        },
    )
    print(f"Indexed {len(documents)} documents into {cfg.glean_datasource}.")


if __name__ == "__main__":
    run()
