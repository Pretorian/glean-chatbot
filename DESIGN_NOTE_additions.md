# Glean RAG Chatbot — Design Note (Sections to replace / append)

> The following sections replace **§ 4 (Architecture Decision Records)** and **§ 8 (Key Tradeoffs and Limitations)** in the existing `DESIGN_NOTE.md`. ADR-004 is new; § 8 is rewritten to answer the Part 2 prompt directly.

---

## 4. Architecture Decision Records *(updated — ADR-004 added)*

### ADR-001: Explicit Search-then-Chat Orchestration vs. Chat-Native Retrieval
*(unchanged — see previous version)*

### ADR-002: Single MCP Tool vs. Multiple Tools
*(unchanged — see previous version)*

### ADR-003: Stable Document IDs via Content Hash
*(unchanged — see previous version)*

### ADR-004: Separation of Indexing Auth from Client Auth

- **Status:** Accepted
- **Context.** Glean issues distinct tokens for indexing (back-end write path) and client operations (Chat, Search). The sandbox provides three tokens: Indexing, Search, and Client (Chat + Search, Global scope). A naive implementation collapses these into one client with one token passed per call.
- **Decision.** Model the separation explicitly. `IndexingClient` uses the Indexing token and is only imported by `indexer.py`. `QueryClient` uses the Client (or optional Search) token and is the only thing the MCP tool code touches. Tokens are loaded into typed fields in `Config` and passed to clients at construction time — they are never read from `os.environ` inside business logic.
- **Rationale.**
  - Matches Glean's own trust-boundary design — indexing is a privileged pipeline operation; search/chat run on behalf of a user identity.
  - Makes it structurally impossible for the MCP tool to accidentally call the Indexing API with a user-scoped token (or vice versa).
  - Cleanly generalizes to production, where the indexing token belongs to a service identity (rotated, scoped, stored in a secret manager) and the client token — in a real deployment — is replaced by a user-delegated OAuth flow.
- **Consequences.**
  - Two client classes instead of one. Minor code duplication at the transport level, which is why the shared retry/logging logic lives in `_BaseClient`.
  - Slightly more involved local setup (three env vars instead of one). The `.env.example` compensates with clear comments.
  - Opens a clean path to ADR-006 in Phase 1 (search-as-user via user-delegated tokens) without restructuring the code.

---

## 8. Productionization — Answering the Part 2 Prompt

The exercise's Part 2 prompt asks:

> *"You built an application using Glean APIs for a constrained document set. Now imagine the customer wants to productionize this solution for multiple teams, connect it to an internal support chatbot, and support stronger permissions, observability, and rollout controls. Walk us through how you would evolve your design."*

This section answers that prompt in the order it's asked, then closes with a design → build → test → rollout plan.

### 8.1 Multiple teams

**Problem.** The prototype uses one sandbox datasource (`interviewds`) and one service-account identity. In production, different teams — HR, Engineering, Legal, Support — have different content, different sensitivities, and different "who can see what" rules.

**What changes architecturally.**

- **Datasource strategy.** Two legitimate options, with different trade-offs:
  - *One datasource per team.* Strong isolation; clean per-team ACLs at the datasource level; easy to decommission a team's content. Higher operational overhead.
  - *One shared datasource with document-level permissions.* Uses Glean's permissions model (ACLs on each indexed document) to partition access. Less operational overhead; requires disciplined metadata. Breaks down if teams have wildly different indexing cadences.
  - *Recommendation:* start with per-team datasources for clarity; revisit if the team count grows past ~20.
- **Team-level configuration.** A `teams.yaml` (or a config service, once this outgrows a file) maps team → datasource → allowed-MCP-tools → retrieval defaults (top-k, which model to route to Chat, system-prompt overrides). Read once at startup; hot-reloadable via signal or sidecar.
- **Routing at the MCP surface.** Either (a) one MCP tool with a required `team` parameter that drives the datasource filter, or (b) one tool per team registered dynamically. Option (a) is simpler for operators; option (b) gives tighter least-privilege per session. A shared support-chatbot deployment (§ 8.2) prefers (a).
- **Per-team quota.** Different teams, different cost envelopes. Track Chat token usage per team; alarm on overage; enforce with a soft block (degrade to Search-only) rather than a hard fail.

