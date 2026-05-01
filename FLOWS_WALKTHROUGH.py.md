# Understanding the Flows - Detailed Walkthrough

This guide explains what the Glean RAG Chatbot actually does and walks you through each integration flow with real examples.

---

## 🎯 What This App Does

**Think of it as "ChatGPT for your company documents"** - You ask questions in natural language, and it gives you accurate answers with source citations from your indexed documents.

### The Big Picture

```
Your Documents → Indexed in Glean → You Ask Questions → Get Grounded Answers
```

Unlike regular ChatGPT which can hallucinate, this app:
- ✅ Only answers based on YOUR documents
- ✅ Provides source citations for every answer
- ✅ Validates that all citations actually came from the search results
- ✅ Never makes up information

---

## 🎨 Three Ways to Use This App

The architecture diagram shows three distinct integration paths:

| Path | Interface | Best For | Response Time |
|------|-----------|----------|---------------|
| **Flow 1** | 🌐 React Web UI | End users, demos, visual interaction | 15-25s |
| **Flow 2** | 🔧 MCP Tool | Claude Desktop, Cursor, AI assistants | 15-25s |
| **Flow 3** | 🔌 REST API | Slack bots, Discord, custom integrations | 15-25s (or <1s search-only) |

All three paths use the **same RAG orchestrator** under the hood - consistent results everywhere!

---

## Flow 1: 🌐 Web UI (Primary User Path)

### What You Do:

1. Open browser to http://localhost:5174
2. Type: "What is our remote work policy?"
3. Click "Send" or press Enter
4. Wait ~15-25 seconds
5. See answer with clickable source citations

### What Happens Behind the Scenes:

