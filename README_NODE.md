# Glean RAG Chatbot — Node.js/TypeScript/React Stack

A modern RAG-based enterprise chatbot built on the Glean Indexing, Search, and Chat APIs, featuring a React web interface and Node.js backend with TypeScript.

Built against the `support-lab` sandbox using the `interviewds` datasource.

> **📖 New here?** Start with **[START_HERE.md](START_HERE.md)** for guided documentation paths.
>
> **🚀 Quick setup?** See **[QUICKSTART.md](QUICKSTART.md)** (5 minutes)
>
> **📋 Step-by-step?** See **[WALKTHROUGH.md](WALKTHROUGH.md)** (detailed guide with expected outputs)
>
> **🧪 Need to test?** See **[TESTING.md](TESTING.md)** (comprehensive testing guide)
>
> **💡 Usage examples?** See **[USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)** and **[examples/](examples/)**
>
> **⚡ Quick reference?** See **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (one-page cheat sheet)

---

## What this is

A full-stack application that:

1. **Indexes** a local corpus into the `interviewds` sandbox datasource via the **Indexing API** (Node.js backend)
2. **Accepts** natural-language questions from a web interface (React frontend)
3. **Retrieves** relevant content via the **Search API** (backend)
4. **Generates** grounded answers with source citations via the **Chat API** (backend)
5. **Displays** answers and sources in an interactive chat interface (React frontend)

---

## Architecture

**Backend (Node.js/TypeScript + Express):**
- REST API server exposing `/api/ask` and `/api/search` endpoints
- Glean API clients (IndexingClient, QueryClient)
- RAG orchestrator (retrieve, ground, assemble)
- MCP server support (optional, for MCP-compatible clients)

**Frontend (React + Vite):**
- Modern chat interface with real-time messaging
- Source citations with links
- Performance metrics display
- Responsive design

---

## Project Layout

```
.
├── README_NODE.md                    ← this file
├── package.json                      ← root package.json
├── tsconfig.json                     ← TypeScript config
├── .env.example                      ← template for required env vars
├── corpus/                           ← sample document set
│   └── hr_remote_work_policy.md
├── server/                           ← Node.js/TypeScript backend
│   ├── config.ts                     ← env loading, typed config
│   ├── glean-client.ts               ← IndexingClient + QueryClient
│   ├── rag.ts                        ← retrieve() + ground() + assemble()
│   ├── index.ts                      ← Express REST API server
│   ├── mcp-server.ts                 ← MCP tool surface (optional)
│   └── scripts/
│       └── indexer.ts                ← corpus → Indexing API
└── client/                           ← React frontend
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts                    ← API client
        ├── types.ts                  ← TypeScript types
        └── components/
            ├── ChatInterface.tsx
            ├── MessageList.tsx
            ├── MessageBubble.tsx
            ├── SourcesList.tsx
            └── QuestionInput.tsx
```

---

## Setup

### 1. Prerequisites

- **Node.js 18+** and npm
- Sandbox credentials from the exercise instructions (instance `support-lab`, three tokens, login `alex@glean-sandbox.com`)
- (Optional) An MCP-compatible client (Cursor or Claude Desktop) for MCP mode

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Configure Environment

Copy `.env.example` to `.env` and paste in the three sandbox tokens:

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

| Variable | Purpose | Default |
|---|---|---|
| `GLEAN_SEARCH_TOKEN` | Dedicated Search token | Falls back to `GLEAN_CLIENT_TOKEN` |
| `LOG_LEVEL` | `INFO` or `DEBUG` | `INFO` |
| `DEFAULT_MAX_SOURCES` | Default top-k for retrieval | `5` |
| `PORT` | Backend server port | `3001` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |

### 4. Index the Corpus

```bash
npm run index
```

The indexer picks up `*.md` and `*.txt` files from `corpus/`. Pass `--bulk` to use the `/bulkindexdocuments` endpoint for full-sync uploads (`--page-size=N`, `--force-restart` also accepted).

Expected output: per-document upsert logs and a final summary count. Re-running is idempotent — documents are keyed by stable content hash.

**Note on indexing latency:** The Indexing API is asynchronous. Documents are typically searchable within a minute or two after a successful 200 response, but not instantly. Wait before testing retrieval.

### 5. Run the Application

#### Full-stack mode (Recommended):

```bash
npm run dev
```

This starts both:
- Backend API server on `http://localhost:3001`
- React dev server on `http://localhost:5173`

Open `http://localhost:5173` in your browser to use the chat interface.

#### Backend only:

```bash
npm run dev:server
```

API will be available at `http://localhost:3001/api/ask`

#### Frontend only:

```bash
npm run dev:client
```

Requires backend to be running separately.

