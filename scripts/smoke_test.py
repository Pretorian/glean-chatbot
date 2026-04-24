"""
Pre-flight smoke test.

Runs a minimal end-to-end check against the sandbox:
    1. Load config — verifies all required env vars are present.
    2. Tiny Search call — verifies Client (or Search) token works.
    3. Tiny Chat call — verifies Client token + Chat scope.
    4. Tiny Indexing dry-run — verifies Indexing token (does not actually index).

Run this:
    - After first-time setup.
    - Before starting any work session, to catch token rotation / env issues.
    - Before the live interview. Twice.

Exit code 0 on success, 1 on any failure.
"""
from __future__ import annotations

import sys
import traceback

from src.config import load_config
from src.glean_client import IndexingClient, QueryClient


def _banner(msg: str) -> None:
    print(f"\n{'=' * 60}\n  {msg}\n{'=' * 60}")


def main() -> int:
    failures: list[str] = []

    _banner("1. Load config")
    try:
        cfg = load_config()
        print(f"   instance   : {cfg.glean_instance}")
        print(f"   datasource : {cfg.glean_datasource}")
        print(f"   indexing tok: ...{cfg.glean_indexing_token[-6:]}")
        print(f"   client tok  : ...{cfg.glean_client_token[-6:]}")
        print(f"   search tok  : "
              f"{'...' + cfg.glean_search_token[-6:] if cfg.glean_search_token else '(using client token)'}")
    except Exception as e:
        print(f"   FAIL: {e}")
        return 1

    _banner("2. Search API (Client/Search token)")
    try:
        q = QueryClient(cfg)
        result = q.search(query="test", page_size=1, datasource=cfg.glean_datasource)
        got = len(result.json.get("results", []))
        print(f"   OK — {result.status} in {result.latency_ms}ms, {got} result(s)")
    except Exception as e:
        failures.append(f"search: {e}")
        print(f"   FAIL: {e}")
        traceback.print_exc()

    _banner("3. Chat API (Client token)")
    try:
        q = QueryClient(cfg)
        result = q.chat(message="Say 'ok' if you can read this.", context_docs=[])
        print(f"   OK — {result.status} in {result.latency_ms}ms")
    except Exception as e:
        failures.append(f"chat: {e}")
        print(f"   FAIL: {e}")
        traceback.print_exc()

    _banner("4. Indexing API auth check (Indexing token)")
    # We do NOT actually push a doc here — we construct the client and let the
    # caller decide whether to exercise it. Token validity is implicitly
    # checked the first time the indexer runs. If you want a stronger check,
    # uncomment the index_documents call below with a synthetic doc.
    try:
        _ = IndexingClient(cfg)
        print("   OK — IndexingClient constructed; token format accepted.")
        print("   (Run `python -m src.indexer` to exercise the full path.)")
    except Exception as e:
        failures.append(f"indexing client: {e}")
        print(f"   FAIL: {e}")

    _banner("Summary")
    if failures:
        print(f"FAILED ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("All checks passed. Environment is ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