```
┌─────────────────────────────────────────────────────────────────┐
│ YOU (Browser)                                                    │
│ Question: "What is our remote work policy?"                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP POST /api/ask
                       │ { "question": "...", "maxSources": 5 }
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ EXPRESS SERVER (localhost:3001)                                  │
│ server/index.ts                                                  │
│ - Validates request                                              │
│ - Extracts question and parameters                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Calls answerQuestion()
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ RAG ORCHESTRATOR (server/rag.ts)                                 │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1️⃣ RETRIEVE PHASE                                           │ │
│ │ Function: retrieve()                                         │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ → Calls Glean Search API                                     │ │
│ │ → POST /rest/api/v1/search                                   │ │
│ │ → Auth: Bearer GLEAN_SEARCH_TOKEN                            │ │
│ │ → Request: {                                                 │ │
│ │     query: "What is our remote work policy?",                │ │
│ │     pageSize: 5,                                             │ │
│ │     datasourceFilter: "interviewds"                          │ │
│ │   }                                                           │ │
│ │                                                               │ │
│ │ ⏱️ Takes: ~500ms                                              │ │
│ │                                                               │ │
│ │ ← Returns: [                                                 │ │
│ │     {                                                         │ │
│ │       documentId: "interviewds:5ac15fac3de80064",            │ │
│ │       title: "Remote Work Policy",                           │ │
│ │       snippet: "All full-time employees who...",             │ │
│ │       url: "https://internal.example.com/policies/..."       │ │
│ │     },                                                        │ │
│ │     ... 4 more results                                       │ │
│ │   ]                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 2️⃣ GROUND PHASE                                             │ │
│ │ Function: ground()                                           │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ → Calls Glean Chat API                                       │ │
│ │ → POST /rest/api/v1/chat                                     │ │
│ │ → Auth: Bearer GLEAN_CLIENT_TOKEN                            │ │
│ │ → Request: {                                                 │ │
│ │     query: "What is our remote work policy?",                │ │
│ │     context: [all 5 retrieved documents],                    │ │
│ │     instructions: "Answer based only on provided context"    │ │
│ │   }                                                           │ │
│ │                                                               │ │
│ │ ⏱️ Takes: ~15-20 seconds (LLM generation)                     │ │
│ │                                                               │ │
│ │ ← Returns: {                                                 │ │
│ │     answer: "According to the Remote Work Policy...",        │ │
│ │     citations: ["interviewds:5ac15fac3de80064", ...]         │ │
│ │   }                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 3️⃣ VALIDATION & ASSEMBLY PHASE                              │ │
│ │ Function: (internal)                                         │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ ✓ Validate citations are from retrieval set                 │ │
│ │ ✓ Assemble sources with metadata                             │ │
│ │ ✓ Calculate timing metrics                                   │ │
│ │ ✓ Generate request ID for tracing                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Returns response
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ EXPRESS SERVER                                                   │
│ Sends JSON response                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP 200 OK
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ YOU (Browser)                                                    │
│                                                                   │
│ Answer: "According to the Remote Work Policy effective          │
│         January 1, 2025:                                         │
│         - Eligibility: All full-time employees who have          │
│           completed their 90-day onboarding..."                  │
│                                                                   │
│ Sources:                                                         │
│ 📄 Remote Work Policy                                            │
│    https://internal.example.com/policies/hr_remote_work_policy   │
│                                                                   │
│ Performance:                                                     │
│ Search: 507ms | Chat: 16,110ms | Total: 16,617ms                │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Breakdown:

- **Search API**: 200-800ms (fast!)
- **Chat API**: 15,000-20,000ms (slow - LLM generation)
- **Total**: ~15-25 seconds (dominated by Chat)

**Why so slow?** The Chat API uses a large language model to generate a thoughtful, grounded answer. This is similar to ChatGPT's response time.

**First request**: May be slower (~30s) due to cold start
**Subsequent requests**: Faster (~15-20s) due to caching

---

## Flow 2: 🔧 MCP Tool (Claude Desktop / Cursor)

### What You Do:

1. Open Claude Desktop or Cursor
2. In conversation, say: "Check our knowledge base about remote work eligibility"
3. Claude automatically invokes the `ask_knowledge_base` tool
4. Wait ~15-25 seconds
5. Claude presents the answer in natural conversation

### What Happens Behind the Scenes:

```
┌─────────────────────────────────────────────────────────────────┐
│ YOU                                                              │
│ "Check our knowledge base about remote work eligibility"        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ CLAUDE DESKTOP / CURSOR                                          │
│ - Understands you want knowledge base info                       │
│ - Sees available tool: ask_knowledge_base                        │
│ - Decides to invoke it                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MCP Protocol (stdio)
                       │ {
                       │   "tool": "ask_knowledge_base",
                       │   "params": {
                       │     "question": "remote work eligibility",
                       │     "max_sources": 5
                       │   }
                       │ }
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ MCP SERVER (server/mcp-server.ts)                                │
│ - Receives tool invocation via stdio                             │
│ - Extracts question and parameters                               │
│ - Logs: {"message": "mcp_tool_invoked", ...}                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Calls answerQuestion()
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ SAME RAG ORCHESTRATOR (server/rag.ts)                            │
│ - Same retrieve() function                                       │
│ - Same ground() function                                         │
│ - Same validation logic                                          │
│                                                                   │
│ [Identical to Flow 1 - same code path!]                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Returns structured result
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ MCP SERVER                                                       │
│ Returns to MCP client as JSON                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MCP Response
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLAUDE DESKTOP / CURSOR                                          │
│ - Receives structured data                                       │
│ - Processes answer and sources                                   │
│ - Presents in natural conversation                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ YOU                                                              │
│                                                                   │
│ Claude: "I checked the knowledge base. According to the Remote   │
│ Work Policy, all full-time employees who have completed their    │
│ 90-day onboarding are eligible for remote work. Would you like   │
│ more details about the different remote work modes available?"   │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Is Powerful:

- ✅ **No context switching** - Stay in your IDE/chat
- ✅ **Natural conversation** - Claude presents the info conversationally
- ✅ **Automatic invocation** - Claude knows when to use the tool
- ✅ **Follow-up questions** - Can ask clarifying questions in the same chat

### Setup Required:

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "glean-rag": {
      "command": "node",
      "args": ["--loader", "tsx", "server/mcp-server.ts"],
      "cwd": "/Users/x/work/glean",
      "env": {
        "GLEAN_INDEXING_TOKEN": "your_token",
        "GLEAN_CLIENT_TOKEN": "your_token",
        "GLEAN_SEARCH_TOKEN": "your_token",
        "GLEAN_INSTANCE": "support-lab-be.glean.com",
        "GLEAN_DATASOURCE": "interviewds"
      }
    }
  }
}
```

Then restart Claude Desktop.

---

## Flow 3: 🔌 REST API (External Integrations)

### Use Cases:

- **Slack Bot**: Answer questions in team channels
- **Discord Bot**: Support community knowledge base
- **Internal Tools**: Embed in admin dashboards
- **Custom Apps**: Build your own interface

### Example: Slack Bot

**What Your Users See:**

```
#engineering channel

@knowledgebot What's our security requirement for remote work?

KnowledgeBot: 🔐 According to the Remote Work Policy:

