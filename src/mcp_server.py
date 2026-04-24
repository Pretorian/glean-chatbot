"""
MCP server exposing `ask_knowledge_base` as a single tool.

Runs over stdio for local MCP clients (Cursor, Claude Desktop).

Also supports a `--test` flag for interactive verification without an MCP client.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .config import load_config
from .glean_client import QueryClient
from .rag import answer_question

log = logging.getLogger(__name__)

TOOL_NAME = "ask_knowledge_base"
TOOL_DESCRIPTION = (
    "Ask a natural-language question against the indexed Glean corpus and "
    "receive a grounded answer with source citations. Use this when the user "
    "needs information that might live in company documents, policies, runbooks, "
    "or other indexed knowledge."
)

TOOL_INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "question": {
            "type": "string",
            "description": "The natural-language question to answer.",
        },
        "max_sources": {
            "type": "integer",
            "description": "Maximum number of sources to retrieve (default 5).",
            "minimum": 1,
            "maximum": 10,
        },
        "datasource_filter": {
            "type": "string",
            "description": "Optional: restrict retrieval to a specific datasource.",
        },
    },
    "required": ["question"],
}


def _build_server(client: QueryClient, default_max_sources: int) -> Server:
    server = Server("glean-rag")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name=TOOL_NAME,
                description=TOOL_DESCRIPTION,
                inputSchema=TOOL_INPUT_SCHEMA,
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        if name != TOOL_NAME:
            raise ValueError(f"Unknown tool: {name}")

        request_id = str(uuid.uuid4())
        question = arguments.get("question", "").strip()
        if not question:
            return [TextContent(type="text", text=json.dumps({"error": "question is required"}))]

        max_sources = int(arguments.get("max_sources") or default_max_sources)
        datasource_filter = arguments.get("datasource_filter") or None

        log.info(
            "mcp_tool_invoked",
            extra={"request_id": request_id, "tool": name, "max_sources": max_sources},
        )

        try:
            result = answer_question(
                client,
                question=question,
                max_sources=max_sources,
                datasource_filter=datasource_filter,
                request_id=request_id,
            )
        except Exception as e:
            log.exception("mcp_tool_error", extra={"request_id": request_id})
            result = {
                "error": str(e),
                "request_id": request_id,
            }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    return server


async def _run_stdio() -> None:
    cfg = load_config()
    logging.basicConfig(level=cfg.log_level)
    client = QueryClient(cfg)
    server = _build_server(client, cfg.default_max_sources)

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def _run_test(question: str) -> None:
    cfg = load_config()
    logging.basicConfig(level=cfg.log_level)
    client = QueryClient(cfg)
    result = answer_question(
        client,
        question=question,
        max_sources=cfg.default_max_sources,
        request_id=str(uuid.uuid4()),
    )
    print(json.dumps(result, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Glean RAG MCP server")
    parser.add_argument(
        "--test",
        metavar="QUESTION",
        help="Bypass MCP and run a single question for local verification.",
    )
    args = parser.parse_args()

    if args.test:
        _run_test(args.test)
    else:
        asyncio.run(_run_stdio())


if __name__ == "__main__":
    main()