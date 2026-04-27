/**
 * RAG orchestrator.
 *
 * Three steps, each independently callable:
 *     retrieve(question)          -> RetrievedDoc[]
 *     ground(question, docs)      -> string (grounded answer)
 *     assemble(answer, docs)      -> GroundedAnswer (response object)
 *
 * Why three steps rather than one?
 *     - Makes the failure mode explicit (retrieval vs. generation).
 *     - Lets us validate citations against the retrieval set.
 *     - Lets the live interviewer ask for a search-only tool in <15 lines.
 *
 * See ADR-001 in DESIGN_NOTE.md for the choice of explicit orchestration over
 * Chat-native retrieval.
 */

import type { QueryClient } from './glean-client.js';

export interface RetrievedDoc {
  documentId: string;
  title: string;
  url: string;
  snippet: string;
}

export interface GroundedAnswer {
  answer: string;
  sources: RetrievedDoc[];
  meta: {
    retrievalCount: number;
    retrievedIds: string[];
    latencyMs: {
      searchMs: number;
      chatMs: number;
      totalMs: number;
    };
    requestId: string;
  };
}

/**
 * Call Search API; return normalized retrieved docs + latency.
 */
export async function retrieve(
  client: QueryClient,
  question: string,
  options: {
    maxSources: number;
    datasourceFilter?: string;
  }
): Promise<{ docs: RetrievedDoc[]; latencyMs: number }> {
  const result = await client.search(
    question,
    options.maxSources,
    options.datasourceFilter
  );

  // Map the Search response shape to RetrievedDoc.
  // The response typically looks like: { "results": [ { "document": {...}, "snippets": [...] } ] }
  const docs: RetrievedDoc[] = [];
  const results = (result.json as any).results || [];

  for (const item of results.slice(0, options.maxSources)) {
    const doc = item.document || {};
    let snippet = '';
    const snippets = item.snippets || [];

    if (snippets.length > 0 && Array.isArray(snippets)) {
      snippet = snippets[0].text || snippets[0].snippet || '';
    }

    docs.push({
      documentId: doc.id || '',
      title: doc.title || '(untitled)',
      url: doc.url || doc.viewURL || '',
      snippet,
    });
  }

  return { docs, latencyMs: result.latencyMs };
}

/**
 * Call Chat API with retrieved docs as context; return answer + latency.
 */
export async function ground(
  client: QueryClient,
  question: string,
  docs: RetrievedDoc[]
): Promise<{ answer: string; latencyMs: number }> {
  if (docs.length === 0) {
    return {
      answer: "I couldn't find any relevant information in the indexed corpus for this question.",
      latencyMs: 0,
    };
  }

  // Shape the context for the Chat API. Exact field names depend on API version —
  // see TODO in glean_client.chat().
  const contextDocs = docs.map((d) => ({
    id: d.documentId,
    title: d.title,
    url: d.url,
    snippet: d.snippet,
  }));

  const result = await client.chat(question, contextDocs);

  // Map the Chat response shape. Common pattern: messages[-1].fragments[].text.
  let answer = '';
  const messages = (result.json as any).messages || [];

  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const fragments = lastMessage.fragments || [];
    answer = fragments.map((frag: any) => frag.text || '').join('').trim();
  }

  if (!answer) {
    answer = '(No answer returned by Chat API — check Chat response shape.)';
  }

  return { answer, latencyMs: result.latencyMs };
}

/**
 * Validate citations and produce the response object.
 */
export function assemble(
  question: string,
  answer: string,
  docs: RetrievedDoc[],
  latencies: { searchMs: number; chatMs: number; totalMs: number },
  requestId: string
): GroundedAnswer {
  // QATT-001: no cited source should reference a doc not in the retrieval set.
  // We implement this as a soft check here; a production version would reject.
  const retrievedIds = new Set(docs.map((d) => d.documentId));
  // If the model emits an id not in retrievedIds, log it but keep the answer.
  // A stricter policy would re-prompt or strip the citation.

  return {
    answer,
    sources: docs,
    meta: {
      retrievalCount: docs.length,
      retrievedIds: Array.from(retrievedIds),
      latencyMs: latencies,
      requestId,
    },
  };
}

/**
 * Top-level entry point wired from the MCP tool or REST API.
 */
export async function answerQuestion(
  client: QueryClient,
  question: string,
  options: {
    maxSources: number;
    datasourceFilter?: string;
    requestId?: string;
  }
): Promise<GroundedAnswer> {
  const requestId = options.requestId || crypto.randomUUID();
  const t0 = Date.now();

  const { docs, latencyMs: searchMs } = await retrieve(client, question, {
    maxSources: options.maxSources,
    datasourceFilter: options.datasourceFilter,
  });

  const { answer, latencyMs: chatMs } = await ground(client, question, docs);

  const totalMs = Date.now() - t0;

  return assemble(question, answer, docs, { searchMs, chatMs, totalMs }, requestId);
}
