# Glean RAG Chatbot — MCP Prototype

A small RAG-based enterprise chatbot built on the Glean Indexing, Search, and Chat APIs, exposed as a single MCP tool.

> **Companion documents:** See `DESIGN_NOTE.md` for the BTABoK-framed design discussion (canvases, ADRs, risks, tradeoffs). See `architecture_diagram.svg` for the data flow diagram.

---

## What this is

A working prototype that:

1. Indexes a small local corpus into a Glean sandbox datasource via the **Indexing API**.
2. Accepts a natural-language question from an MCP-compatible client (Cursor / Claude Desktop).
3. Retrieves relevant content via the **Search API**.
4. Generates a grounded answer with source citations via the **Chat API**.
5. Returns the answer and source references to the MCP client.

---

## Architecture (one-paragraph version)

The MCP client sends a question to a local MCP server (`mcp_server.py`) over stdio. The server invokes the RAG orchestrator (`rag.py`), which calls the Glean Search API for top-k retrieval, then the Glean Chat API for grounded generation, then validates that cited documents came from the retrieval set, and returns `{answer, sources[]}` to the client. A separate one-time indexer (`indexer.py`) pushes the local corpus to a sandbox datasource via the Indexing API using stable content-hash IDs for idempotency. See `architecture_diagram.svg` for the full picture.

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
│   ├── hr_remote_work_policy.md
│   ├── hr_expense_policy.md
│   ├── eng_oncall_runbook.md
│   └── ... (~20 docs total)
├── src/
│   ├── __init__.py
│   ├── config.py                ← env loading and validation
│   ├── glean_client.py          ← thin HTTP client w/ retries + logging
│   ├── indexer.py               ← corpus → Indexing API
│   ├── rag.py                   ← retrieve() + ground() + assemble()
│   └── mcp_server.py            ← MCP tool surface
└── tests/
    ├── test_rag.py
    └── test_indexer.py
```

---

## Setup

### 1. Prerequisites

- Python 3.11+
- A Glean sandbox tenant with API access
- An MCP-compatible client (Cursor or Claude Desktop) for interactive use

### 2. Install

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|---|---|
| `GLEAN_API_TOKEN` | Bearer token for the sandbox tenant |
| `GLEAN_INSTANCE` | Your Glean instance (e.g. `customer-be.glean.com`) |
| `GLEAN_DATASOURCE` | Datasource name (default: `custom_kb_prototype`) |
| `LOG_LEVEL` | `INFO` or `DEBUG` (default: `INFO`) |

### 4. Index the corpus (one-time)

```bash
python -m src.indexer
```

Expected output: per-document upsert logs and a final summary count. Re-running is idempotent — documents are keyed by stable content hash.

### 5. Run the MCP server

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
        "GLEAN_API_TOKEN": "...",
        "GLEAN_INSTANCE": "...",
        "GLEAN_DATASOURCE": "custom_kb_prototype"
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
| `datasource_filter` | string | no | all indexed | Restrict retrieval to a specific datasource |

**Returns:**

```json
{
  "answer": "Grounded answer text with inline citations.",
  "sources": [
    {
      "title": "Remote Work Policy",
      "url": "https://<instance>.glean.com/doc/...",
      "snippet": "Employees may work remotely up to...",
      "document_id": "custom_kb_prototype:abc123..."
    }
  ],
  "meta": {
    "retrieval_count": 5,
    "latency_ms": { "search": 420, "chat": 2100, "total": 2610 },
    "request_id": "uuid..."
  }
}
```

---

## Assumptions

- Sandbox datasource; service-account authentication; no per-user permission propagation. This is appropriate for the prototype and is called out explicitly as a production gap in `DESIGN_NOTE.md`.
- Corpus is ~20 synthetic documents; not real enterprise content.
- No chunking is performed in user code; we rely on Glean's indexing-side chunking.
- Latency targets assume a warm path; cold starts may exceed the p95 budget.

---

## What I'd do next

Summarized from the design note's Phase 1 / Phase 2 roadmap:

1. Replace service-account auth with user-delegated auth (SSO/OAuth) and search-as-user.
2. Build a small evaluation harness with a gold set of (question, expected-sources, expected-answer-traits) tuples.
3. Add streaming response support on the MCP surface.
4. Add OpenTelemetry tracing end-to-end.
5. Harden against prompt injection and add an output policy layer.

See `DESIGN_NOTE.md` § 8 for the full list and `DESIGN_NOTE.md` § 5 for the risk register that drives the priority order.
