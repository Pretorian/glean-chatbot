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
from .glean_client import IndexingClient, QueryClient, GleanAPIError

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
    # URL must match the datasource's configured pattern: https://internal.example.com/policies/.*
    return {
        "id": doc_id,
        "title": title,
        "datasource": datasource,
        "viewURL": f"https://internal.example.com/policies/{path.stem}",
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


def _check_existing_documents(query_client: QueryClient, datasource: str) -> int:
    """Check if documents already exist in the datasource by searching."""
    try:
        result = query_client.search(
            query="remote work policy",  # Sample query to check for indexed docs
            page_size=10,
            datasource=datasource,
        )
        # Count documents from this datasource
        results = result.json.get("results", [])
        existing_count = sum(
            1 for r in results
            if r.get("document", {}).get("datasource") == datasource
            or r.get("document", {}).get("id", "").startswith(f"CUSTOM_{datasource.upper()}")
        )
        return existing_count
    except Exception as e:
        log.warning(f"Could not check for existing documents: {e}")
        return 0


def run() -> None:
    cfg = load_config()
    logging.basicConfig(level=cfg.log_level)

    if not CORPUS_DIR.exists():
        raise SystemExit(f"Corpus directory not found: {CORPUS_DIR}")

    files = sorted(CORPUS_DIR.glob("*.md"))
    if not files:
        raise SystemExit(f"No markdown files in {CORPUS_DIR}")

    documents = [_build_document(p, cfg.glean_datasource) for p in files]

    # Check if documents already exist
    print(f"\n{'='*60}")
    print(f"Glean Indexer - Datasource: {cfg.glean_datasource}")
    print(f"{'='*60}")
    print(f"Documents to index: {len(documents)}")
    for doc in documents:
        print(f"  - {doc['title']} (ID: {doc['id']})")

    query_client = QueryClient(cfg)
    existing_count = _check_existing_documents(query_client, cfg.glean_datasource)

    if existing_count > 0:
        print(f"\n⚠️  Found {existing_count} existing documents in datasource '{cfg.glean_datasource}'")
        print("Documents may already be indexed. Attempting to update/upsert...")

    # Attempt to index
    indexing_client = IndexingClient(cfg)
    log.info("indexing_start", extra={"count": len(documents), "datasource": cfg.glean_datasource})

    try:
        result = indexing_client.index_documents(documents)
        log.info(
            "indexing_complete",
            extra={
                "count": len(documents),
                "request_id": result.request_id,
                "latency_ms": result.latency_ms,
            },
        )
        print(f"\n✅ Successfully indexed {len(documents)} documents into {cfg.glean_datasource}.")
        print(f"Request ID: {result.request_id}")
        print(f"\nNote: Documents may take 1-2 minutes to become searchable.")

    except GleanAPIError as e:
        print(f"\n❌ Indexing failed with API error:")
        print(f"   Status: {e.status}")
        print(f"   Request ID: {e.request_id}")
        print(f"   Error: {e}")

        if existing_count > 0:
            print(f"\n💡 Good news: {existing_count} documents are already indexed in the datasource!")
            print(f"   Your Search and MCP server should work fine without re-indexing.")
            print(f"\n   To verify, run:")
            print(f"   .venv/bin/python test_search.py \"remote work policy\"")
        else:
            print(f"\n💡 Troubleshooting:")
            print(f"   1. Verify GLEAN_INDEXING_TOKEN is correct in .env")
            print(f"   2. Check that datasource '{cfg.glean_datasource}' exists")
            print(f"   3. The sandbox may use a different indexing workflow")
            print(f"   4. Documents may already be pre-indexed by the sandbox")

        raise SystemExit(1)

    except Exception as e:
        print(f"\n❌ Unexpected error during indexing:")
        print(f"   {type(e).__name__}: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    run()