# Quick Start Guide

Get the Glean RAG Chatbot up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Glean sandbox credentials (3 tokens)

## Setup

### 1. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your three Glean tokens:
- `GLEAN_INDEXING_TOKEN`
- `GLEAN_CLIENT_TOKEN`
- `GLEAN_SEARCH_TOKEN`

### 3. Index documents

```bash
npm run index
```

Picks up `*.md` and `*.txt` files from `corpus/`. Add `--bulk` for a full-sync upload via `/bulkindexdocuments`. Wait 1-2 minutes for documents to become searchable.

### 4. Start the app

```bash
npm run dev
```

This starts:
- Backend API: http://localhost:3001
- Frontend UI: http://localhost:5173

### 5. Use the chatbot

Open http://localhost:5173 in your browser and start asking questions!

## Example Questions

Try these to test the chatbot:

- "What is our remote work policy?"
- "Tell me about the HR policies"
- "Can employees work from home?"

## Troubleshooting

**Can't connect?**
- Check both servers are running (backend on 3001, frontend on 5173)
- Verify your `.env` file has all required tokens

**No search results?**
- Wait 1-2 minutes after indexing
- Check that documents were indexed successfully with `npm run test`

**Need help?**
- See README_NODE.md for full documentation
- Check README.md for design and architecture details
