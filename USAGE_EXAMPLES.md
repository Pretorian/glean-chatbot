# Usage Examples

Comprehensive examples for using the Glean RAG Chatbot across all interfaces.

---

## Table of Contents

1. [Web Interface Examples](#web-interface-examples)
2. [REST API Examples](#rest-api-examples)
3. [MCP Tool Examples](#mcp-tool-examples)
4. [Command Line Examples](#command-line-examples)
5. [Advanced Usage](#advanced-usage)

---

## Web Interface Examples

### Basic Usage

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   ```
   http://localhost:5173
   ```

3. **Ask questions:**

**Example 1: Simple question**
```
Question: What is our remote work policy?
```
Expected: Detailed answer with source citations and performance metrics.

**Example 2: Specific detail**
```
Question: How many days per week can I work remotely?
```

**Example 3: Eligibility**
```
Question: Am I eligible for remote work?
```

**Example 4: Equipment**
```
Question: What equipment does the company provide for remote work?
```

**Example 5: International work**
```
Question: Can I work from another country?
```

### Using the Interface

- **Click example questions** - Pre-filled questions for quick testing
- **Type your question** - Enter any natural language question
- **Press Enter or click Send** - Submit your question
- **View sources** - Click source titles to see where information came from
- **Check performance** - See search time, chat time, and total latency at bottom of answer

---

## REST API Examples

### Using curl

**Basic question:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our remote work policy?"
  }'
```

**Response:**
```json
{
  "answer": "According to the Remote Work Policy...",
  "sources": [
    {
      "documentId": "interviewds:...",
      "title": "Remote Work Policy",
      "url": "https://internal.example.com/policies/hr_remote_work_policy",
      "snippet": "..."
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

**With options:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What equipment is provided?",
    "maxSources": 3,
    "datasourceFilter": "interviewds"
  }'
```

**Search only (no answer generation):**
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "remote work",
    "maxResults": 5
  }'
```

**Health check:**
```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Using JavaScript/TypeScript

```javascript
// Ask a question
const response = await fetch('http://localhost:3001/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What is our remote work policy?',
    maxSources: 5
  })
});

const data = await response.json();
console.log('Answer:', data.answer);
console.log('Sources:', data.sources.length);
console.log('Latency:', data.meta.latencyMs.totalMs, 'ms');
```

### Using Node.js with axios

```javascript
import axios from 'axios';

const { data } = await axios.post('http://localhost:3001/api/ask', {
  question: 'What is our remote work policy?',
  maxSources: 5
});

console.log('Answer:', data.answer);
console.log('Sources:', data.sources.length);
console.log('Latency:', data.meta.latencyMs.totalMs, 'ms');
```

---

## MCP Tool Examples

### Test Mode (Command Line)

```bash
npm run mcp -- --test "What is our remote work policy?"
```

**Response:**
```json
{
  "answer": "According to the Remote Work Policy...",
  "sources": [...],
  "meta": {...}
}
```

### MCP Client Configuration

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "node",
      "args": ["--loader", "tsx", "server/mcp-server.ts"],
      "cwd": "/absolute/path/to/glean",
      "env": {
        "GLEAN_INDEXING_TOKEN": "your_token",
        "GLEAN_CLIENT_TOKEN": "your_token",
        "GLEAN_INSTANCE": "support-lab-be.glean.com",
        "GLEAN_DATASOURCE": "interviewds"
      }
    }
  }
}
```

**For Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "tsx",
      "args": ["server/mcp-server.ts"],
      "cwd": "/absolute/path/to/glean",
      "env": {
        "GLEAN_INDEXING_TOKEN": "your_token",
        "GLEAN_CLIENT_TOKEN": "your_token",
        "GLEAN_INSTANCE": "support-lab-be.glean.com",
        "GLEAN_DATASOURCE": "interviewds"
      }
    }
  }
}
```

### Using in Claude Desktop

Once configured, you can use natural language:

```
User: Can you check our knowledge base for the remote work policy?

Claude: [Uses ask_knowledge_base tool]
According to the company's Remote Work Policy...
```

---

## Command Line Examples

### Indexing Documents

**Index all documents in corpus:**
```bash
npm run index
```

**Expected output:**
```
{"message":"indexing_start","count":1,"datasource":"interviewds"}
[INFO] {"message":"glean_api_call",...,"status":200,...}
{"message":"indexing_complete","count":1,...}

Indexed 1 documents into interviewds.
```

**Add new document and re-index:**
```bash
# Add new markdown file
echo "# New Policy\nContent here..." > corpus/new_policy.md

# Re-index
npm run index

# Wait 90 seconds for document to become searchable
sleep 90
```

### Testing

**Smoke test:**
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
   ...

============================================================
  Summary
============================================================
All checks passed. Environment is ready.
```

**Comprehensive test suite:**
```bash
npm run test:all
# or
./test-all.sh
```

**Test authentication:**
```bash
npm run test:auth
```

**Test datasources:**
```bash
npm run test:datasources
```

---

## Advanced Usage

### Custom Questions

**Policy questions:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the security requirements for remote work?"}'
```

**Eligibility questions:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Who is eligible for fully remote work?"}'
```

**Equipment questions:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the home office stipend?"}'
```

**International work questions:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Can I work from Germany for a month?"}'
```

**Availability questions:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the core working hours?"}'
```

### Controlling Results

**Limit sources to 3:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our remote work policy?",
    "maxSources": 3
  }'
```

**Filter by datasource:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our remote work policy?",
    "datasourceFilter": "interviewds"
  }'
