"""
Configuration loading and validation.

Fails loudly at startup if required environment variables are missing — better
than a cryptic error three API calls deep.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    glean_api_token: str
    glean_instance: str         # e.g. "customer-be.glean.com"
    glean_datasource: str       # e.g. "custom_kb_prototype"
    log_level: str
    default_max_sources: int
    http_timeout_s: float
    retry_max_attempts: int

    @property
    def indexing_base_url(self) -> str:
        # Indexing API lives on the indexing subdomain in most Glean tenants.
        # TODO: confirm with sandbox docs during implementation.
        return f"https://{self.glean_instance}/api/index/v1"

    @property
    def rest_base_url(self) -> str:
        return f"https://{self.glean_instance}/rest/api/v1"


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
        glean_api_token=_require("GLEAN_API_TOKEN"),
        glean_instance=_require("GLEAN_INSTANCE"),
        glean_datasource=os.environ.get("GLEAN_DATASOURCE", "custom_kb_prototype"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        default_max_sources=int(os.environ.get("DEFAULT_MAX_SOURCES", "5")),
        http_timeout_s=float(os.environ.get("HTTP_TIMEOUT_S", "30")),
        retry_max_attempts=int(os.environ.get("RETRY_MAX_ATTEMPTS", "3")),
    )