---

## API Endpoints

### `POST /api/ask`

Ask a natural-language question and receive a grounded answer with sources.

**Request:**
```json
{
  "question": "What is our remote work policy?",
  "maxSources": 5,
  "datasourceFilter": "interviewds"
}
```

**Response:**
```json
{
  "answer": "Grounded answer text with inline citations.",
  "sources": [
    {
      "documentId": "interviewds:abc123...",
      "title": "Remote Work Policy",
      "url": "https://support-lab-be.glean.com/doc/...",
      "snippet": "Employees may work remotely up to..."
    }
  ],
  "meta": {
    "retrievalCount": 5,
    "retrievedIds": ["interviewds:abc123..."],
    "latencyMs": {
      "searchMs": 420,
      "chatMs": 2100,
      "totalMs": 2610
    },
    "requestId": "uuid..."
  }
}
```

### `POST /api/search`

Search-only endpoint (retrieval without generation).

**Request:**
```json
{
  "query": "remote work",
  "maxResults": 5,
  "datasourceFilter": "interviewds"
}
```

### `GET /health`

Health check endpoint.

### `GET /api/config`

Returns current configuration (for debugging).

---

## MCP Server Mode (Optional)

The backend also supports MCP (Model Context Protocol) for use with Cursor or Claude Desktop.

### Test mode:

```bash
npm run mcp -- --test "What is our remote work policy?"
```

### MCP client configuration:

Add to your MCP client config (e.g., Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "node",
      "args": ["--loader", "tsx", "server/mcp-server.ts"],
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

## Building for Production

```bash
# Build both backend and frontend
npm run build

# Backend built to: dist/server/
# Frontend built to: client/dist/

# Run production server
npm start
```

For production deployment:
1. Build the application
2. Serve `client/dist/` as static files
3. Run the backend server from `dist/server/index.js`
4. Configure environment variables on your hosting platform

---

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both backend and frontend in dev mode |
| `npm run dev:server` | Run backend only |
| `npm run dev:client` | Run frontend only |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run index` | Index corpus documents (upsert via `/indexdocuments`) |
| `npm run index -- --bulk` | Full-sync upload via `/bulkindexdocuments` |
| `npm run mcp` | Run MCP server |
| `npm run test` | Run smoke tests |
| `npm run lint` | Lint TypeScript code |
| `npm run type-check` | Check TypeScript types |

---

## Tech Stack

**Backend:**
- Node.js 18+
- TypeScript 5
- Express (REST API)
- Axios (HTTP client with retry logic)
- @modelcontextprotocol/sdk (MCP support)

**Frontend:**
- React 18
- TypeScript 5
- Vite (build tool & dev server)
- CSS3 (no framework, custom styling)

---

## Migration from Python

This codebase is a complete refactor of the original Python implementation:

| Python | Node.js/TypeScript |
|--------|-------------------|
| `src/config.py` | `server/config.ts` |
| `src/glean_client.py` | `server/glean-client.ts` |
| `src/rag.py` | `server/rag.ts` |
| `src/indexer.py` | `server/scripts/indexer.ts` |
| `src/mcp_server.py` | `server/mcp-server.ts` |
| N/A | `server/index.ts` (Express API) |
| N/A | `client/` (React frontend) |

All functionality from the Python version is preserved, with the addition of:
- Modern web UI with React
- REST API for broader client support
- TypeScript type safety
- Better development experience

---

## Assumptions

- Sandbox datasource `interviewds`; service-identity authentication via three Glean-issued tokens
- No per-user permission propagation (appropriate for prototype)
- Corpus is a small set of synthetic markdown documents
- No chunking in user code; relies on Glean's indexing-side chunking
- Latency targets assume warm path; cold starts may exceed p95 budget
- Indexing is asynchronous

---

## Troubleshooting

**Backend won't start:**
- Check that all required environment variables are set in `.env`
- Ensure port 3001 is not in use
- Run `npm install` to install dependencies

**Frontend won't connect to backend:**
- Ensure backend is running on port 3001
- Check CORS_ORIGINS includes your frontend URL
- Verify proxy configuration in `client/vite.config.ts`

**Documents not indexing:**
- Check that corpus directory exists and contains `.md` or `.txt` files
- Verify GLEAN_INDEXING_TOKEN is correct
- Wait 1-2 minutes after indexing for documents to become searchable

**Search returns no results:**
- Verify documents were indexed successfully
- Check that GLEAN_DATASOURCE matches the indexed datasource
- Ensure sufficient time has passed after indexing

---

## What's Next

See `DESIGN_NOTE.md` for the full productionization plan covering:
- Multi-team support
- Support chatbot integration
- Stronger permissions
- Observability
- Rollout controls