```

### Pretty Print JSON

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  | jq '.'
```

**Extract just the answer:**
```bash
curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  | jq -r '.answer'
```

**Extract sources:**
```bash
curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  | jq '.sources[] | {title, url}'
```

**Extract performance metrics:**
```bash
curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  | jq '.meta.latencyMs'
```

### Batch Questions

**Ask multiple questions:**
```bash
#!/bin/bash

questions=(
  "What is our remote work policy?"
  "Who is eligible for remote work?"
  "What equipment is provided?"
  "Can I work internationally?"
  "What are the security requirements?"
)

for q in "${questions[@]}"; do
  echo "Question: $q"
  curl -s -X POST http://localhost:3001/api/ask \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"$q\"}" \
    | jq -r '.answer' | head -n 5
  echo "---"
done
```

### Integration Examples

**Slack Bot Integration:**
```javascript
// Pseudo-code for Slack integration
app.event('app_mention', async ({ event, say }) => {
  const question = event.text.replace(/<@.*>/, '').trim();

  const response = await fetch('http://localhost:3001/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await response.json();

  await say({
    text: data.answer,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: data.answer }
      },
      {
        type: 'context',
        elements: data.sources.map(s => ({
          type: 'mrkdwn',
          text: `<${s.url}|${s.title}>`
        }))
      }
    ]
  });
});
```

**Discord Bot Integration:**
```javascript
// Pseudo-code for Discord integration
client.on('messageCreate', async message => {
  if (!message.content.startsWith('!ask ')) return;

  const question = message.content.slice(5);

  const response = await fetch('http://localhost:3001/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await response.json();

  const embed = new EmbedBuilder()
    .setTitle('Answer')
    .setDescription(data.answer.slice(0, 4000))
    .addFields(
      data.sources.map(s => ({
        name: s.title,
        value: `[View](${s.url})`
      }))
    )
    .setFooter({ text: `${data.meta.latencyMs.totalMs}ms` });

  await message.reply({ embeds: [embed] });
});
```

**Internal Tool Integration:**
```javascript
// Add to your internal admin dashboard
async function searchKnowledgeBase(query) {
  const response = await fetch('http://your-server:3001/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: query })
  });

  return response.json();
}

// Usage in your app
const result = await searchKnowledgeBase('What is our remote work policy?');
displayAnswer(result.answer);
displaySources(result.sources);
```

---

## Performance Tips

### Optimize Response Time

1. **Reduce maxSources for faster responses:**
   ```json
   {
     "question": "Your question",
     "maxSources": 2
   }
   ```
   Fewer sources = faster search + faster chat

2. **Use search-only for quick lookups:**
   ```bash
   curl -X POST http://localhost:3001/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "remote work", "maxResults": 3}'
   ```
   No LLM call = sub-second response

3. **Filter by datasource:**
   ```json
   {
     "question": "Your question",
     "datasourceFilter": "interviewds"
   }
   ```
   Smaller search space = faster retrieval

### Monitor Performance

```bash
# Check response times
curl -s -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}' \
  | jq '.meta.latencyMs'
```

**Expected ranges:**
- Search: 200-800ms
- Chat: 2000-20000ms (depends on answer length)
- Total: 2500-25000ms

---

## Error Handling

### Common Errors

**Empty question:**
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: HTTP 400
{
  "error": "question is required and must be a non-empty string"
}
```

**Server not running:**
```bash
curl http://localhost:3001/health

# Error: Connection refused
# Solution: Run npm run dev:server
```

**No results found:**
```json
{
  "answer": "I couldn't find any relevant information in the indexed corpus for this question.",
  "sources": [],
  "meta": {
    "retrievalCount": 0,
    ...
  }
}
```

---

## Tips & Best Practices

### Asking Better Questions

✅ **Good questions:**
- "What is our remote work policy?"
- "How many days can I work from home?"
- "What equipment does the company provide?"
- "Am I eligible for remote work?"

❌ **Less effective:**
- "Tell me everything" (too broad)
- "Yes or no?" (needs context)
- Single words (too vague)

### Getting Better Answers

1. **Be specific** - "What is the home office stipend?" vs "Tell me about equipment"
2. **Ask follow-ups** - Use the chat interface for conversation
3. **Check sources** - Verify information from source documents
4. **Adjust maxSources** - More sources = more comprehensive but slower

### Monitoring Usage

```bash
# Check server logs
npm run dev:server

# Look for:
# - [INFO] glean_api_call - successful requests
# - [ERROR] glean_api_error - failed requests
# - latencyMs - performance metrics
```

---

## Troubleshooting

**Issue: No answer or empty results**
- Documents may not be indexed yet
- Wait 90 seconds after indexing
- Try: `npm run test` to verify documents are searchable

**Issue: Slow responses**
- Large documents or complex questions take longer
- Reduce `maxSources` to 2-3 for faster responses
- First request is always slower (cold start)

**Issue: Server errors**
- Check server is running: `curl http://localhost:3001/health`
- Check logs for errors
- Restart server: Kill and run `npm run dev:server` again

---

## Next Steps

1. **Add more documents** - Place `.md` files in `corpus/` and run `npm run index`
2. **Customize UI** - Edit React components in `client/src/components/`
3. **Integrate** - Use REST API in your own applications
4. **Deploy** - See README_NODE.md for production deployment

---

For more details:
- **Setup**: See WALKTHROUGH.md
- **Testing**: See TESTING.md
- **API Reference**: See README_NODE.md
- **Troubleshooting**: See INDEXING_ISSUE.md