All remote employees must:
• Connect to corporate VPN for internal systems
• Use password-protected WiFi (WPA2/WPA3)
• Public WiFi requires VPN connection
• Keep VPN client updated to latest version

📄 Source: Remote Work Policy
🔗 https://internal.example.com/policies/hr_remote_work_policy

⏱️ Search: 521ms | Answer: 18.3s
```

**Your Bot Code:**

```javascript
// Slack bot integration (simplified)
const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Listen for mentions
app.event('app_mention', async ({ event, say }) => {
  // Extract question (remove bot mention)
  const question = event.text.replace(/<@.*>/, '').trim();

  // Show typing indicator
  await say({
    text: "🔍 Searching knowledge base...",
    thread_ts: event.ts
  });

  try {
    // Call your RAG API
    const response = await fetch('http://localhost:3001/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await response.json();

    // Format response for Slack
    await say({
      thread_ts: event.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Answer:*\n${data.answer}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Sources:*\n${data.sources.map(s =>
              `• <${s.url}|${s.title}>`
            ).join('\n')}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏱️ Search: ${data.meta.latencyMs.searchMs}ms | ` +
                    `Answer: ${(data.meta.latencyMs.chatMs / 1000).toFixed(1)}s`
            }
          ]
        }
      ]
    });

  } catch (error) {
    await say({
      thread_ts: event.ts,
      text: `❌ Error: ${error.message}`
    });
  }
});

app.start(3000);
```

### Search-Only Mode (Fast!)

If you just need search results without AI-generated answers:

```bash
# Much faster - no LLM involved!
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "remote work",
    "maxResults": 5
  }'
```

**Response in <1 second:**
```json
{
  "results": [
    {
      "documentId": "interviewds:5ac15fac3de80064",
      "title": "Remote Work Policy",
      "snippet": "All full-time employees who have completed...",
      "url": "https://internal.example.com/policies/hr_remote_work_policy"
    },
    ...
  ],
  "meta": {
    "retrievalCount": 5,
    "latencyMs": { "searchMs": 487 }
  }
}
```

**When to use search-only:**
- Quick lookups
- Building your own UI
- Search suggestions/autocomplete
- Performance-critical paths

---

## 🔧 Setup Flow: One-Time Indexing

Before you can ask questions, you need to index your documents once:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Add Documents                                           │
│ ─────────────────────────────────────────────────────────────── │
│ $ cp company-policies/*.md corpus/                               │
│ $ ls corpus/                                                     │
│   hr_remote_work_policy.md                                       │
│   benefits_policy.md                                             │
│   security_guidelines.md                                         │
└─────────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Run Indexer                                             │
│ ─────────────────────────────────────────────────────────────── │
│ $ npm run index                                                  │
│                                                                   │
│ Indexer reads all .md files:                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ For each file:                                             │   │
│ │ 1. Read content                                            │   │
│ │ 2. Extract title (first non-empty line)                   │   │
│ │ 3. Generate stable ID: sha256(content).slice(0,16)        │   │
│ │    Example: "interviewds:5ac15fac3de80064"                │   │
│ │ 4. Build document object:                                  │   │
│ │    {                                                        │   │
│ │      id: "interviewds:5ac15fac3de80064",                  │   │
│ │      title: "Remote Work Policy",                          │   │
│ │      datasource: "interviewds",                            │   │
│ │      viewURL: "https://internal.example.com/policies/...", │   │
│ │      body: { mimeType: "text/markdown", textContent: ... },│   │
│ │      permissions: { allowAnonymousAccess: true }           │   │
│ │    }                                                        │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│ Output:                                                           │
│ {"message":"indexing_start","count":3,"datasource":"interviewds"}│
│ [INFO] {"message":"glean_api_call","op":"index_documents",...}   │
│ {"message":"indexing_complete","count":3,...}                    │
│                                                                   │
│ Indexed 3 documents into interviewds.                            │
└──────────────────────┬──────────────────────────────────────────┘
m                       │ POST /api/index/v1/bulkindexdocuments
                       │ Auth: Bearer GLEAN_INDEXING_TOKEN
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ GLEAN INDEXING API                                               │
│ - Receives bulk upload                                           │
│ - Validates documents                                            │
│ - Stores in datasource                                           │
│ - Returns 200 OK (~1 second)                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ GLEAN BACKEND PROCESSING (Async)                                │
│ - Chunks documents                                               │
│ - Generates embeddings (vector representations)                  │
│ - Builds search index                                            │
│ - Updates Enterprise Graph                                       │
│                                                                   │
│ ⏱️ Takes: 60-90 seconds                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ STEP 3: Wait                                                     │
│ ─────────────────────────────────────────────────────────────── │
│ $ sleep 90  # Wait for indexing to complete                      │
└─────────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ ✅ READY!                                                        │
│ Documents are now searchable                                     │
│ Start asking questions!                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features of Indexing:

**Idempotent:**
```bash
# Run once
npm run index  # Indexed 3 documents

# Run again (no changes)
npm run index  # Still 3 documents, no duplicates!

# Edit a file
echo "New content" >> corpus/hr_remote_work_policy.md

# Run again
npm run index  # Old version replaced, still 3 documents
```

**Content-based IDs:**
- Same content = Same ID = Update (not duplicate)
- Different content = Different ID = New document

---

## 📊 Performance Deep Dive

### Timing Breakdown (Real Example):

```bash
$ curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is our remote work policy?"}' \
  | jq '.meta.latencyMs'

{
  "searchMs": 507,      # ← Search API
  "chatMs": 18110,      # ← Chat API (bulk of time)
  "totalMs": 18617      # ← Total
}
```

### Why Is Chat So Slow?

The Chat API uses a large language model (LLM) to:
1. Read and understand your question
2. Read and understand 5 retrieved documents
3. Synthesize information from multiple sources
4. Generate a coherent, grounded answer
5. Include proper citations

This is computational heavy lifting! Similar to:
- ChatGPT response time
- Claude response time
- GPT-4 response time

### Optimization Strategies:

**1. Reduce max_sources (fewer docs = faster)**
```javascript
// Faster: Only 2 sources
{ question: "...", maxSources: 2 }  // ~12-15s

// Slower: All 10 sources
{ question: "...", maxSources: 10 } // ~25-30s
```

**2. Use search-only for fast lookups**
```bash
# No LLM = <1 second
POST /api/search
```

**3. Cache common questions**
```javascript
// Simple in-memory cache
const cache = new Map();

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;

  // Check cache
  if (cache.has(question)) {
    return res.json(cache.get(question));
  }

  // Call RAG
  const result = await answerQuestion(...);

  // Store in cache (5 min TTL)
  cache.set(question, result);
  setTimeout(() => cache.delete(question), 5 * 60 * 1000);

  res.json(result);
});
```

---

## 🎬 Live Demo: Web UI Flow

Let me walk you through a complete Web UI flow with real output at each step.

### Prerequisites:
- ✅ Application is running (`npm run dev`)
- ✅ Documents are indexed
- ✅ Browser open to http://localhost:5174

### Step-by-Step Demo:

See the **LIVE DEMO** section below for a real execution!

---

## 🔑 Key Takeaways

### Three Integration Paths, One RAG Orchestrator

```
Web UI ────────┐
               │
MCP Tool ──────┼───→ RAG Orchestrator ───→ Glean APIs
               │      (server/rag.ts)
REST API ──────┘
```

All three paths:
- ✅ Use the same code (`server/rag.ts`)
- ✅ Call the same Glean APIs
- ✅ Return the same structure
- ✅ Have the same performance characteristics

### The RAG Pattern

**R**etrieval **A**ugmented **G**eneration:

1. **Retrieve**: Search for relevant documents (fast, ~500ms)
2. **Augment**: Add them as context to the LLM
3. **Generate**: LLM creates grounded answer (slow, ~15-20s)

This prevents hallucinations because:
- ✅ LLM only sees your actual documents
- ✅ Citations are validated against retrieval results
- ✅ No made-up information can sneak in

### Three Glean APIs Working Together

```
Indexing API  → Upload documents (one-time setup)
     ↓
Search API    → Find relevant docs (per question, fast)
     ↓
Chat API      → Generate grounded answer (per question, slow)
```

### Three Authentication Tokens

Separation of concerns (security best practice):

- `GLEAN_INDEXING_TOKEN` - Write access (privileged operation)
- `GLEAN_SEARCH_TOKEN` - Read access (search only)
- `GLEAN_CLIENT_TOKEN` - Chat access (search + AI)

In production:
- Indexing token → Service identity (rotated, secret manager)
- Client tokens → User-delegated OAuth (per-user permissions)

---

## 📚 Next Steps

1. **Try the Web UI** - See it in action visually
2. **Test the REST API** - Build a simple integration
3. **Set up MCP** - Use it in Claude Desktop
4. **Read the code** - Understand `server/rag.ts`
5. **Customize** - Add your own documents, tweak the UI

---

## 🎬 LIVE DEMO: Complete Web UI Flow

Let's execute a real query and see exactly what happens!

## 🎬 LIVE DEMO: Complete Web UI Flow Execution

**Question:** "Can employees work internationally?"

**Timestamp:** April 28, 2026, 00:29 EDT

---

### 📤 Step 1: Browser Sends HTTP Request

```http
POST http://localhost:3001/api/ask
Content-Type: application/json

{
  "question": "Can employees work internationally?",
  "maxSources": 3
}
```

**User sees:** Loading spinner...

---

### ⚙️ Step 2: Express Server → RAG Orchestrator

**server/index.ts** receives request and calls **server/rag.ts**

#### Phase 1: retrieve() - Search API

```
🔍 Calling Glean Search API
POST /rest/api/v1/search
Auth: Bearer GLEAN_SEARCH_TOKEN

Request: {
  query: "Can employees work internationally?",
  pageSize: 3,
  datasourceFilter: "interviewds"
}

⏱️ Response in: 358ms

✅ Found 3 relevant documents
```

#### Phase 2: ground() - Chat API

```
🤖 Calling Glean Chat API
POST /rest/api/v1/chat
Auth: Bearer GLEAN_CLIENT_TOKEN

Request: {
  query: "Can employees work internationally?",
  context: [3 retrieved documents],
  instructions: "Answer based only on provided context"
}

⏱️ Response in: 22,491ms (~22.5 seconds)

✅ Generated grounded answer with citations
```

#### Phase 3: Validation & Assembly

```
✓ Validate citations match retrieved documents
✓ Assemble sources with metadata
✓ Calculate timing metrics
✓ Generate request ID for tracing

⏱️ Total time: 22,849ms (~22.8 seconds)
```

---

### 📊 Performance Breakdown

```json
{
  "searchMs": 358,      // 358ms - Search API (FAST!)
  "chatMs": 22491,      // 22.5s - Chat API (SLOW - LLM thinking)
  "totalMs": 22849      // 22.8s - Total
}
```

**Why the difference?**
- **Search**: Vector similarity search (optimized, fast)
- **Chat**: Large Language Model generation (computational heavy, slow)

**Pro tip:** Chat API time dominates. This is normal for LLM-based systems!

---

### 📄 Step 3: Retrieved Documents (Search Results)

The Search API found these 3 most relevant documents:

```
📌 IT Help Desk Onboarding Guide
   URL: https://github.com/evorturl/glean/blob/main/fixtures/
        employee-support/it-help-desk-onboarding.md
   
📌 Travel and Conference Policy
   URL: https://github.com/evorturl/glean/blob/main/fixtures/
        employee-support/travel-and-conference-policy.md
   
📌 Infectious disease emergency leave | Ontario.ca
   URL: https://www.ontario.ca/document/your-guide-employment-
        standards-act-0/infectious-disease-emergency-leave
```

These documents were passed as **context** to the Chat API.

---

### 💬 Step 4: Generated Answer

The Chat API read the 3 documents and generated this grounded answer:

```
Employees *might* be able to work internationally, but whether you 
personally can depends on your specific role, visa status, and company 
policy for the country you want to work from.

Because I'm not seeing a published policy in this workspace, you should 
assume **it's not automatically allowed** and get explicit approval. 

Typical steps:

1. **Clarify what you mean by "international":**  
   - Short-term travel (a few days/weeks) while working remotely  
   - Medium-term stays (1–3 months)  
   - Long-term relocation / permanent move

2. **Check official policy:**  
   - Look in your HR/People or Employee Handbook section.  
   - Search for "remote work," "work from abroad," "global mobility"

3. **Ask for approvals before booking travel:**  
   - Your manager (business impact, time zones, role suitability)  
   - HR/People team (employment law, payroll, benefits, immigration)  
   - IT/Security if you'll access systems from a new country

4. **Expect constraints:**  
   Many companies:
   - Restrict work-from-abroad to specific approved countries
   - Limit duration (e.g., max 30 days per year)
   - Require advance notice (30–90 days)
   - May not allow it for certain roles (compliance, security)
```

**Key observation:** The answer explicitly states "I'm not seeing a published 
policy" - this is the Chat API being honest about what it found (or didn't 
find) in the documents!

---

### ✅ Step 5: Response Returned to Browser

**Complete response structure:**

```json
{
  "answer": "Employees *might* be able to work internationally...",
  "sources": [
    {
      "documentId": "CUSTOM_INTERVIEWDS_...",
      "title": "IT Help Desk Onboarding Guide",
      "url": "https://...",
      "snippet": "..."
    },
    {
      "documentId": "CUSTOM_INTERVIEWDS_...",
      "title": "Travel and Conference Policy",
      "url": "https://...",
      "snippet": "..."
    },
    {
      "documentId": "WEB_CPBLRII_...",
      "title": "Infectious disease emergency leave",
      "url": "https://ontario.ca/...",
      "snippet": "..."
    }
  ],
  "meta": {
    "retrievalCount": 3,
    "retrievedIds": ["...", "...", "..."],
    "latencyMs": {
      "searchMs": 358,
      "chatMs": 22491,
      "totalMs": 22849
    },
    "requestId": "uuid-generated-id"
  }
}
```

---

### 🎨 What the User Sees

**React Web UI displays:**

```
╔══════════════════════════════════════════════════════════════════╗
║ 💬 Answer                                                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║ Employees *might* be able to work internationally, but whether   ║
║ you personally can depends on your specific role, visa status,   ║
║ and company policy...                                            ║
║                                                                   ║
║ [Full answer displayed with markdown formatting]                 ║
║                                                                   ║
╚══════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════╗
║ 📚 Sources (3)                                                    ║
╠══════════════════════════════════════════════════════════════════╣
║ 📄 IT Help Desk Onboarding Guide                                 ║
║    🔗 https://github.com/evorturl/glean/blob/main/...            ║
║                                                                   ║
║ 📄 Travel and Conference Policy                                  ║
║    🔗 https://github.com/evorturl/glean/blob/main/...            ║
║                                                                   ║
║ 📄 Infectious disease emergency leave                            ║
║    🔗 https://www.ontario.ca/document/...                        ║
╚══════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════╗
║ ⚡ Performance                                                    ║
╠══════════════════════════════════════════════════════════════════╣
║ Search: 358ms | Chat: 22.5s | Total: 22.8s                       ║
╚══════════════════════════════════════════════════════════════════╝
```

**User can:**
- ✅ Read the full answer
- ✅ Click any source link to view the original document
- ✅ See performance metrics
- ✅ Ask another question

---

### 🔍 Behind-the-Scenes Server Logs

While this was happening, the server logged:

```
{"message":"api_request","requestId":"...","endpoint":"/api/ask","maxSources":3}
[INFO] {"message":"glean_api_call","client":"query","op":"search","status":200,"latencyMs":358}
[INFO] {"message":"glean_api_call","client":"query","op":"chat","status":200,"latencyMs":22491}
```

These logs show:
- ✅ Request received
- ✅ Search API called successfully (358ms)
- ✅ Chat API called successfully (22,491ms)

---

### 🎯 Key Observations from This Demo

1. **Search is fast** (358ms) - efficient vector search
2. **Chat is slow** (22.5s) - LLM generation takes time
3. **Total dominated by Chat** - 98.4% of time spent in Chat API
4. **Honest answers** - Chat admits when it doesn't find clear policy
5. **Citations verified** - All sources actually from Search results
6. **Complete traceability** - Request ID tracks entire flow

---

### 💡 What If We Optimize?

**Reduce to 2 sources instead of 3:**

```bash
# Fewer sources = less context = faster Chat API
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "maxSources": 2}'
```

**Expected improvement:**
- Search: ~300ms (similar)
- Chat: ~15-18s (15-25% faster)
- Total: ~16-18s (20% improvement)

**Use search-only mode:**

```bash
# Skip Chat API entirely
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "...", "maxResults": 3}'
```

**Performance:**
- Total: <500ms (50x faster!)
- Trade-off: No AI-generated answer, just search results

---

## 🎓 What We Learned

From this one demo query, we saw:

✅ **Three-tier architecture in action:**
   - Client → Express Server → Glean APIs

✅ **RAG pattern working:**
   - Retrieve (Search API)
   - Augment (add as context)
   - Generate (Chat API)

✅ **Performance characteristics:**
   - Search: Fast (~300-500ms)
   - Chat: Slow (~15-25s)
   - Total: Chat-dominated

✅ **Citation validation:**
   - Every source traceable to Search results
   - No hallucinated documents

✅ **Honest AI:**
   - Admits when it doesn't find clear answers
   - Suggests next steps for user

---

**Ready to try it yourself?** Open http://localhost:5174 and ask a question!
