# 👋 Start Here - Glean RAG Chatbot

Welcome! This is a **Node.js/TypeScript/React** RAG chatbot built on the Glean Indexing, Search, and Chat APIs.

---

## 🚀 Quick Start (5 Minutes)

**Complete beginner?** Follow these exact steps:

### Step 1: Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

### Step 2: Configure Tokens

```bash
cp .env.example .env
nano .env  # Or use your favorite editor
```

Paste your 3 Glean tokens into the `.env` file.

### Step 3: Test Environment

```bash
npm run test
```

You should see: `All checks passed. Environment is ready.`

### Step 4: Index Documents

```bash
npm run index
```

**⚠️ Got a 400 error?** See [INDEXING_ISSUE.md](INDEXING_ISSUE.md) - your datasource may need URL pattern configuration.

**Wait 90 seconds** for indexing to complete.

### Step 5: Start the App

```bash
npm run dev
```

### Step 6: Open in Browser

```
http://localhost:5173
```

Ask: **"What is our remote work policy?"**

**That's it!** You're done. 🎉

**Try the examples:**
```bash
# Show sources for a question
./examples/show-sources.sh "What is our remote work policy?"

# Ask multiple questions
./examples/multiple-questions.sh
```

See [examples/README.md](examples/README.md) for more!

---

## 📚 Documentation Guide

### New to this project?

**Start with:** `QUICKSTART.md`
- Get up and running in 5 minutes
- Minimal explanations
- Just the commands you need

### Want detailed setup?

**Read:** `WALKTHROUGH.md`
- Step-by-step guide with expected outputs
- Screenshots of what you should see
- Troubleshooting for each step

### Need to test everything?

**Use:** `TESTING.md`
- Comprehensive testing guide
- Expected outputs for all tests
- Performance benchmarks
- Automated test suite

### Want technical details?

**See:** `README_NODE.md`
- Complete technical documentation
- API reference
- Architecture details
- Deployment guide

### Curious about the design?

**Check:** `README.md`
- Design philosophy
- Architecture diagrams
- ADRs (Architecture Decision Records)
- Production roadmap

### Need quick reference?

**Use:** `SETUP_SUMMARY.md`
- Command cheat sheet
- File structure
- Common issues
- Migration from Python

---

## 🎯 Choose Your Path

### Path 1: "Just make it work"
1. ✅ Read: QUICKSTART.md
2. ✅ Run: `npm run test`
3. ✅ Run: `npm run index`
4. ✅ Run: `npm run dev`
5. ✅ Open: http://localhost:5173

**Time:** 5 minutes

### Path 2: "I want to understand everything"
1. ✅ Read: QUICKSTART.md
2. ✅ Read: WALKTHROUGH.md
3. ✅ Read: TESTING.md
4. ✅ Read: README_NODE.md
5. ✅ Run: `./test-all.sh`

**Time:** 30 minutes

### Path 3: "I want quick reference"
1. ✅ Read: SETUP_SUMMARY.md (command cheat sheet)
2. ✅ Run: `npm run test`
3. ✅ Run: `npm run index`
4. ✅ Run: `npm run dev`
5. ✅ Explore: Code structure in `server/` and `client/`

**Time:** 15 minutes

### Path 4: "I'm deploying to production"
1. ✅ Read: README_NODE.md (full docs)
2. ✅ Read: TESTING.md (validation)
3. ✅ Run: `./test-all.sh`
4. ✅ Run: `npm run build`
5. ✅ Review: Original README.md (design & productionization)

**Time:** 1 hour

---

## 🛠️ Essential Commands

### Testing

```bash
# Pre-flight check (run FIRST)
npm run test

# Comprehensive test suite
npm run test:all
# or
./test-all.sh
```

### Development

```bash
# Full stack (backend + frontend)
npm run dev

# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

### Indexing

```bash
# Index documents
npm run index

# MCP test mode
npm run mcp -- --test "Your question"
```

### Production

```bash
# Build
npm run build