### 8.2 Integration with the internal support chatbot

**Problem.** The prototype exposes the RAG flow as a local MCP tool over stdio. An "internal support chatbot" is hosted, shared, always-on, and typically integrated into a channel like Slack, Teams, or a web widget on the intranet.

**What changes architecturally.**

- **Deployment shape.** Move from "local MCP server" to "hosted HTTP service." The `rag.py` core — `retrieve / ground / assemble` — stays unchanged. Wrap it in a thin FastAPI service behind an internal load balancer. This is roughly a day of work because the RAG core was deliberately kept transport-agnostic (ADR-002 / code structure).
- **Keep the MCP tool.** Do not delete it. It remains valuable for power users in Cursor and for internal debugging. The MCP server and the HTTP service share the same `rag.answer_question()` entry point.
- **Chatbot surface integration.** Two paths:
  - *Glean Chat SDK / embedded experience.* Lowest integration cost; inherits Glean's UI, citation rendering, and follow-up-question handling. Appropriate when "make Glean available in Slack" is the intent.
  - *Custom surface on the FastAPI service.* Required when the customer has a bespoke support UX or needs to inject their own policy layer (PII scrubbing, compliance disclaimers, ticket-creation integration).
- **Session & conversation memory.** The prototype is single-turn. A support chatbot needs multi-turn continuity — "and what about for contractors?" needs to remember the previous question was about remote work. Add a thin session store (Redis, 30-minute TTL) keyed on session ID; pass the last N turns to Chat as context.
- **Streaming.** Support chatbots feel slow without streaming tokens. The Chat API supports streaming; expose SSE or WebSocket on the FastAPI surface.

### 8.3 Stronger permissions

This is the highest-risk area and the place where a prototype-to-production transition most commonly fails.

**The core shift: stop searching as a service account. Search as the user.**

- **Authentication.** Replace the service-account Client token with user-delegated auth via OAuth / SSO. Every inbound request carries the end user's identity (derived from the support-chatbot session, or the MCP client's authenticated context); the RAG service exchanges that for a short-lived Glean token scoped to that user.
- **Authorization at indexing time.** When the indexer pushes a document, it includes the correct ACL (`permissions` field: group membership, specific users, roles). Glean's Search and Chat APIs then respect those ACLs automatically — which means once indexing is correct, permission enforcement is a platform concern, not application code. This is the single biggest architectural advantage of using Glean over rolling your own RAG, and it's worth leading with in the interview discussion.
- **Audit.** Every inbound question, every retrieval, every generation is logged with `{user, team, timestamp, question_hash, retrieved_doc_ids, latency_ms, request_id}`. Retention per the customer's policy. Accessible to security and compliance without engineering involvement.
- **PII handling.** Before a question leaves the customer's perimeter, pass it through a PII detector. Questions containing high-sensitivity PII (SSN, health info, financial account numbers) can be blocked, redacted, or routed to a locked-down path depending on customer policy.
- **Regulatory posture.** For regulated customers: data residency (region-pin the Chat API and any logging), key management (CMK for encryption at rest), SOC 2 / ISO 27001 attestations from Glean, and — for insurance, healthcare, finance — explicit contractual terms around training (most enterprises require that their queries not be used to train foundation models).

### 8.4 Observability

**Problem.** The prototype emits local JSON logs. Production teams need to answer three questions in under five minutes: *Is it up? Is it correct? Is it fast enough?*

**What to add, by layer.**

- **Metrics (RED + saturation).** Request rate, error rate, latency percentiles — per team, per tool, per Glean API. Saturation: open connections, queue depth, token usage against quota.
- **Distributed tracing.** OpenTelemetry instrumentation end-to-end: MCP/HTTP inbound → retrieve → ground → outbound Glean calls. Trace IDs propagate into Glean request headers where supported. This is what lets an SRE answer "why was this one question slow?" in seconds rather than hours.
- **Structured logs.** Already in the prototype. In production, ship to the customer's log aggregator (Datadog, Splunk, CloudWatch). Log sampling for high-volume deployments.
- **RAG quality metrics (the thing most teams skip).**
  - *Retrieval quality* — click-through on cited sources, "no relevant sources" rate per team, top-k distribution.
  - *Generation quality* — periodic offline evaluation against a gold set (§ 8.6); thumbs-up / thumbs-down from users; flagged-response rate.
  - *Groundedness* — fraction of answers where every cited document was in the retrieval set (this is the automated version of QATT-001).
