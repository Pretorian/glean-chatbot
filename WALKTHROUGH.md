# Complete Walkthrough Guide

This guide walks you through setting up and running the Glean RAG Chatbot step-by-step with expected outputs at each stage.

---

## Table of Contents

1. [Prerequisites Check](#prerequisites-check)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Smoke Test](#smoke-test)
5. [Indexing Documents](#indexing-documents)
6. [Running the Application](#running-the-application)
7. [Testing the Chatbot](#testing-the-chatbot)
8. [MCP Mode (Optional)](#mcp-mode-optional)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites Check

### 1. Verify Node.js Installation

```bash
node --version
npm --version
```

**Expected output:**
```
v18.0.0 (or higher)
9.0.0 (or higher)
```

If not installed, download from [nodejs.org](https://nodejs.org/)

### 2. Gather Glean Credentials

You should have received three tokens from your Glean sandbox:
- `GLEAN_INDEXING_TOKEN` - For writing to the knowledge base
- `GLEAN_CLIENT_TOKEN` - For reading via Chat and Search
- `GLEAN_SEARCH_TOKEN` - Optional dedicated search token

Keep these handy for the configuration step.

---

## Initial Setup

### 1. Navigate to Project Directory

```bash
cd /path/to/glean
```

### 2. Install Root Dependencies

```bash
npm install
```

**Expected output:**
```
added 47 packages, and audited 48 packages in 3s

7 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### 3. Install Client Dependencies

```bash
cd client
npm install
cd ..
```

**Expected output:**
```
added 235 packages, and audited 236 packages in 8s

98 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

---

## Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Edit .env File

Open `.env` in your text editor and add your tokens:

```bash
# Using nano
nano .env

# Or using vim
vim .env

# Or using VS Code
code .env
```

**Update these values:**

```env
# Glean Instance Configuration
GLEAN_INSTANCE=support-lab-be.glean.com
GLEAN_DATASOURCE=interviewds

# Glean API Tokens (paste your actual tokens here)
GLEAN_INDEXING_TOKEN=paste_your_indexing_token_here
GLEAN_CLIENT_TOKEN=paste_your_client_token_here
GLEAN_SEARCH_TOKEN=paste_your_search_token_here

# Optional Configuration (defaults are fine)
LOG_LEVEL=INFO
DEFAULT_MAX_SOURCES=5
HTTP_TIMEOUT_S=30
RETRY_MAX_ATTEMPTS=3

# Server Configuration
PORT=3001
CORS_ORIGINS=http://localhost:5173
```

Save and close the file.

### 3. Verify Configuration

```bash
cat .env | grep TOKEN
```

**Expected output (tokens will be different):**
```
GLEAN_INDEXING_TOKEN=glean_abc123...
GLEAN_CLIENT_TOKEN=glean_def456...
GLEAN_SEARCH_TOKEN=glean_ghi789...
```

---

## Smoke Test

Run the pre-flight smoke test to verify your environment and credentials:

```bash
npm run test
```

**Expected output:**

```
============================================================
  1. Load config
============================================================
   instance    : support-lab-be.glean.com
   datasource  : interviewds
   indexing tok: ...abc123
   client tok  : ...def456
   search tok  : ...ghi789

============================================================
  2. Search API (Client/Search token)
============================================================
   OK — 200 in 342ms, 0 result(s)

============================================================
  3. Chat API (Client token)
============================================================
   OK — 200 in 1247ms

============================================================
  4. Indexing API auth check (Indexing token)
============================================================
   OK — IndexingClient constructed; token format accepted.
   (Run `npm run index` to exercise the full path.)

============================================================
  Summary
============================================================
All checks passed. Environment is ready.

Next steps:
  1. Run: npm run index
  2. Run: npm run dev
  3. Open: http://localhost:5173
```

**If you see failures:**
- Check that your tokens are correct in `.env`
- Verify you have network access to `support-lab-be.glean.com`
- See [Troubleshooting](#troubleshooting) section below

---

## Indexing Documents

### 1. Run the Indexer

```bash
npm run index
```

Picks up `*.md` and `*.txt` files from `corpus/`. Add `--bulk` to use the `/bulkindexdocuments` endpoint for full-sync uploads (`--page-size=N`, `--force-restart` also accepted).

**Expected output:**

```
{"message":"indexing_start","count":1,"datasource":"interviewds"}
[INFO] {"message":"glean_api_call","client":"indexing","op":"index_documents","status":200,"latencyMs":856,"requestId":"a1b2c3d4-..."}
{"message":"indexing_complete","count":1,"requestId":"a1b2c3d4-...","latencyMs":856}

Indexed 1 documents into interviewds.
```

**⚠️ If you get a 400 error about URL pattern:**

This means your datasource needs URL pattern configuration. See **[INDEXING_ISSUE.md](INDEXING_ISSUE.md)** for:
- Explanation of the issue
- How to configure the datasource
- Workarounds for testing

Quick fix: Contact your Glean administrator to configure the datasource URL pattern, or try a different datasource in `.env`.

### 2. Wait for Documents to Become Searchable

**Important:** The Glean Indexing API is asynchronous. Documents are not immediately searchable.

**Wait 1-2 minutes** before proceeding.

You can verify indexing by checking the Glean web UI at:
```
https://support-lab-be.glean.com
```

### 3. Verify Indexing (Optional)

After waiting 1-2 minutes, run the smoke test again:

```bash
npm run test
```

The Search API test should now return 1 result instead of 0:

```
============================================================
  2. Search API (Client/Search token)
============================================================
   OK — 200 in 298ms, 1 result(s)
```

---

## Running the Application

### Option 1: Full Stack (Recommended)

Run both backend and frontend together:

```bash
npm run dev
```

**Expected output:**

```
> glean-rag-chatbot@1.0.0 dev
> concurrently "npm run dev:server" "npm run dev:client"

[0]
[0] > glean-rag-chatbot@1.0.0 dev:server
[0] > tsx watch server/index.ts
[0]
[1]
[1] > glean-rag-chatbot@1.0.0 dev:client
[1] > cd client && npm run dev
[1]
[0] 🚀 Glean RAG API server running on http://localhost:3001
[0]    Health check: http://localhost:3001/health
[0]    Ask endpoint: POST http://localhost:3001/api/ask
[0]    Search endpoint: POST http://localhost:3001/api/search
[0]
[0]    Instance: support-lab-be.glean.com
[0]    Datasource: interviewds
[0]
[1]   VITE v5.0.12  ready in 823 ms
[1]
[1]   ➜  Local:   http://localhost:5173/
[1]   ➜  Network: use --host to expose
[1]   ➜  press h + enter to show help
```

**The application is now running!**
- Backend API: http://localhost:3001
- Frontend UI: http://localhost:5173

### Option 2: Backend Only

If you only want to test the API:

```bash
npm run dev:server
```

**Expected output:**

```
🚀 Glean RAG API server running on http://localhost:3001
   Health check: http://localhost:3001/health
   Ask endpoint: POST http://localhost:3001/api/ask
   Search endpoint: POST http://localhost:3001/api/search

   Instance: support-lab-be.glean.com
   Datasource: interviewds
```

### Option 3: Frontend Only

If the backend is already running:

```bash
npm run dev:client
```

---

## Testing the Chatbot

### Web Interface Testing

1. **Open the application** in your browser:
   ```
   http://localhost:5173
   ```

2. **You should see:**
   - A purple gradient header with "Glean RAG Chatbot"
   - An empty chat interface with example questions
   - A question input box at the bottom

3. **Try the example question:**
   - Click on "What is our remote work policy?"
   - Or type your own question and click "Send"

4. **Expected behavior:**
   - Your question appears as a blue bubble on the right
   - After 1-3 seconds, an answer appears on the left
   - Sources are displayed below the answer with:
     - Document title
     - Snippet preview
     - Performance metrics (search time, chat time, total time)

### API Testing with curl

Test the backend API directly:

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}'
```

**Expected response:**

```json
{
  "answer": "According to the Remote Work Policy, employees may work remotely up to 3 days per week with manager approval. Full-time remote work requires VP-level approval and a dedicated home office setup.",
  "sources": [
    {
      "documentId": "interviewds:a1b2c3d4...",
      "title": "Remote Work Policy",
      "url": "file:///Users/.../corpus/hr_remote_work_policy.md",
      "snippet": "Employees may work remotely up to 3 days per week..."
    }
  ],
  "meta": {
    "retrievalCount": 1,
    "retrievedIds": ["interviewds:a1b2c3d4..."],
    "latencyMs": {
      "searchMs": 342,
      "chatMs": 1876,
      "totalMs": 2234
    },
    "requestId": "uuid-here"
  }
}
```

### Health Check

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

## MCP Mode (Optional)

If you want to use the chatbot with MCP-compatible clients (Cursor, Claude Desktop):

### Test Mode

```bash
npm run mcp -- --test "What is our remote work policy?"
```

**Expected output:**

```json
{
  "answer": "According to the Remote Work Policy...",
  "sources": [...],
  "meta": {...}
}
```

### Configure MCP Client

Add to your MCP client config (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "node",
      "args": ["--loader", "tsx", "server/mcp-server.ts"],
      "cwd": "/absolute/path/to/glean",
      "env": {
        "GLEAN_INDEXING_TOKEN": "your_token_here",
        "GLEAN_CLIENT_TOKEN": "your_token_here",
        "GLEAN_INSTANCE": "support-lab-be.glean.com",
        "GLEAN_DATASOURCE": "interviewds"
      }
    }
  }
}
```

Restart your MCP client. The `ask_knowledge_base` tool will be available.

---

## Troubleshooting

### Smoke Test Failures

#### "Missing required environment variable"
**Problem:** Environment variables not set correctly.

**Solution:**
```bash
# Verify .env exists
ls -la .env

# Check contents (should show your tokens)
cat .env | grep TOKEN

# If missing, copy template and edit
cp .env.example .env
nano .env
```

#### "Network error" or "ECONNREFUSED"
**Problem:** Cannot reach Glean servers.

**Solution:**
- Check internet connection
- Verify firewall/VPN settings
- Try: `ping support-lab-be.glean.com`

#### "401 Unauthorized" or "403 Forbidden"
**Problem:** Invalid or expired tokens.

**Solution:**
- Verify tokens in `.env` are correct
- Check for extra spaces or newlines
- Request new tokens if expired

### Indexing Issues

#### "Corpus directory not found"
**Problem:** Missing corpus directory.

**Solution:**
```bash
# Verify corpus exists
ls -la corpus/

# Should show .md or .txt files
ls corpus/*.md corpus/*.txt 2>/dev/null
```

#### Documents not searchable after indexing
**Problem:** Indexing is asynchronous.

**Solution:**
- Wait 1-2 minutes after indexing
- Run smoke test to verify: `npm run test`
- Check Glean web UI for indexed documents

### Application Runtime Issues

#### "Port 3001 already in use"
**Problem:** Another process is using port 3001.

**Solution:**
```bash
# Find process using port
lsof -ti:3001

# Kill the process
kill -9 $(lsof -ti:3001)

# Or change port in .env
echo "PORT=3002" >> .env
```

#### "Cannot GET /api/ask" in browser
**Problem:** Trying to GET instead of POST.

**Solution:**
- Use the web UI at http://localhost:5173
- Or use curl/Postman with POST method

#### Frontend shows "Failed to fetch"
**Problem:** Backend not running or CORS issue.

**Solution:**
```bash
# Verify backend is running
curl http://localhost:3001/health

# Check CORS_ORIGINS in .env includes frontend URL
echo "CORS_ORIGINS=http://localhost:5173" >> .env

# Restart backend
npm run dev:server
```

#### React app not loading
**Problem:** Frontend build or proxy issue.

**Solution:**
```bash
# Reinstall client dependencies
cd client
rm -rf node_modules
npm install
cd ..

# Verify proxy in client/vite.config.ts
cat client/vite.config.ts | grep proxy

# Restart dev server
npm run dev
```

### Performance Issues

#### Slow response times (>10 seconds)
**Possible causes:**
- First request (cold start) - normal
- Network latency to Glean servers
- Large corpus (many documents)

**Solutions:**
- Wait for warm-up on first request
- Reduce `DEFAULT_MAX_SOURCES` in `.env`
- Check Glean service status

#### High memory usage
**Solution:**
```bash
# Limit Node.js memory
export NODE_OPTIONS="--max-old-space-size=2048"
npm run dev
```

### Getting Help

If you're still stuck:

1. **Check logs:**
   ```bash
   # Backend logs show in terminal
   # Look for ERROR or FAIL messages
   ```

2. **Verify all steps:**
   - Re-run smoke test: `npm run test`
   - Check all tokens are set in `.env`
   - Ensure documents were indexed

3. **Common fixes:**
   ```bash
   # Nuclear option: Clean install
   rm -rf node_modules client/node_modules
   npm install
   cd client && npm install && cd ..

   # Restart everything
   npm run test
   npm run index
   npm run dev
   ```

4. **Review documentation:**
   - `README_NODE.md` - Full documentation
   - `QUICKSTART.md` - Quick setup
   - Original Python `README.md` - Design details

---

## Next Steps

Once everything is working:

1. **Add more documents:**
   - Place `.md` or `.txt` files in `corpus/`
   - Run `npm run index` again (add `--bulk` for a full-sync upload)
   - Wait 1-2 minutes
   - Test with relevant questions

2. **Customize the UI:**
   - Edit React components in `client/src/components/`
   - Modify styles in `.css` files
   - Changes hot-reload automatically

3. **Extend the API:**
   - Add endpoints in `server/index.ts`
   - Modify RAG logic in `server/rag.ts`
   - Update types in `client/src/types.ts`

4. **Deploy to production:**
   - Run `npm run build`
   - Deploy `dist/` and `client/dist/`
   - See `README_NODE.md` for deployment details

---

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (root + client)
- [ ] `.env` configured with all three tokens
- [ ] Smoke test passes (all 4 checks)
- [ ] Documents indexed successfully
- [ ] Backend running on port 3001
- [ ] Frontend running on port 5173
- [ ] Can ask questions and get answers
- [ ] Sources displayed with answers
- [ ] Performance metrics shown

**Congratulations!** Your Glean RAG Chatbot is fully operational.
