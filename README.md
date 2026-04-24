# Glean RAG Chatbot — MCP Prototype

A small RAG-based enterprise chatbot built on the Glean Indexing, Search, and Chat APIs, exposed as a single MCP tool. Built against the `support-lab` sandbox using the `interviewds` datasource.

> **Companion documents:** See `DESIGN_NOTE.md` for the BTABoK-framed design discussion (canvases, ADRs, risks, productionization plan). See `architecture_diagram.svg` for the data flow diagram.

---

## What this is

A working prototype that:

1. Indexes a small local corpus into the `interviewds` sandbox datasource via the **Indexing API**.
2. Accepts a natural-language question from an MCP-compatible client (Cursor / Claude Desktop).
3. Retrieves relevant content via the **Search API**.
4. Generates a grounded answer with source citations via the **Chat API**.
5. Returns the answer and source references to the MCP client.

---

## Architecture (one-paragraph version)

The MCP client sends a question to a local MCP server (`mcp_server.py`) over stdio. The server invokes the RAG orchestrator (`rag.py`), which calls the Glean Search API via the `QueryClient` for top-k retrieval, then the Glean Chat API for grounded generation, then validates that cited documents came from the retrieval set, and returns `{answer, sources[]}` to the client. A separate one-time indexer (`indexer.py`) uses the privileged `IndexingClient` to push the local corpus to the `interviewds` sandbox datasource, with stable content-hash IDs for idempotency. The two client classes exist to honor Glean's separation of indexing and client auth tokens — see ADR-004. Full flow in `architecture_diagram.svg`.

---

## Project layout

```
.
├── README.md                    ← this file
├── DESIGN_NOTE.md               ← BTABoK-framed design note
├── architecture_diagram.svg     ← companion data flow diagram
├── .env.example                 ← template for required env vars
├── .gitignore
├── requirements.txt
├── corpus/                      ← small sample document set
│   └── hr_remote_work_policy.md
├── src/
│   ├── __init__.py
│   ├── config.py                ← env loading, typed config, three tokens
│   ├── glean_client.py          ← IndexingClient + QueryClient
│   ├── indexer.py               ← corpus → Indexing API
│   ├── rag.py                   ← retrieve() + ground() + assemble()
│   └── mcp_server.py            ← MCP tool surface
└── scripts/
    └── smoke_test.py            ← pre-flight end-to-end check
```

---

## Setup

### 1. Prerequisites

- Python 3.11+
- Sandbox credentials from the exercise instructions (instance `support-lab`, three tokens, login `alex@glean-sandbox.com`)
- An MCP-compatible client (Cursor or Claude Desktop) for interactive use

### 2. Install

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure

Copy `.env.example` to `.env` and paste in the three sandbox tokens from the instructions PDF:

```bash
cp .env.example .env
# then edit .env and paste tokens
```

Required variables:

| Variable | Purpose |
|---|---|
| `GLEAN_INDEXING_TOKEN` | Indexing API (back-end write path) |
| `GLEAN_CLIENT_TOKEN` | Chat + Search (Global scope) |
| `GLEAN_INSTANCE` | `support-lab-be.glean.com` |
| `GLEAN_DATASOURCE` | One of `interviewds` … `interviewds6` (default: `interviewds`) |

Optional:

| Variable | Purpose |
|---|---|
| `GLEAN_SEARCH_TOKEN` | Dedicated Search token; falls back to `GLEAN_CLIENT_TOKEN` if unset |
| `LOG_LEVEL` | `INFO` or `DEBUG` (default: `INFO`) |
| `DEFAULT_MAX_SOURCES` | Default top-k for retrieval (default: `5`) |

### 4. Verify environment (smoke test)

```bash
python -m scripts.smoke_test
```

This runs a minimal end-to-end sanity check: auth with each token, a trivial Search call, a trivial Chat call. Run this before touching anything else — and again before the live interview.

### 5. Index the corpus (one-time)

```bash
python -m src.indexer
```

Expected output: per-document upsert logs and a final summary count. Re-running is idempotent — documents are keyed by stable content hash.

**Note on indexing latency.** The Indexing API is asynchronous. Documents are typically searchable within a minute or two after a successful 200 response, but not instantly. Wait before testing retrieval.

### 6. Run the MCP server

For interactive testing without an MCP client:

```bash
python -m src.mcp_server --test "What is our remote work policy?"
```

For use with Cursor or Claude Desktop, add to your MCP config (example for Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "python",
      "args": ["-m", "src.mcp_server"],
      "cwd": "/absolute/path/to/this/repo",
      "env": {
        "GLEAN_INDEXING_TOKEN": "...",
        "GLEAN_CLIENT_TOKEN": "...",
        "GLEAN_INSTANCE": "support-lab-be.glean.com",
        "GLEAN_DATASOURCE": "interviewds"
      }
    }
  }
}
```

Then restart the client. The tool `ask_knowledge_base` will be available.

---

## The MCP tool

### `ask_knowledge_base`

Ask a natural-language question against the indexed corpus and receive a grounded answer with source citations.

**Parameters:**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `question` | string | yes | — | The natural-language question |
| `max_sources` | integer | no | 5 | Maximum number of sources to retrieve and consider |
| `datasource_filter` | string | no | configured default | Restrict retrieval to a specific datasource |

**Returns:**

```json
{
  "answer": "Grounded answer text with inline citations.",
  "sources": [
    {
      "title": "Remote Work Policy",
      "url": "https://support-lab-be.glean.com/doc/...",
      "snippet": "Employees may work remotely up to...",
      "document_id": "interviewds:abc123..."
    }
  ],
  "meta": {
    "retrieval_count": 5,
    "latency_ms": { "search_ms": 420, "chat_ms": 2100, "total_ms": 2610 },
    "request_id": "uuid..."
  }
}
```

---

## Assumptions

- Sandbox datasource `interviewds`; service-identity authentication via three Glean-issued tokens; no per-user permission propagation. This is appropriate for the prototype and is called out explicitly as a production gap in `DESIGN_NOTE.md` § 8.3.
- Corpus is a small set of synthetic markdown documents; not real enterprise content.
- No chunking is performed in user code; we rely on Glean's indexing-side chunking.
- Latency targets assume a warm path; cold starts may exceed the p95 budget.
- Indexing is asynchronous — the indexer does not block waiting for documents to become searchable.

---

## What I'd do next

See `DESIGN_NOTE.md` § 8 for the full productionization plan structured around the four concerns in the Part 2 prompt: multiple teams, support chatbot integration, stronger permissions, observability, and rollout controls — with a design → build → test → rollout schedule.
