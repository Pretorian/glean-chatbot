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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RetrievedDoc[];
  meta?: GroundedAnswer['meta'];
  timestamp: Date;
}
