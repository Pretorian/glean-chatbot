# Setup Summary - Glean RAG Chatbot (Node.js Stack)

Quick reference guide for the refactored Node.js/TypeScript/React implementation.

---

## Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **QUICKSTART.md** | Get running in 5 minutes | First time setup |
| **WALKTHROUGH.md** | Step-by-step setup with expected outputs | Detailed setup guidance |
| **TESTING.md** | Comprehensive testing guide | Verify everything works |
| **README_NODE.md** | Full technical documentation | Reference & deployment |
| **README.md** | Original Python documentation | Design & architecture |
| **test-all.sh** | Automated test suite | Quick validation |

---

## Quick Command Reference

### Initial Setup

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
nano .env  # Add your 3 Glean tokens

# 3. Run smoke test
npm run test

# 4. Index documents
npm run index

# 5. Start application
npm run dev
```

### Daily Usage

```bash
# Start full stack
npm run dev

# Backend only
npm run dev:server

# Frontend only
npm run dev:client

# Run comprehensive tests
npm run test:all
# or
./test-all.sh

# Re-index documents (add --bulk for full-sync upload via /bulkindexdocuments)
npm run index

# MCP test mode
npm run mcp -- --test "Your question"
```

### Build & Deploy

```bash
# Type check
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Run production build
npm start
```

---

## File Structure Overview

```
glean/
├── Documentation
│   ├── QUICKSTART.md          ← 5-minute setup
│   ├── WALKTHROUGH.md         ← Detailed walkthrough
│   ├── TESTING.md             ← Testing guide
│   ├── README_NODE.md         ← Node.js docs
│   └── README.md              ← Original Python docs
│
├── Configuration
│   ├── package.json           ← Root dependencies & scripts
│   ├── tsconfig.json          ← TypeScript config
│   ├── .env.example           ← Environment template
│   ├── .env                   ← Your tokens (gitignored)
│   └── .gitignore
│
├── Backend (server/)
│   ├── config.ts              ← Environment & config
│   ├── glean-client.ts        ← API clients (Indexing, Query)
│   ├── rag.ts                 ← RAG orchestration
│   ├── index.ts               ← Express REST API
│   ├── mcp-server.ts          ← MCP server (optional)
│   └── scripts/
│       ├── indexer.ts         ← Document indexer
│       └── smoke-test.ts      ← Pre-flight checks
│
├── Frontend (client/)
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx           ← Entry point
│       ├── App.tsx            ← Root component
│       ├── api.ts             ← API client
│       ├── types.ts           ← TypeScript types
│       └── components/
│           ├── ChatInterface.tsx
│           ├── MessageList.tsx
│           ├── MessageBubble.tsx
│           ├── SourcesList.tsx
│           └── QuestionInput.tsx
│
├── Data
│   └── corpus/                ← Documents to index
│       └── *.md, *.txt
│
└── Testing
    └── test-all.sh            ← Comprehensive test suite
```

---

## Environment Variables

### Required

```env
GLEAN_INDEXING_TOKEN=...    # For indexing documents
GLEAN_CLIENT_TOKEN=...      # For Chat and Search
GLEAN_INSTANCE=support-lab-be.glean.com
GLEAN_DATASOURCE=interviewds
```

### Optional (with defaults)

```env
GLEAN_SEARCH_TOKEN=...      # Falls back to CLIENT_TOKEN
LOG_LEVEL=INFO              # INFO or DEBUG
DEFAULT_MAX_SOURCES=5       # Retrieval top-k
HTTP_TIMEOUT_S=30           # API timeout
RETRY_MAX_ATTEMPTS=3        # Retry count
PORT=3001                   # Backend port
CORS_ORIGINS=http://localhost:5173
```

---

## Endpoints

### Backend API (http://localhost:3001)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/config` | GET | View config |
| `/api/ask` | POST | Full RAG (question → answer + sources) |
| `/api/search` | POST | Search only (no answer generation) |

### Frontend UI

```
http://localhost:5173
```

Interactive chat interface with:
- Question input
- Chat history
- Source citations
- Performance metrics

---

## Testing Checklist

### Pre-Flight (Must Pass)

```bash
npm run test
```

Expected: All 4 checks pass
- ✅ Config loaded
- ✅ Search API working
- ✅ Chat API working
- ✅ Indexing client initialized

