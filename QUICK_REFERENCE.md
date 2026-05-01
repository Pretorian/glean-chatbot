# Quick Reference

One-page reference for common commands and usage patterns.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install && cd client && npm install && cd ..

# Configure
cp .env.example .env
nano .env  # Add your 3 Glean tokens

# Test environment
npm run test

# Index documents
npm run index && sleep 90

# Start app
npm run dev
```

**Open:** http://localhost:5173

---

## 📋 Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start full stack (backend + frontend) |
| `npm run dev:server` | Backend only (port 3001) |
| `npm run dev:client` | Frontend only (port 5173) |
| `npm run test` | Pre-flight smoke test |
| `npm run test:all` | Comprehensive test suite |
| `npm run test:auth` | Verify authentication |
| `npm run index` | Index documents from corpus/ (upsert via `/indexdocuments`) |
| `npm run index -- --bulk` | Full-sync upload via `/bulkindexdocuments` |
| `npm run mcp` | Run MCP server |

---

## 🌐 REST API Quick Reference

**Base URL:** `http://localhost:3001`

### Ask a Question

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}'
```

### Search Only

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "remote work", "maxResults": 5}'
```

### Health Check

```bash
curl http://localhost:3001/health
```

---

## 📝 Request Parameters

### /api/ask

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `question` | string | ✅ Yes | - | Question to answer |
| `maxSources` | integer | ❌ No | 5 | Max sources (1-10) |
| `datasourceFilter` | string | ❌ No | - | Filter to specific datasource |

### /api/search

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Search query |
| `maxResults` | integer | ❌ No | 5 | Max results |
| `datasourceFilter` | string | ❌ No | - | Filter to specific datasource |

---

## 🎯 Example Scripts

Located in `examples/` directory:

```bash
# Basic question
./examples/basic-question.sh

# Multiple questions
./examples/multiple-questions.sh

# Show sources only
./examples/show-sources.sh "Your question"

# Performance test
./examples/performance-test.sh
```

---

## 💡 Quick Tips

### Get just the answer:
```bash
curl -s http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "..."}' | jq -r '.answer'
```

### Get just sources:
```bash
curl -s http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "..."}' | jq '.sources'
```

### Get performance metrics:
```bash
curl -s http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "..."}' | jq '.meta.latencyMs'
```

### Faster responses (fewer sources):
```bash
curl http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "maxSources": 2}'
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | Start server: `npm run dev:server` |
| "Missing env variable" | Check `.env` has all 3 tokens |
| No search results | Wait 90s after indexing |
| Port already in use | Kill: `kill -9 $(lsof -ti:3001)` |
| Indexing 400 error | See INDEXING_ISSUE.md |

---

## 📊 Response Format

```json
{
  "answer": "The answer text...",
  "sources": [
    {
      "documentId": "...",
      "title": "Document Title",
      "url": "https://...",
      "snippet": "Preview text..."
    }
  ],
  "meta": {
    "retrievalCount": 5,
    "retrievedIds": ["..."],
    "latencyMs": {
      "searchMs": 682,
      "chatMs": 19183,
      "totalMs": 19866
    },
    "requestId": "uuid..."
  }
}
```

---

## 🎨 Web Interface

**URL:** http://localhost:5173

**Features:**
- Click example questions for quick testing
- Type custom questions
- View sources with links
- See performance metrics
- Auto-scrolling chat history

---

## 📦 File Structure

```
glean/
├── .env                    # Your configuration
├── corpus/                 # Documents to index (*.md, *.txt)
├── server/                 # Node.js backend
│   ├── config.ts
│   ├── glean-client.ts
│   ├── rag.ts
│   ├── index.ts           # REST API server
│   ├── mcp-server.ts      # MCP server
│   └── scripts/
│       ├── indexer.ts
│       ├── smoke-test.ts
│       └── test-*.ts
├── client/                 # React frontend
│   └── src/
│       ├── components/
│       └── api.ts
└── examples/               # Ready-to-run scripts
    ├── basic-question.sh
    ├── multiple-questions.sh
    ├── show-sources.sh
    └── performance-test.sh
```

---

## 🔗 Documentation

| Doc | Purpose |
|-----|---------|
| [START_HERE.md](START_HERE.md) | Navigation & getting started |
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup |
| [WALKTHROUGH.md](WALKTHROUGH.md) | Step-by-step guide |
| [TESTING.md](TESTING.md) | Testing guide |
| [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) | Comprehensive examples |
| [README_NODE.md](README_NODE.md) | Full technical docs |
| [INDEXING_ISSUE.md](INDEXING_ISSUE.md) | Indexing troubleshooting |

---

## ⚡ Performance Targets

| Metric | Target (p95) |
|--------|-------------|
| Search API | < 800ms |
| Chat API | < 20s |
| Total E2E | < 25s |

**Tip:** Reduce `maxSources` for faster responses!

---

## 🎓 Example Questions

Try these with your indexed documents:

- "What is our remote work policy?"
- "Who is eligible for remote work?"
- "What equipment does the company provide?"
- "Can I work from another country?"
- "What are the core working hours?"
- "What is the home office stipend?"
- "What are the security requirements?"

---

## 📞 Getting Help

1. Check documentation (see above)
2. Run diagnostics: `npm run test`
3. Check server logs
4. See WALKTHROUGH.md → Troubleshooting
5. Review INDEXING_ISSUE.md for indexing problems

---

**That's it!** You have everything you need to start using the Glean RAG Chatbot.

For detailed examples, see [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)
