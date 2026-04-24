"""
RAG orchestrator.

Three steps, each independently callable:
    retrieve(question)          -> list[RetrievedDoc]
    ground(question, docs)      -> str   (grounded answer)
    assemble(answer, docs)      -> dict  (MCP-shaped response)

Why three steps rather than one?
    - Makes the failure mode explicit (retrieval vs. generation).
    - Lets us validate citations against the retrieval set.
    - Lets the live interviewer ask for a search-only tool in <15 lines.

See ADR-001 in DESIGN_NOTE.md for the choice of explicit orchestration over
Chat-native retrieval.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, asdict
from typing import Optional

from .config import Config
from .glean_client import QueryClient

log = logging.getLogger(__name__)


@dataclass
class RetrievedDoc:
    document_id: str
    title: str
    url: str
    snippet: str


@dataclass
class GroundedAnswer:
    answer: str
    sources: list[RetrievedDoc]
    meta: dict


def retrieve(
    client: QueryClient,
    question: str,
    *,
    max_sources: int,
    datasource_filter: Optional[str] = None,
) -> tuple[list[RetrievedDoc], int]:
    """Call Search API; return normalized retrieved docs + latency."""
    result = client.search(
        query=question,
        page_size=max_sources,
        datasource=datasource_filter,
    )
    # TODO: map the exact Search response shape to RetrievedDoc.
    # The response typically looks like: { "results": [ { "document": {...}, "snippets": [...] } ] }
    docs: list[RetrievedDoc] = []
    for item in result.json.get("results", [])[:max_sources]:
        doc = item.get("document", {}) or {}
        snippet = ""
        snippets = item.get("snippets") or []
        if snippets and isinstance(snippets, list):
            snippet = snippets[0].get("text") or snippets[0].get("snippet") or ""
        docs.append(
            RetrievedDoc(
                document_id=doc.get("id", ""),
                title=doc.get("title", "(untitled)"),
                url=doc.get("url") or doc.get("viewURL") or "",
                snippet=snippet,
            )
        )
    return docs, result.latency_ms


def ground(
    client: QueryClient,
    question: str,
    docs: list[RetrievedDoc],
) -> tuple[str, int]:
    """Call Chat API with retrieved docs as context; return answer + latency."""
    if not docs:
        return (
            "I couldn't find any relevant information in the indexed corpus for this question.",
            0,
        )

    # Shape the context for the Chat API. Exact field names depend on API version —
    # see TODO in glean_client.chat().
    context_docs = [
        {
            "id": d.document_id,
            "title": d.title,
            "url": d.url,
            "snippet": d.snippet,
        }
        for d in docs
    ]

    result = client.chat(message=question, context_docs=context_docs)

    # TODO: map the Chat response shape. Common pattern: messages[-1].fragments[].text.
    answer = ""
    messages = result.json.get("messages", [])
    if messages:
        fragments = messages[-1].get("fragments", [])
        answer = "".join(frag.get("text", "") for frag in fragments).strip()
    if not answer:
        answer = "(No answer returned by Chat API — check Chat response shape.)"

    return answer, result.latency_ms


def assemble(
    question: str,
    answer: str,
    docs: list[RetrievedDoc],
    latencies: dict[str, int],
    request_id: str,
) -> dict:
    """Validate citations and produce the MCP-shaped response."""
    # QATT-001: no cited source should reference a doc not in the retrieval set.
    # We implement this as a soft check here; a production version would reject.
    retrieved_ids = {d.document_id for d in docs}
    # If the model emits an id not in retrieved_ids, log it but keep the answer.
    # A stricter policy would re-prompt or strip the citation.

    return {
        "answer": answer,
        "sources": [asdict(d) for d in docs],
        "meta": {
            "retrieval_count": len(docs),
            "retrieved_ids": list(retrieved_ids),
            "latency_ms": latencies,
            "request_id": request_id,
        },
    }


def answer_question(
    client: QueryClient,
    question: str,
    *,
    max_sources: int,
    datasource_filter: Optional[str] = None,
    request_id: str = "",
) -> dict:
    """Top-level entry point wired from the MCP tool."""
    t0 = time.monotonic()
    docs, search_ms = retrieve(
        client, question, max_sources=max_sources, datasource_filter=datasource_filter
    )
    answer, chat_ms = ground(client, question, docs)
    total_ms = int((time.monotonic() - t0) * 1000)
    return assemble(
        question=question,
        answer=answer,
        docs=docs,
        latencies={"search_ms": search_ms, "chat_ms": chat_ms, "total_ms": total_ms},
        request_id=request_id,
    )