### Full Test Suite

```bash
./test-all.sh
```

Expected: All 7 tests pass
- ✅ Smoke test
- ✅ Server startup
- ✅ Health check
- ✅ Config endpoint
- ✅ Search API
- ✅ Ask API
- ✅ Error handling

### Manual Web UI Test

1. Open http://localhost:5173
2. Click example question or type your own
3. Verify answer + sources appear
4. Check performance metrics

---

## Common Issues & Solutions

### Issue: "Missing required environment variable"
**Solution:** Check `.env` has all required tokens

### Issue: "Port 3001 already in use"
**Solution:**
```bash
# Kill process on port 3001
kill -9 $(lsof -ti:3001)
# Or change port in .env
echo "PORT=3002" >> .env
```

### Issue: "No search results after indexing"
**Solution:** Wait 1-2 minutes for async indexing to complete

### Issue: "Failed to fetch" in browser
**Solution:**
```bash
# Verify backend is running
curl http://localhost:3001/health
# If not, start it
npm run dev:server
```

### Issue: Smoke test search returns 0 results
**Solution:** Documents not indexed yet or need more time
```bash
# Index documents
npm run index
# Wait 90 seconds
sleep 90
# Try again
npm run test
```

---

## Migration from Python

If you're familiar with the Python version:

| Python | Node.js Equivalent |
|--------|-------------------|
| `python -m scripts.smoke_test` | `npm run test` |
| `python -m src.indexer` | `npm run index` |
| `python -m src.mcp_server` | `npm run mcp` |
| `python -m src.mcp_server --test "Q"` | `npm run mcp -- --test "Q"` |
| N/A (no web UI) | `npm run dev` |

All Python functionality preserved + new React UI!

---

## Performance Targets

| Metric | Target (p95) |
|--------|-------------|
| Search API | < 500ms |
| Chat API | < 3000ms |
| Total E2E | < 4000ms |
| Frontend Load | < 1000ms |

Check actual performance in response `meta.latencyMs`

---

## Production Deployment

1. **Build:**
   ```bash
   npm run build
   ```

2. **Output:**
   - Backend: `dist/server/`
   - Frontend: `client/dist/`

3. **Deploy:**
   - Serve `client/dist/` as static files
   - Run `node dist/server/index.js`
   - Set environment variables on hosting platform

4. **Environment:**
   - Node.js 18+
   - All `.env` variables set
   - Persistent corpus directory

---

## Next Steps

### After Setup

1. **Add more documents:**
   ```bash
   # Add .md or .txt files to corpus/
   cp your-docs/*.md corpus/
   # Re-index (add --bulk for full-sync upload)
   npm run index
   # Wait 90 seconds
   # Test with relevant questions
   ```

2. **Customize UI:**
   - Edit components in `client/src/components/`
   - Modify styles in `.css` files
   - Hot reload automatically

3. **Extend API:**
   - Add endpoints in `server/index.ts`
   - Modify RAG in `server/rag.ts`
   - Update types in `client/src/types.ts`

### For Production

1. Review `DESIGN_NOTE.md` for productionization plan
2. Implement proper authentication
3. Add monitoring & logging
4. Set up CI/CD pipeline
5. Configure load balancing
6. Add rate limiting

---

## Getting Help

1. **Check documentation:**
   - WALKTHROUGH.md for setup issues
   - TESTING.md for testing problems
   - README_NODE.md for technical details

2. **Run diagnostics:**
   ```bash
   # Pre-flight check
   npm run test

   # Full test suite
   ./test-all.sh

   # Check logs
   # Backend logs in terminal
   # Frontend logs in browser console (F12)
   ```

3. **Common fixes:**
   ```bash
   # Clean reinstall
   rm -rf node_modules client/node_modules
   npm install
   cd client && npm install && cd ..

   # Restart everything
   npm run test
   npm run index
   npm run dev
   ```

---

## Success Indicators

You're ready when:

- ✅ Smoke test passes (4/4 checks)
- ✅ Comprehensive tests pass (7/7 tests)
- ✅ Frontend loads at http://localhost:5173
- ✅ Backend responds at http://localhost:3001
- ✅ Can ask questions and get answers
- ✅ Sources display correctly
- ✅ Performance < 5 seconds total

**Congratulations!** Your Glean RAG Chatbot is fully operational. 🎉