- **Corpus health.** Time-since-last-update per datasource; document count drift; indexing failure rate. Corpus rot is the silent killer of enterprise RAG systems; the dashboard needs to show it.
- **Alerting.** p95 latency regression, error-rate spikes, quota overage, retrieval-quality regression (a drop in cited-source clicks often precedes a wave of complaints).

### 8.5 Rollout controls

**Problem.** You cannot ship changes to a support chatbot the same way you ship changes to a batch job. Users are in the middle of real support conversations when you deploy.

**What to add.**

- **Feature flags.** Every new retrieval parameter, every system-prompt change, every model-routing decision behind a flag. Per-team, per-user, with percentage rollout. LaunchDarkly, Unleash, or the customer's in-house equivalent.
- **Canary rollout.** New versions go to 1% → 10% → 50% → 100% over hours or days. Automated rollback on error-rate or quality-metric regression.
- **Shadow mode for retrieval changes.** When changing how retrieval works (new top-k, new filter logic), run the new path in shadow alongside the old path, compare retrieval sets, and only promote when shadow-set agreement is above a threshold.
- **Kill switch.** One config change that bypasses Chat entirely and returns retrieved documents directly ("I can't generate an answer right now, but here are the top results"). Less elegant; never down.
- **Versioned prompts.** System prompts treated as code — versioned, reviewed, diff-able, rolled out behind flags. Prompt regressions are a leading cause of quality incidents.

### 8.6 A design → build → test → rollout plan

A pragmatic 10–12 week plan assuming a dedicated small team (1 architect + 2 engineers + part-time SRE and Glean SA).

**Weeks 1–2: Design.**
Capture the canvases from this design note for the real customer context: ASR for each team's use case, updated Context View with real systems, QATT cards with the customer's actual latency and accuracy targets, ADRs for deployment shape and auth approach. Validate with security, platform, and a pilot team. Produce a one-page reference architecture for the customer's enterprise architect.

**Weeks 3–6: Build (thin vertical slice first).**
- Week 3: FastAPI wrapper around `rag.py`; Redis-backed session store; OAuth token exchange.
- Week 4: Indexing pipeline for one pilot team's content, with real ACLs.
- Week 5: Observability — metrics, tracing, structured logs flowing to the customer's stack.
- Week 6: Rollout tooling — feature flags, canary deployment.

**Weeks 7–8: Test.**
- Functional tests against a gold set (~50 question/expected-answer pairs per team).
- Load testing to 2× expected peak.
- Permission-boundary tests — explicit "can user A see team B's content?" assertions.
- Security review, DPIA where applicable.
- Chaos: kill dependencies, verify graceful degradation.

**Weeks 9–10: Pilot rollout.**
- One team, opt-in users.
- Daily review of metrics and flagged responses.
- Weekly eval-set re-run.
- Tighten system prompts and retrieval parameters based on real usage.

**Weeks 11–12: Broader rollout.**
- Second and third teams onboarded.
- Runbook, training, and hand-off to the customer's ops team.
- Post-deployment roadmap — treating the deployed solution as a product, not a project.

### 8.7 Known limitations the prototype retains

- No per-user auth; the Client token represents the sandbox service identity.
- No conversation memory.
- No streaming.
- No evaluation harness.
- No PII detection or output policy layer.
- Local MCP surface only — no hosted deployment.

Each is addressed in one of the phases above. The point of the prototype is to prove the three APIs compose cleanly; the productionization work is the real engagement.

---

*These additions reference and extend: BTABoK ASR Card, Context View Card, QATT Card, ADR, Risk and Cost Card, and Stakeholder Engagement Map canvases as applied in the prior sections of this note.*
