"""
Configuration loading and validation.

Fails loudly at startup if required environment variables are missing — better
than a cryptic error three API calls deep.

Note on tokens (ADR-004): Glean deliberately separates indexing auth from
client auth. We model that separation here by accepting three tokens:
    - Indexing token   — privileged back-end write path.
    - Search token     — user-facing read path (optional; Client token also works).
    - Client token     — Chat + Search; represents an end-user-style identity.
This isn't pedantry — it matches how a customer would wire this up in prod,
where the indexing pipeline runs under a service identity and Chat/Search
run as the end user.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    # --- Instance + datasource ---
    glean_instance: str             # e.g. "support-lab-be.glean.com"
    glean_datasource: str           # one of interviewds, interviewds2 ... interviewds6

    # --- Tokens (three distinct ones) ---
    glean_indexing_token: str       # Indexing API
    glean_client_token: str         # Chat + Search (Global scope)
    glean_search_token: Optional[str]  # optional dedicated Search token

    # --- Behavior ---
    log_level: str
    default_max_sources: int
    http_timeout_s: float
    retry_max_attempts: int

    @property
    def indexing_base_url(self) -> str:
        return f"https://{self.glean_instance}/api/index/v1"

    @property
    def rest_base_url(self) -> str:
        return f"https://{self.glean_instance}/rest/api/v1"

    def token_for_search(self) -> str:
        """Prefer a dedicated Search token if provided; fall back to Client token."""
        return self.glean_search_token or self.glean_client_token


def _require(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"See .env.example for the full list."
        )
    return val


def load_config() -> Config:
    return Config(
        glean_instance=os.environ.get("GLEAN_INSTANCE", "support-lab-be.glean.com"),
        glean_datasource=os.environ.get("GLEAN_DATASOURCE", "interviewds"),
        glean_indexing_token=_require("GLEAN_INDEXING_TOKEN"),
        glean_client_token=_require("GLEAN_CLIENT_TOKEN"),
        glean_search_token=os.environ.get("GLEAN_SEARCH_TOKEN") or None,
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        default_max_sources=int(os.environ.get("DEFAULT_MAX_SOURCES", "5")),
        http_timeout_s=float(os.environ.get("HTTP_TIMEOUT_S", "30")),
        retry_max_attempts=int(os.environ.get("RETRY_MAX_ATTEMPTS", "3")),
    )