# Run production build
npm start
```

---

## ❓ Common Questions

### Q: What is this?

A RAG chatbot that lets you ask questions about your indexed documents using the Glean APIs. Think of it as "ChatGPT for your company docs".

### Q: What features does this have?

✅ RAG-based question answering with Glean APIs
✅ React web UI for visual interaction
✅ REST API for integration
✅ TypeScript for type safety
✅ MCP server for tool integration
✅ Hot reload and modern dev experience

### Q: Can I still use MCP?

Yes! The MCP server is preserved. Run: `npm run mcp`

### Q: Which should I use - Web UI or MCP?

- **Web UI**: Better for demos, user-facing, visual interaction
- **MCP**: Better for tool integration, Cursor/Claude Desktop

### Q: Where are my tokens?

You should have received 3 tokens from Glean:
1. `GLEAN_INDEXING_TOKEN` - For writing to the knowledge base
2. `GLEAN_CLIENT_TOKEN` - For reading via Chat and Search
3. `GLEAN_SEARCH_TOKEN` - Optional dedicated search token

Put them in `.env` file.

### Q: Why 3 separate tokens?

Security! Matches how you'd deploy this in production - indexing runs as a service identity, search/chat run as end users.

### Q: How long does indexing take?

- API call: ~1 second
- Documents become searchable: 1-2 minutes
- **Always wait 90+ seconds after indexing before testing**

### Q: What if tests fail?

1. Check `.env` has all tokens
2. Verify network access to `support-lab-be.glean.com`
3. See WALKTHROUGH.md → Troubleshooting section

### Q: Performance is slow?

- First request is always slower (cold start)
- Check `meta.latencyMs` in response
- Target: < 5 seconds total
- See TESTING.md → Performance Testing

### Q: Can I add more documents?

Yes!
```bash
# Add .md files to corpus/
cp your-docs/*.md corpus/
# Re-index
npm run index
# Wait 90 seconds
# Test with relevant questions
```

---

## 🎓 Learning Path

### For JavaScript Developers

1. **Familiar:** React, Express, TypeScript
2. **New:** Glean APIs, RAG pattern, MCP
3. **Read:** README_NODE.md → Architecture section
4. **Explore:** `server/rag.ts` (RAG orchestration)

### For Backend Developers

1. **Stack:** Node.js, TypeScript, Express
2. **New:** Glean APIs, RAG pattern
3. **Read:** README_NODE.md → Backend Architecture
4. **Explore:** `server/` (core RAG logic)

### For DevOps/Deployment

1. **Familiar:** Node.js deployments
2. **New:** Glean API integration
3. **Read:** README_NODE.md → Production Deployment
4. **Review:** Original README.md → Productionization plan

### For Beginners

1. **Start:** QUICKSTART.md
2. **Then:** WALKTHROUGH.md
3. **Practice:** Ask different questions
4. **Explore:** Modify React components
5. **Learn:** README_NODE.md when curious

---

## 🔧 Troubleshooting

### Nothing works!

```bash
# Nuclear option: start fresh
rm -rf node_modules client/node_modules
npm install
cd client && npm install && cd ..
npm run test
```

### Smoke test fails?

See WALKTHROUGH.md → Troubleshooting section

### Can't access http://localhost:5173?

```bash
# Check if backend is running
curl http://localhost:3001/health

# Restart
npm run dev
```

### Still stuck?

1. Check all docs in this order:
   - QUICKSTART.md
   - WALKTHROUGH.md
   - TESTING.md
   - SETUP_SUMMARY.md

2. Run diagnostics:
   ```bash
   npm run test
   ./test-all.sh
   ```

3. Check logs (in terminal where you ran `npm run dev`)

---

## 📋 Pre-Flight Checklist

Before you start, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] You have 3 Glean tokens
- [ ] You can access `support-lab-be.glean.com`
- [ ] Ports 3001 and 5173 are available

**All set?** → Run: `npm run test`

---

## 🎯 Success Checklist

You're done when:

- [ ] `npm run test` passes (4/4 checks)
- [ ] `./test-all.sh` passes (7/7 tests)
- [ ] Can open http://localhost:5173
- [ ] Can ask questions and get answers
- [ ] Sources display with answers
- [ ] Performance < 5 seconds

**All checked?** You're ready! 🚀

---

## 📖 Documentation Index

| File | Purpose | Read When |
|------|---------|-----------|
| **START_HERE.md** | This file - entry point | First time |
| **QUICKSTART.md** | 5-minute setup | Want it working now |
| **WALKTHROUGH.md** | Detailed step-by-step | Want to understand |
| **TESTING.md** | Testing & validation | Need to verify |
| **SETUP_SUMMARY.md** | Quick reference | Need a command |
| **README_NODE.md** | Full technical docs | Want all details |
| **README.md** | Design & architecture | Want design context |
| **test-all.sh** | Automated tests | Want to validate |

---

## 🚀 Next Steps

**After you have it running:**

1. ✅ Ask different questions
2. ✅ Add more documents to `corpus/`
3. ✅ Customize the React UI
4. ✅ Explore the API with curl
5. ✅ Read the design docs (README.md)

**Ready to go deeper?**

1. ✅ Review the RAG logic in `server/rag.ts`
2. ✅ Understand the API clients in `server/glean-client.ts`
3. ✅ Explore React components in `client/src/components/`
4. ✅ Read about production deployment in README_NODE.md

---

## 💡 Pro Tips

1. **Always run `npm run test` first** - catches 90% of issues
2. **Wait 90 seconds after indexing** - indexing is async
3. **Check browser console (F12)** - frontend errors show there
4. **Check terminal** - backend logs show there
5. **Use `test-all.sh`** - comprehensive validation in one command

---

**Ready to begin?** → Go to `QUICKSTART.md`

**Want details first?** → Go to `WALKTHROUGH.md`

**Just show me the commands!** → Go to `SETUP_SUMMARY.md`

---

**Happy coding!** 🎉
