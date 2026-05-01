#!/usr/bin/env python3
"""Quick test script to test Search API only (no Chat)."""
import json
import sys
from src.config import load_config
from src.glean_client import QueryClient
from src.rag import retrieve

def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "remote work policy"

    print(f"Testing Search API with query: '{query}'")
    print("=" * 60)

    cfg = load_config()
    client = QueryClient(cfg)

    # Call retrieve which uses just the Search API
    docs, latency_ms = retrieve(
        client,
        query,
        max_sources=5,
        datasource_filter=None,
    )

    print(f"\n✓ Search completed in {latency_ms}ms")
    print(f"✓ Found {len(docs)} documents\n")

    result = {
        "query": query,
        "retrieval_count": len(docs),
        "latency_ms": latency_ms,
        "results": [
            {
                "document_id": d.document_id,
                "title": d.title,
                "url": d.url,
                "snippet": d.snippet,
            }
            for d in docs
        ]
    }

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
