# Example Scripts

Ready-to-run example scripts for the Glean RAG Chatbot.

## Prerequisites

1. Server must be running:
   ```bash
   npm run dev:server
   ```

2. Make scripts executable:
   ```bash
   chmod +x examples/*.sh
   ```

## Available Examples

### basic-question.sh

Ask a simple question and see the full JSON response.

```bash
./examples/basic-question.sh
```

**What it does:**
- Asks "What is our remote work policy?"
- Shows complete response with answer, sources, and metadata
- Pretty-prints JSON with `jq`

---

### multiple-questions.sh

Ask several questions in sequence.

```bash
./examples/multiple-questions.sh
```

**What it does:**
- Asks 5 different questions about the remote work policy
- Shows first 3 lines of each answer
- Demonstrates batch querying

---

### show-sources.sh

Display source citations for any question.

```bash
./examples/show-sources.sh "Your question here"
```

**What it does:**
- Shows all source documents used to answer the question
- Displays title and URL for each source
- Default question: "What is our remote work policy?"

**Examples:**
```bash
./examples/show-sources.sh "Who is eligible for remote work?"
./examples/show-sources.sh "What equipment is provided?"
```

---

### performance-test.sh

Test performance with different `maxSources` values.

```bash
./examples/performance-test.sh
```

**What it does:**
- Tests with maxSources = 1, 3, 5
- Shows search time, chat time, and total time for each
- Helps you optimize for speed vs. comprehensiveness

**Expected output:**
```
Testing with maxSources=1...
  Search:  234ms
  Chat:    5678ms
  Total:   5912ms

Testing with maxSources=3...
  Search:  345ms
  Chat:    12345ms
  Total:   12690ms

Testing with maxSources=5...
  Search:  456ms
  Chat:    19876ms
  Total:   20332ms
```

---

## Custom Examples

### Ask Your Own Question

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Your question here"}' \
  | jq '.'
```

### Get Just the Answer

```bash
curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Your question here"}' \
  | jq -r '.answer'
```

### Search Only (No Answer)

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "remote work", "maxResults": 5}' \
  | jq '.'
```

---

## Requirements

- **jq** - Install with: `brew install jq` (macOS) or `apt-get install jq` (Linux)
- **curl** - Usually pre-installed
- Server running on `http://localhost:3001`

---

## Troubleshooting

**"Connection refused" error:**
```bash
# Start the server first
npm run dev:server
```

**"jq: command not found":**
```bash
# Install jq
brew install jq  # macOS
# or
sudo apt-get install jq  # Linux
```

**No results:**
- Documents may not be indexed yet
- Wait 90 seconds after running `npm run index`
- Verify with: `npm run test`

---

For more examples, see [USAGE_EXAMPLES.md](../USAGE_EXAMPLES.md)
