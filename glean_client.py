"""
Thin HTTP clients for the Glean APIs, split by trust domain.

IndexingClient — uses the Indexing token; writes to the knowledge graph.
QueryClient    — uses the Client token; reads via Search and Chat.

This split mirrors Glean's own token model (separate Indexing vs Client tokens)
and makes the auth boundary obvious in code. See ADR-004 in DESIGN_NOTE.md.

Responsibilities:
- Attach auth headers per client.
- Retry on transient failures (429, 5xx, network) with exponential backoff.
- Emit structured logs with per-call latency and request IDs.
- Surface non-transient errors clearly.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .config import Config

log = logging.getLogger(__name__)


class GleanAPIError(Exception):
    """Non-transient API error we should surface to the caller."""

    def __init__(self, status: int, body: str, request_id: str):
        super().__init__(f"Glean API error {status} (request_id={request_id}): {body[:500]}")
        self.status = status
        self.body = body
        self.request_id = request_id


class GleanTransientError(Exception):
    """Transient error — retry candidate."""


@dataclass
class CallResult:
    status: int
    json: dict[str, Any]
    latency_ms: int
    request_id: str


class _BaseClient:
    """Shared transport layer; subclasses provide their own auth token."""

    def __init__(self, cfg: Config, token: str, label: str):
        self.cfg = cfg
        self.label = label
        self._http = httpx.Client(
            timeout=cfg.http_timeout_s,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "glean-rag-prototype/0.1",
            },
        )

    def close(self) -> None:
        self._http.close()

    @retry(
        retry=retry_if_exception_type(GleanTransientError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=4),
        reraise=True,
    )
    def _post(self, url: str, payload: dict, *, op: str) -> CallResult:
        request_id = str(uuid.uuid4())
        started = time.monotonic()
        try:
            resp = self._http.post(url, json=payload)
        except httpx.RequestError as e:
            log.warning(
                "glean_api_network_error",
                extra={"client": self.label, "op": op, "url": url,
                       "request_id": request_id, "err": str(e)},
            )
            raise GleanTransientError(str(e)) from e

        latency_ms = int((time.monotonic() - started) * 1000)
        log.info(
            "glean_api_call",
            extra={
                "client": self.label,
                "op": op,
                "status": resp.status_code,
                "latency_ms": latency_ms,
                "request_id": request_id,
            },
        )

        if resp.status_code == 429 or 500 <= resp.status_code < 600:
            raise GleanTransientError(
                f"{resp.status_code} on {op} (request_id={request_id})"
            )
        if resp.status_code >= 400:
            raise GleanAPIError(resp.status_code, resp.text, request_id)

        try:
            body = resp.json()
        except json.JSONDecodeError as e:
            raise GleanAPIError(resp.status_code, resp.text, request_id) from e

        return CallResult(
            status=resp.status_code, json=body,
            latency_ms=latency_ms, request_id=request_id,
        )


class IndexingClient(_BaseClient):
    """Writes documents to the sandbox datasource via the Indexing API."""

    def __init__(self, cfg: Config):
        super().__init__(cfg, token=cfg.glean_indexing_token, label="indexing")

    def index_documents(self, documents: list[dict]) -> CallResult:
        """
        Bulk upsert documents to the configured datasource.
        Note: Indexing is asynchronous — documents may not be immediately
        searchable after this call returns 200.
        """
        url = f"{self.cfg.indexing_base_url}/bulkindexdocuments"
        payload = {
            "datasource": self.cfg.glean_datasource,
            "documents": documents,
            # uploadId makes re-runs idempotent on Glean's side too.
            "uploadId": f"prototype-{int(time.time())}",
        }
        return self._post(url, payload, op="index_documents")


class QueryClient(_BaseClient):
    """Reads via Search and Chat APIs using the Client (or Search) token."""

    def __init__(self, cfg: Config):
        super().__init__(cfg, token=cfg.token_for_search(), label="query")

    def search(
        self,
        query: str,
        page_size: int = 5,
        datasource: Optional[str] = None,
    ) -> CallResult:
        """Ranked retrieval for a natural-language query."""
        url = f"{self.cfg.rest_base_url}/search"
        payload: dict[str, Any] = {
            "query": query,
            "pageSize": page_size,
        }
        if datasource:
            payload["requestOptions"] = {
                "datasourcesFilter": [datasource],
            }
        return self._post(url, payload, op="search")

    def chat(self, message: str, context_docs: list[dict]) -> CallResult:
        """
        Grounded generation. We pass retrieved documents as inline context.

        Note: Chat can also retrieve against the tenant's indexed content
        on its own (ADR-001). We supply context explicitly here because the
        exercise requires using all three APIs.
        """
        url = f"{self.cfg.rest_base_url}/chat"
        payload = {
            "messages": [
                {
                    "author": "USER",
                    "messageType": "CONTENT",
                    "fragments": [{"text": message}],
                }
            ],
            "inlineDocs": context_docs,
        }
        return self._post(url, payload, op="chat")
