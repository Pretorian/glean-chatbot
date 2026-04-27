# Testing Guide

Comprehensive testing instructions for the Glean RAG Chatbot.

---

## Table of Contents

1. [Pre-Flight Checks](#pre-flight-checks)
2. [Backend Testing](#backend-testing)
3. [Frontend Testing](#frontend-testing)
4. [Integration Testing](#integration-testing)
5. [Performance Testing](#performance-testing)
6. [Expected Outputs Reference](#expected-outputs-reference)

---

## Pre-Flight Checks

### Smoke Test

**Purpose:** Verify environment setup and API connectivity.

**When to run:**
- After initial setup
- Before starting any work session
- After token rotation
- Before deployment
- **Before the live interview (run twice!)**

**Command:**
```bash
npm run test
```

**Expected Output:**

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
   OK — 200 in 342ms, 1 result(s)

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

**Failure Scenarios:**

<details>
<summary>Config Load Failure</summary>

```
============================================================
  1. Load config
============================================================
   FAIL: Missing required environment variable: GLEAN_CLIENT_TOKEN. See .env.example for the full list.
```

**Fix:** Check `.env` file has all required tokens.
</details>

<details>
<summary>Search API Failure</summary>

```
============================================================
  2. Search API (Client/Search token)
============================================================
   FAIL: Glean API error 401 (request_id=abc123): Unauthorized
```

**Fix:** Verify `GLEAN_CLIENT_TOKEN` or `GLEAN_SEARCH_TOKEN` is valid.
</details>

<details>
<summary>Chat API Failure</summary>

```
============================================================
  3. Chat API (Client token)
============================================================
   FAIL: Glean API error 403 (request_id=def456): Forbidden
```

**Fix:** Verify `GLEAN_CLIENT_TOKEN` has Chat scope.
</details>

---

## Backend Testing

### Test 1: Health Check

**Purpose:** Verify server is running.

```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

**Exit codes:**
- Success: HTTP 200
- Failure: Connection refused (server not running)

---

### Test 2: Config Endpoint

**Purpose:** Verify configuration is loaded correctly.

```bash
curl http://localhost:3001/api/config
```

**Expected Response:**
```json
{
  "instance": "support-lab-be.glean.com",
  "datasource": "interviewds",
  "defaultMaxSources": 5
}
```

---

### Test 3: Search Endpoint

**Purpose:** Test direct search without answer generation.

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "remote work",
    "maxResults": 3
  }'
```

**Expected Response:**
```json
{
  "results": {
    "results": [
      {
        "document": {
          "id": "interviewds:abc123...",
          "title": "Remote Work Policy",
          "viewURL": "file://..."
        },
        "snippets": [
          {
            "text": "Employees may work remotely..."
          }
        ]
      }
    ]
  },
  "meta": {
    "latencyMs": 342,
    "requestId": "uuid-here"
  }
}
```

---

### Test 4: Ask Endpoint (Simple Question)

**Purpose:** Test full RAG pipeline with a simple question.

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our remote work policy?"
  }'
```

**Expected Response:**
```json
{
  "answer": "According to the Remote Work Policy, employees may work remotely up to 3 days per week with manager approval. Full-time remote work requires VP-level approval and a dedicated home office setup.",
  "sources": [
    {
      "documentId": "interviewds:abc123...",
      "title": "Remote Work Policy",
      "url": "file:///path/to/corpus/hr_remote_work_policy.md",
      "snippet": "Employees may work remotely up to 3 days per week with manager approval..."
    }
  ],
  "meta": {
    "retrievalCount": 1,
    "retrievedIds": ["interviewds:abc123..."],
    "latencyMs": {
      "searchMs": 342,
      "chatMs": 1876,
      "totalMs": 2234
    },
    "requestId": "uuid-here"
  }
}
```

---

### Test 5: Ask Endpoint (Complex Question)

**Purpose:** Test RAG with multi-document retrieval.

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can employees work from home?",
    "maxSources": 5
  }'
```

**Expected:** Similar structure, potentially more sources if multiple documents match.

---

### Test 6: Ask Endpoint (Question with No Results)

**Purpose:** Test fallback behavior when no documents match.

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the moon landing conspiracy?"
  }'
```

**Expected Response:**
```json
{
  "answer": "I couldn't find any relevant information in the indexed corpus for this question.",
  "sources": [],
  "meta": {
    "retrievalCount": 0,
    "retrievedIds": [],
    "latencyMs": {
      "searchMs": 234,
      "chatMs": 0,
      "totalMs": 245
    },
    "requestId": "uuid-here"
  }
}
```

---

### Test 7: Error Handling (Invalid Request)

**Purpose:** Test API validation.

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "error": "question is required and must be a non-empty string"
}
```

**HTTP Status:** 400 Bad Request

---

## Frontend Testing

### Manual Testing Checklist

**Start the app:**
```bash
npm run dev
```

**Navigate to:** http://localhost:5173

#### Visual Checks

- [ ] Header displays "Glean RAG Chatbot" with purple gradient
- [ ] Subtitle shows "Ask questions about your indexed knowledge base"
- [ ] Empty state shows welcome message
- [ ] Example question button is visible and styled correctly
- [ ] Question input box is at the bottom
- [ ] Send button is present and enabled when text is entered

#### Interaction Tests

**Test 1: Example Question Click**
1. Click the example question button
2. Expected:
   - Question appears in input field
   - Question automatically submits
   - User message bubble appears on right (blue)
   - After 1-3 seconds, assistant message appears on left (white)
   - Sources are displayed below the answer
   - Performance metrics shown at bottom

**Test 2: Manual Question Entry**
1. Type "What is our remote work policy?" in input
2. Click "Send" or press Enter
3. Expected: Same as Test 1

**Test 3: Multiple Questions**
1. Ask first question, wait for response
2. Ask second question
3. Expected:
   - Chat history scrolls
   - New messages appear below previous ones
   - Auto-scroll to latest message

**Test 4: Empty Input**
1. Leave input empty
2. Try to click Send
3. Expected:
   - Send button is disabled
   - Nothing happens

**Test 5: Shift+Enter**
1. Type question
2. Press Shift+Enter
3. Expected:
   - Newline added (doesn't send)
   - Send button still enabled

**Test 6: Long Answer**
1. Ask: "Tell me everything about the policies"
2. Expected:
   - Long answer displays with proper wrapping
   - Scrollable if needed
   - Sources still visible

**Test 7: Source Links**
1. Ask any question that returns sources
2. Click on a source title (if URL is valid)
3. Expected:
   - Link opens in new tab (if http/https)
   - File URLs may not open in browser

#### Responsive Design Tests

**Desktop (1920x1080)**
- [ ] Chat takes full width (max 1200px)
- [ ] Messages properly aligned
- [ ] No horizontal scroll

**Tablet (768x1024)**
- [ ] Layout adjusts
- [ ] Messages remain readable
- [ ] Input box scales properly

**Mobile (375x667)**
- [ ] Single column layout
- [ ] Messages use 90% width
- [ ] Input box full width
- [ ] No text overflow

#### Browser Compatibility

Test in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Integration Testing

### End-to-End Workflow Test

**Purpose:** Test complete user journey from indexing to answer.

**Steps:**

1. **Clean slate:**
   ```bash
   # Note: This doesn't delete from Glean, just local verification
   rm -rf node_modules/.cache
   ```

2. **Smoke test:**
   ```bash
   npm run test
   ```
   Expected: All 4 checks pass

3. **Index documents:**
   ```bash
   npm run index
   ```
   Expected: "Indexed 1 documents into interviewds"

4. **Wait:** 90 seconds

5. **Start application:**
   ```bash
   npm run dev
   ```
   Expected: Both servers start

6. **Test via UI:**
   - Open http://localhost:5173
   - Ask: "What is our remote work policy?"
   - Verify: Answer received with sources

7. **Test via API:**
   ```bash
   curl -X POST http://localhost:3001/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question": "What is our remote work policy?"}'
   ```
   Expected: JSON response with answer

**Success Criteria:**
- All steps complete without errors
- Answer is relevant and grounded
- Sources cite the correct document
- Latency < 5 seconds total

---

## Performance Testing

### Latency Benchmarks

**Expected Performance (p95):**
- Search API: < 500ms
- Chat API: < 3000ms
- Total (search + chat): < 4000ms

**Measure Performance:**

```bash
# Time a single request
time curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}'
```

**Interpret Results:**

Check the `meta.latencyMs` in response:
```json
{
  "meta": {
    "latencyMs": {
      "searchMs": 342,    // Should be < 500ms
      "chatMs": 1876,      // Should be < 3000ms
      "totalMs": 2234      // Should be < 4000ms
    }
  }
}
```

### Load Testing (Optional)

**Simple concurrent request test:**

```bash
# Using ApacheBench (if installed)
ab -n 10 -c 2 -p question.json -T application/json \
  http://localhost:3001/api/ask

# question.json:
echo '{"question": "What is our remote work policy?"}' > question.json
```

**Expected:**
- All requests succeed (200 OK)
- Average latency < 5000ms
- No memory leaks (check with Activity Monitor/htop)

---

## Expected Outputs Reference

### Indexing Output

```
{"message":"indexing_start","count":1,"datasource":"interviewds"}
[INFO] {"message":"glean_api_call","client":"indexing","op":"index_documents","status":200,"latencyMs":856,"requestId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}
{"message":"indexing_complete","count":1,"requestId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","latencyMs":856}

Indexed 1 documents into interviewds.
```

### Server Startup Output

```
🚀 Glean RAG API server running on http://localhost:3001
   Health check: http://localhost:3001/health
   Ask endpoint: POST http://localhost:3001/api/ask
   Search endpoint: POST http://localhost:3001/api/search

   Instance: support-lab-be.glean.com
   Datasource: interviewds
```

### Frontend Dev Server Output

```
  VITE v5.0.12  ready in 823 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### API Request Logs

```
[INFO] {"message":"api_request","requestId":"abc123...","endpoint":"/api/ask","maxSources":5}
[INFO] {"message":"glean_api_call","client":"query","op":"search","status":200,"latencyMs":342,"requestId":"def456..."}
[INFO] {"message":"glean_api_call","client":"query","op":"chat","status":200,"latencyMs":1876,"requestId":"ghi789..."}
```

---

## Testing Best Practices

1. **Always run smoke test first**
   - Catches 90% of configuration issues
   - Takes only 5 seconds

2. **Wait after indexing**
   - Indexing is asynchronous
   - 1-2 minute wait is normal

3. **Check all three interfaces**
   - Web UI (user experience)
   - REST API (integration)
   - MCP (tool usage)

4. **Test error cases**
   - Invalid inputs
   - Missing documents
   - Network failures

5. **Monitor performance**
   - First request is always slower (cold start)
   - Subsequent requests should be faster
   - Watch for memory leaks

6. **Keep logs**
   - Backend logs help debug issues
   - Check browser console for frontend errors

---

## Automated Testing Script

Create a test runner script:

```bash
#!/bin/bash
# test-all.sh - Run all tests in sequence

set -e  # Exit on error

echo "=== Running All Tests ==="
echo ""

echo "1. Smoke Test..."
npm run test
echo "✓ Smoke test passed"
echo ""

echo "2. Starting servers..."
npm run dev:server &
SERVER_PID=$!
sleep 3
echo "✓ Server started"
echo ""

echo "3. Health check..."
curl -f http://localhost:3001/health > /dev/null
echo "✓ Health check passed"
echo ""

echo "4. Config check..."
curl -f http://localhost:3001/api/config > /dev/null
echo "✓ Config check passed"
echo ""

echo "5. Ask API test..."
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  -f > /dev/null
echo "✓ Ask API test passed"
echo ""

echo "6. Search API test..."
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "remote work"}' \
  -f > /dev/null
echo "✓ Search API test passed"
echo ""

# Cleanup
kill $SERVER_PID

echo "=== All Tests Passed ==="
```

**Usage:**
```bash
chmod +x test-all.sh
./test-all.sh
```

---

## Success Criteria

All tests should pass with:

- ✅ Smoke test: All 4 checks pass
- ✅ Health endpoint: Returns 200 OK
- ✅ Config endpoint: Returns correct settings
- ✅ Search endpoint: Returns results
- ✅ Ask endpoint: Returns answer with sources
- ✅ Frontend: Renders correctly, questions work
- ✅ Performance: Total latency < 5 seconds
- ✅ Error handling: Invalid requests return 400

**If all criteria met:** Ready for production! 🎉
