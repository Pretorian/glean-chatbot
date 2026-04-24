"""
Thin HTTP client for the Glean APIs.

Responsibilities:
- Attach auth headers.
- Retry on transient failures (429, 5xx, network) with exponential backoff.
- Emit structured logs with per-call latency and request IDs.
- Surface non-transient errors clearly.

Deliberately NOT:
- An abstraction over all of Glean's API. We add methods as we use them.
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


class GleanClient:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._http = httpx.Client(
            timeout=cfg.http_timeout_s,
            headers={
                "Authorization": f"Bearer {cfg.glean_api_token}",
                "Content-Type": "application/json",
                "User-Agent": "glean-rag-prototype/0.1",
            },
        )

    def close(self) -> None:
        self._http.close()

    # ---- public, API-specific methods -------------------------------------

    def index_documents(self, documents: list[dict]) -> CallResult:
        """
        Bulk upsert documents to the configured datasource.
        TODO: confirm exact Indexing API payload shape against sandbox docs.
        """
        url = f"{self.cfg.indexing_base_url}/documents"
        payload = {
            "datasource": self.cfg.glean_datasource,
            "documents": documents,
        }
        return self._post(url, payload, op="index_documents")

    def search(self, query: str, page_size: int = 5, datasource: Optional[str] = None) -> CallResult:
        """
        Ranked retrieval for a natural-language query.
        TODO: confirm Search request schema (datasource filter, facets) from docs.
        """
        url = f"{self.cfg.rest_base_url}/search"
        payload: dict[str, Any] = {
            "query": query,
            "pageSize": page_size,
        }
        if datasource:
            payload["requestOptions"] = {
                "datasourceFilter": [datasource],
            }
        return self._post(url, payload, op="search")

    def chat(self, message: str, context_docs: list[dict]) -> CallResult:
        """
        Grounded generation. We pass retrieved documents as inline context.
        TODO: confirm how Chat API expects supplied context in the sandbox build.
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
            # The exact field name for user-supplied context varies by Glean version.
            # Check docs; common patterns: inlineDocs, contextDocuments, attachedDocs.
            "inlineDocs": context_docs,
        }
        return self._post(url, payload, op="chat")

    # ---- internals --------------------------------------------------------

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
                extra={"op": op, "url": url, "request_id": request_id, "err": str(e)},
            )
            raise GleanTransientError(str(e)) from e

        latency_ms = int((time.monotonic() - started) * 1000)
        log.info(
            "glean_api_call",
            extra={
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

        return CallResult(status=resp.status_code, json=body, latency_ms=latency_ms, request_id=request_id)
