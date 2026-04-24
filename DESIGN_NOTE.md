# Glean RAG Chatbot — Design Note
*Framed using Iasa BTABoK Structured Canvas Artifacts*

> This note uses BTABoK's structured canvases (ASR Card, Context View Card, QATT Card, ADR, Risk & Cost Card, Stakeholder Engagement Map) to document a prototype RAG chatbot built on the Glean Indexing, Search, and Chat APIs, exposed as an MCP tool. The prototype is deliberately small; the canvases exist so that a discussion of "what would it take to productionize this for a real customer" has a concrete starting point.

See `architecture_diagram.svg` for the companion data flow diagram.

---

## 1. Architecturally Significant Requirement (ASR Card)

### ASR-001: Grounded Q&A over an Enterprise Knowledge Corpus via MCP

**Architecturally Relevant Story/Epic**
> *As a* knowledge worker using an MCP-compatible client (Cursor, Claude Desktop), *I need* to ask a natural-language question against my organization's indexed content and receive a grounded answer with clear source references, *so that* I can make decisions with provenance rather than with hallucinated text and without leaving my working environment.

**Systemic Impacts**
- Requires one-time ingestion of a constrained document set into a Glean sandbox datasource via the Indexing API.
- Requires runtime retrieval of relevant chunks via the Search API.
- Requires grounded generation via the Chat API, with the retrieved chunks supplied as context.
- Requires an MCP server that exposes a single tool (`ask_knowledge_base`) over stdio.
- Requires source citations that resolve back to the original Glean document view.

**Architecture Relevance** *(1–5)*

| Dimension | Score | Rationale |
|---|---|---|
| Money | 2 | Prototype; no direct revenue impact. Value is in the learning and the conversation it enables. |
| Strategic importance | 4 | Demonstrates Glean's composability story (Indexing + Search + Chat + MCP). |
| Quality attribute impact | 4 | Touches accuracy, auditability, security, and explainability — the four attributes customers ask about most. |
| Risk | 2 | Sandbox-only; bounded blast radius. |
| **Overall** | **Medium-High** | **Worth building as a reference; not yet ready for customer deployment.** |

**Strategy & Plan**
- *Phase 0 (this exercise):* Single-user, service-account auth, ~20 documents, single MCP tool, local-only.
- *Phase 1 (to discuss live):* Per-user auth, permission propagation, error surfacing, evaluation harness.
- *Phase 2 (customer-ready):* Multi-tenancy, streaming, observability, deployment pattern, conversation memory.

**Benefits Measures**
- End-to-end question-to-cited-answer latency under 10 s (p95).
- 100% of answers include at least one source citation that resolves to a valid Glean document URL.
- Zero hallucinated sources (every cited document was actually returned by Search).

**Stakeholders**
- End user (knowledge worker in MCP client)
- Glean sandbox admin (indexing configuration)
- (Production) customer security & audit
- (Production) customer enterprise architect reviewing the integration

---

## 2. Context View Card

**System under discussion:** Glean RAG Chatbot Prototype (local MCP server + orchestrator).

**Actors:**
- *User* — asks a natural-language question from an MCP client.
- *Sandbox admin* — configures the sandbox datasource and API token.

**Systems consumed (external):**
- Glean Indexing API — bulk document upsert to the sandbox datasource.
- Glean Search API — ranked retrieval for natural-language queries.
- Glean Chat API — grounded generation with citations.

**Systems adjacent (host environment):**
- MCP Client (Cursor or Claude Desktop) — invokes the tool over stdio.
- Local filesystem — source corpus and structured logs.
- `.env` / secrets store — API token and configuration.

