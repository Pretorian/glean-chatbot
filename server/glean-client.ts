/**
 * Thin HTTP clients for the Glean APIs, split by trust domain.
 *
 * IndexingClient — uses the Indexing token; writes to the knowledge graph.
 * QueryClient    — uses the Client token; reads via Search and Chat.
 *
 * This split mirrors Glean's own token model (separate Indexing vs Client tokens)
 * and makes the auth boundary obvious in code. See ADR-004 in DESIGN_NOTE.md.
 *
 * Responsibilities:
 * - Attach auth headers per client.
 * - Retry on transient failures (429, 5xx, network) with exponential backoff.
 * - Emit structured logs with per-call latency and request IDs.
 * - Surface non-transient errors clearly.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { v4 as uuidv4 } from 'uuid';
import type { ConfiguredInstance } from './config.js';

export class GleanAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly requestId: string
  ) {
    super(`Glean API error ${status} (request_id=${requestId}): ${body.slice(0, 500)}`);
    this.name = 'GleanAPIError';
  }
}

export interface CallResult<T = any> {
  status: number;
  json: T;
  latencyMs: number;
  requestId: string;
}

class BaseClient {
  protected http: AxiosInstance;

  constructor(
    protected readonly cfg: ConfiguredInstance,
    token: string,
    protected readonly label: string
  ) {
    this.http = axios.create({
      timeout: cfg.config.httpTimeoutS * 1000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'glean-rag-node/1.0',
      },
    });

    // Configure retry logic for transient errors
    axiosRetry(this.http, {
      retries: cfg.config.retryMaxAttempts,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or 429/5xx
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          (error.response?.status !== undefined && error.response.status >= 500)
        );
      },
    });
  }

  protected async post<T = any>(
    url: string,
    payload: any,
    op: string
  ): Promise<CallResult<T>> {
    const requestId = uuidv4();
    const started = Date.now();

    try {
      const response = await this.http.post<T>(url, payload);
      const latencyMs = Date.now() - started;

      this.log('info', 'glean_api_call', {
        client: this.label,
        op,
        status: response.status,
        latencyMs,
        requestId,
      });

      return {
        status: response.status,
        json: response.data,
        latencyMs,
        requestId,
      };
    } catch (error) {
      const latencyMs = Date.now() - started;

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // HTTP error response
          this.log('error', 'glean_api_error', {
            client: this.label,
            op,
            status: error.response.status,
            latencyMs,
            requestId,
            error: error.message,
          });

          throw new GleanAPIError(
            error.response.status,
            JSON.stringify(error.response.data),
            requestId
          );
        } else {
          // Network error
          this.log('warning', 'glean_api_network_error', {
            client: this.label,
            op,
            url,
            requestId,
            error: error.message,
          });
          throw error;
        }
      }

      throw error;
    }
  }

  protected log(level: string, message: string, extra: Record<string, any>): void {
    const logData = { message, ...extra };
    console.log(`[${level.toUpperCase()}]`, JSON.stringify(logData));
  }
}

export class IndexingClient extends BaseClient {
  constructor(cfg: ConfiguredInstance) {
    super(cfg, cfg.config.gleanIndexingToken, 'indexing');
  }

  /**
   * Bulk upsert documents to the configured datasource.
   * Note: Indexing is asynchronous — documents may not be immediately
   * searchable after this call returns 200.
   */
  async indexDocuments(documents: any[]): Promise<CallResult> {
    const url = `${this.cfg.indexingBaseUrl}/indexdocuments`;
    const payload = {
      datasource: this.cfg.config.gleanDatasource,
      documents,
      // uploadId makes re-runs idempotent on Glean's side too.
      uploadId: `prototype-${Math.floor(Date.now() / 1000)}`,
    };

    return this.post(url, payload, 'index_documents');
  }
}

export class QueryClient extends BaseClient {
  constructor(cfg: ConfiguredInstance) {
    super(cfg, cfg.tokenForSearch(), 'query');
  }

  /**
   * Ranked retrieval for a natural-language query.
   */
  async search(
    query: string,
    pageSize: number = 5,
    datasource?: string
  ): Promise<CallResult> {
    const url = `${this.cfg.restBaseUrl}/search`;
    const payload: any = {
      query,
      pageSize,
    };

    if (datasource) {
      payload.requestOptions = {
        datasourcesFilter: [datasource],
      };
    }

    return this.post(url, payload, 'search');
  }

  /**
   * Get all indexed documents from a datasource.
   * Uses a broad search query to retrieve all available documents.
   */
  async getAllDocuments(datasource: string, maxResults: number = 100): Promise<CallResult> {
    const url = `${this.cfg.restBaseUrl}/search`;
    const payload: any = {
      query: '*', // Wildcard to match all documents
      pageSize: maxResults,
      requestOptions: {
        datasourcesFilter: [datasource],
      },
    };

    return this.post(url, payload, 'get_all_documents');
  }

  /**
   * Grounded generation. We pass retrieved documents as inline context.
   *
   * Note: Chat can also retrieve against the tenant's indexed content
   * on its own (ADR-001). We supply context explicitly here because the
   * exercise requires using all three APIs.
   */
  async chat(message: string, contextDocs: any[]): Promise<CallResult> {
    const url = `${this.cfg.restBaseUrl}/chat`;
    const payload = {
      messages: [
        {
          author: 'USER',
          messageType: 'CONTENT',
          fragments: [{ text: message }],
        },
      ],
      inlineDocs: contextDocs,
    };

    return this.post(url, payload, 'chat');
  }
}
