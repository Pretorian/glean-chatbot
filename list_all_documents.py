#!/usr/bin/env python3
"""
List all documents in the Glean datasource.

Usage:
    .venv/bin/python list_all_documents.py
    .venv/bin/python list_all_documents.py --datasource interviewds
    .venv/bin/python list_all_documents.py --limit 20
"""
import argparse
import json
import sys
from src.config import load_config
from src.glean_client import QueryClient

def main():
    parser = argparse.ArgumentParser(description="List all documents in Glean datasource")
    parser.add_argument(
        "--datasource",
        help="Filter by specific datasource (default: from .env)",
        default=None,
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of documents to retrieve (default: 50)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format",
    )
    args = parser.parse_args()

    cfg = load_config()
    client = QueryClient(cfg)

    # Use a broad query to get all documents
    # Glean doesn't have a "list all" endpoint, so we use a wildcard-like search
    datasource = args.datasource or cfg.glean_datasource

    print(f"Fetching documents from datasource: {datasource}")
    print(f"{'='*60}\n")

    # Try a very broad query to get most documents
    result = client.search(
        query="*",  # Wildcard search
        page_size=args.limit,
        datasource=datasource,
    )

    results = result.json.get("results", [])

    if not results:
        print("No documents found in the datasource.")
        sys.exit(0)

    # Filter to show only documents from the target datasource
    filtered_docs = []
    for item in results:
        doc = item.get("document", {})
        doc_id = doc.get("id", "")

        # Check if document belongs to the datasource
        if datasource.upper() in doc_id or doc.get("datasource") == datasource:
            filtered_docs.append({
                "id": doc_id,
                "title": doc.get("title", "(untitled)"),
                "url": doc.get("url") or doc.get("viewURL", ""),
                "datasource": doc.get("datasource", ""),
                "container": doc.get("container", ""),
            })

    all_docs = []
    for item in results:
        doc = item.get("document", {})
        snippets = item.get("snippets") or []
        snippet_text = ""
        if snippets and isinstance(snippets, list):
            snippet_text = snippets[0].get("text") or snippets[0].get("snippet") or ""

        all_docs.append({
            "id": doc.get("id", ""),
            "title": doc.get("title", "(untitled)"),
            "url": doc.get("url") or doc.get("viewURL", ""),
            "datasource": doc.get("datasource", ""),
            "snippet": snippet_text[:100] + "..." if len(snippet_text) > 100 else snippet_text,
        })

    if args.json:
        print(json.dumps({
            "datasource": datasource,
            "total_found": len(all_docs),
            "documents": all_docs,
        }, indent=2))
    else:
        print(f"Found {len(all_docs)} documents:\n")

        # Group by datasource type
        custom_docs = [d for d in all_docs if "CUSTOM" in d["id"]]
        web_docs = [d for d in all_docs if "WEB" in d["id"]]
        other_docs = [d for d in all_docs if "CUSTOM" not in d["id"] and "WEB" not in d["id"]]

        if custom_docs:
            print(f"\n📄 CUSTOM INTERNAL DOCUMENTS ({len(custom_docs)}):")
            print("=" * 60)
            for i, doc in enumerate(custom_docs, 1):
                print(f"\n{i}. {doc['title']}")
                print(f"   ID: {doc['id']}")
                print(f"   URL: {doc['url']}")
                if doc['snippet']:
                    print(f"   Preview: {doc['snippet']}")

        if web_docs:
            print(f"\n\n🌐 WEB DOCUMENTS ({len(web_docs)}):")
            print("=" * 60)
            for i, doc in enumerate(web_docs, 1):
                print(f"\n{i}. {doc['title']}")
                print(f"   ID: {doc['id']}")
                print(f"   URL: {doc['url']}")
                if doc['snippet']:
                    print(f"   Preview: {doc['snippet']}")

        if other_docs:
            print(f"\n\n📋 OTHER DOCUMENTS ({len(other_docs)}):")
            print("=" * 60)
            for i, doc in enumerate(other_docs, 1):
                print(f"\n{i}. {doc['title']}")
                print(f"   ID: {doc['id']}")
                print(f"   URL: {doc['url']}")
                if doc['snippet']:
                    print(f"   Preview: {doc['snippet']}")

        print(f"\n\n{'='*60}")
        print(f"Total: {len(all_docs)} documents")
        print(f"Latency: {result.latency_ms}ms")
        print(f"{'='*60}")

if __name__ == "__main__":
    main()