**Out of scope (stated explicitly):**
- Authentication beyond a bearer token (no OAuth/SSO).
- Per-user permission propagation (search runs as the token's identity).
- Streaming responses; conversation memory; multi-turn threading.
- UI beyond the MCP tool surface.
- Deployment, packaging, or hosting of the MCP server.
- Any production datasource beyond the sandbox.

---

## 3. Quality Attribute Cards (QATT)

Each card follows the ATAM structure — *Source → Stimulus → Environment → Artifact → Response → Response Measure*.

### QATT-001 — Grounding Accuracy (No Hallucinated Sources)

| | |
|---|---|
| **Source** | End user |
| **Stimulus** | Question where relevant answer is in the corpus |
| **Environment** | Normal operation |
| **Artifact** | RAG orchestrator |
| **Response** | Every document cited in the answer must have been returned by the preceding Search API call |
| **Response Measure** | **100%**; enforced by passing only retrieved document IDs into the Chat context and validating citations against the retrieval set before returning |

### QATT-002 — Citation Resolvability

| | |
|---|---|
| **Source** | End user |
| **Stimulus** | Clicks a source URL in the returned answer |
| **Environment** | Normal operation |
| **Artifact** | MCP tool response |
| **Response** | URL opens the correct Glean document view |
| **Response Measure** | **100%** for indexed documents; validated during indexing by storing the `viewURL` alongside the document ID |

### QATT-003 — Latency

| | |
|---|---|
| **Source** | End user |
| **Stimulus** | Submits a question |
| **Environment** | Single user, warm cache, sandbox corpus (~20 docs) |
| **Artifact** | End-to-end flow |
| **Response** | Returns answer + sources |
| **Response Measure** | **p50 < 4 s, p95 < 10 s** (bounded by Chat API latency) |

### QATT-004 — Graceful Degradation

| | |
|---|---|
| **Source** | Glean API |
| **Stimulus** | Search or Chat API returns 5xx, 429, or times out |
| **Environment** | Transient external failure |
| **Artifact** | RAG orchestrator |
| **Response** | Retry with exponential backoff (3 attempts); on final failure return a structured error the MCP client can render |
| **Response Measure** | No uncaught exceptions reach the MCP client; errors carry a request ID for debugging |

### QATT-005 — Secret Handling

| | |
|---|---|
| **Source** | Developer / reviewer |
| **Stimulus** | Inspects the repository |
| **Environment** | Source control |
| **Artifact** | Repository |
| **Response** | No secrets committed; `.env.example` documents required keys |
| **Response Measure** | `.gitignore` excludes `.env`; CI could add a secrets scan (noted, not implemented) |

### QATT-006 — Ingestion Idempotency

| | |
|---|---|
| **Source** | Sandbox admin |
| **Stimulus** | Re-runs the indexer |
| **Environment** | Normal operation |
| **Artifact** | Indexer |
| **Response** | Documents are upserted by stable ID, not duplicated |
| **Response Measure** | Document count in the datasource equals the corpus count after any number of re-runs |

---

## 4. Architecture Decision Records

### ADR-001: Explicit Search-then-Chat Orchestration vs. Chat-Native Retrieval

- **Status:** Accepted (for the prototype)
- **Context.**
  Glean's Chat API is capable of performing retrieval against the user's indexed content internally. This means there are two legitimate patterns:
  1. **Explicit orchestration** — we call Search, select top-k, pass the results as context to Chat.
  2. **Chat-native retrieval** — we call Chat directly and let the platform retrieve.
- **Decision.** Use pattern (1) for the prototype.
- **Rationale.**
  - The exercise prompt explicitly asks us to use all three APIs; pattern (2) would make the Search API redundant.
  - Explicit orchestration lets us control top-k, filter by datasource, inspect retrieved documents before they reach the LLM, and log retrieval separately from generation — all things a customer-facing SA needs to be able to explain.
  - It also gives us a clear failure surface ("retrieval returned nothing" vs. "generation was weak") which is valuable for debugging in the live session.
- **Consequences / trade-offs.**
  - Adds a round-trip and some latency vs. pattern (2).
  - Duplicates some of Glean's internal logic in user code — not a free win in production.
  - **For a production scenario**, pattern (2) is often preferable because the platform's retrieval is richer than what we'd orchestrate ourselves, and Chat-native retrieval honors permissions implicitly. This trade-off is a natural discussion point in the live session.

---

### ADR-002: Single MCP Tool vs. Multiple Tools

- **Status:** Accepted
- **Context.** MCP allows exposing multiple tools. We could split retrieval and generation into two tools, or offer `ask_knowledge_base`, `search_only`, `summarize_document`, etc.
- **Decision.** One tool: `ask_knowledge_base(question, max_sources?, datasource_filter?)`.
- **Rationale.** Prompt asks for a single MCP tool; aligns with the "one job, done well" principle; reduces surface area for the demo.
- **Consequences.** If the interviewer asks to add a second tool live, the code is structured so `rag.retrieve()` and `rag.ground()` are independently callable — adding a `search_only` tool is a ~15-line change.

---

### ADR-003: Stable Document IDs via Content Hash

- **Status:** Accepted
- **Context.** The Indexing API upserts by document ID. Without a deterministic ID, re-running the indexer creates duplicates.
- **Decision.** Document ID = `{corpus_prefix}:{sha256(content)[:16]}`. Title and URL are attributes.
- **Rationale.** Idempotent, collision-resistant at this scale, doesn't require an external mapping table.
- **Consequences.** Changing document content produces a new ID (the old one becomes orphaned). Acceptable for a prototype; for production we'd want an ID scheme keyed on stable external identifiers (filename, source system ID) with content hash as a change-detection signal.

---

## 5. Risk and Cost Card

| # | Risk | Likelihood | Impact | Mitigation (prototype) | Mitigation (production) |
|---|---|---|---|---|---|
| R1 | Hallucinated citations (model cites a doc not in retrieval) | Medium | High | Validate cited doc IDs against retrieval set before returning | Strict citation validation + fall back to "no grounded answer available" |
| R2 | Permission leakage (service account sees docs a real user shouldn't) | **Low in sandbox / High in prod** | Very High | Sandbox only; fake corpus | Search-as-user via SSO/token delegation; respect source-system ACLs |
| R3 | API key exposure | Low | High | `.env`, `.gitignore`, no secrets in code | Secret manager, short-lived tokens, rotation policy |
| R4 | Corpus staleness | Low | Medium | Idempotent re-index on demand | Scheduled re-indexing, CDC from source systems, freshness monitoring |
| R5 | Empty retrieval leading to ungrounded answer | Medium | Medium | Detect empty retrieval; return explicit "no relevant sources found" | Same + fallback to wider search or "I don't know" response |
| R6 | Cost / rate-limit blow-up | Low | Medium | Small corpus, single user | Rate limiting per MCP session, budget alerts |
| R7 | PII in logs | Low | Medium | Hash or truncate question text in structured logs | Full PII scrubbing pipeline, retention controls |
| R8 | MCP tool abuse (prompt injection via doc content) | Medium | Medium | Not addressed in prototype | System-prompt hardening, injection detection, output policy layer |

---

## 6. Stakeholder Engagement Map *(production scenario)*

For the prototype, the only stakeholders are the interviewers and me. The real value of this canvas is describing who would matter if a customer asked us to build this.

| Stakeholder | Power | Interest | Trust | Concern | Architecture must… |
|---|---|---|---|---|---|
| Enterprise architect | High | High | Medium | Fits estate; scalable; supportable | Provide clear reference architecture and deployment options |
| CISO / security | High | High | High | Data residency, permissions, auth, logging | Show auth flow, data flow, audit log; 23 NYCRR 500 / SOC 2 posture |
| Privacy / compliance | High | Med | High | PII/PHI handling, retention, regulatory posture | Data-flow diagram; retention config; opt-out |
| App owner | Med | High | Med | Actually works for their content | Representative corpus test; evaluation harness |
| End users | Low | Very High | Med–High | Answers are right; fast enough; feels native | Latency budget, citation clarity, MCP integration |
| Platform / SRE | Med | Med | High | Observability, failure modes, cost | Structured logs, metrics, runbook |
| Glean CSM + SA (us) | — | — | — | Customer succeeds; adoption grows | Documentation, training, extension points |

---

## 7. Data Flow Summary

Referenced visually in `architecture_diagram.svg`. In words, the three-step runtime flow:

1. **Retrieve.** MCP tool receives the question → calls Search API with the question, `pageSize = 5`, scoped to the sandbox datasource → receives ranked results with titles, snippets, and `viewURL`s.
2. **Ground.** RAG orchestrator calls Chat API with the question and the retrieved snippets supplied as context → receives a grounded answer.
3. **Assemble.** Orchestrator validates that any inline citations reference documents present in the retrieval set → returns `{answer, sources[{title, url, snippet}]}` to the MCP client.

A separate one-time **Index** flow runs the indexer against the local corpus and upserts documents to the sandbox datasource via the Indexing API.

---

## 8. Key Tradeoffs and Limitations (explicit)

**Tradeoffs made deliberately for this exercise.**
- *Explicit orchestration over Chat-native retrieval* — see ADR-001.
- *Single MCP tool* — see ADR-002.
- *Service-account auth* — simplest possible; acknowledged as wrong for production.
- *No chunking in user code* — we rely on Glean's indexing-side chunking rather than pre-chunking locally. Appropriate for the prototype; something to evaluate for specific document types in production.
- *No evaluation harness* — documented below as a Phase 1 item.

**Known limitations.**
- No per-user permissions; every query runs as the sandbox service account.
- No conversation memory; every question is independent.
- No streaming response.
- No retry on the MCP tool itself — only on outbound Glean API calls.
- No offline mode; MCP tool errors if Glean is unreachable.
- No automated evaluation of answer quality.
- Prompt-injection resistance relies entirely on Glean's Chat API defaults; not hardened in user code.

**What Phase 1 would add (highest leverage first):**
1. Per-user auth via OAuth/SSO and search-as-user.
2. Evaluation harness with a gold-set of question-answer-source triples and offline scoring.
3. Streaming responses for long-running generations.
4. Conversation memory scoped to an MCP session.
5. Structured observability beyond local logs — OpenTelemetry traces, Prometheus metrics, or the customer's equivalent.

**What Phase 2 would add for a real customer deployment:**
- Deployment pattern — the MCP server as a containerized service, or distributed as a signed binary? Each has security implications worth discussing.
- Multi-tenancy / multi-datasource routing.
- Citation validation as a hard invariant (reject responses with unverifiable citations).
- Output policy layer — PII scrubbing, safety filtering, response templating per customer.
- Cost / quota controls per end user.

---

*References: Iasa Global, Business Technology Architecture Body of Knowledge (BTABoK), https://iasa-global.github.io/btabok/ — in particular the ASR Card, Context View Card, QATT Card, ADR, Risk and Cost Card, and Stakeholder Engagement Map canvases.*
