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

export interface BulkIndexOptions {
  /** Page size for chunking documents across /bulkindexdocuments calls. */
  pageSize?: number;
  /** Override the auto-generated uploadId (must be stable across pages). */
  uploadId?: string;
  /** Restart any prior interrupted upload with this uploadId. */
  forceRestartUpload?: boolean;
  /**
   * Skip the safety check that prevents the last-page deletion sweep when
   * the bulk set is suspiciously smaller than the live index.
   */
  disableStaleDocumentDeletionCheck?: boolean;
  /** Override the configured datasource for this upload. */
  datasource?: string;
}

export class IndexingClient extends BaseClient {
  constructor(cfg: ConfiguredInstance) {
    super(cfg, cfg.config.gleanIndexingToken, 'indexing');
  }

  /**
   * Upsert documents to the configured datasource via /indexdocuments.
   * Additive — documents missing from this call are NOT removed. Use
   * bulkIndexDocuments() for full-sync semantics.
   * Note: Indexing is asynchronous — documents may not be immediately
   * searchable after this call returns 200.
   */
  async indexDocuments(
    documents: any[],
    opts: { datasource?: string } = {}
  ): Promise<CallResult> {
    const url = `${this.cfg.indexingBaseUrl}/indexdocuments`;
    const payload = {
      datasource: opts.datasource ?? this.cfg.config.gleanDatasource,
      documents,
      // uploadId makes re-runs idempotent on Glean's side too.
      uploadId: `prototype-${Math.floor(Date.now() / 1000)}`,
    };

    return this.post(url, payload, 'index_documents');
  }

  /**
   * Full-sync upload via /bulkindexdocuments. Chunks documents into pages
   * sharing one uploadId, marking isFirstPage / isLastPage. When the last
   * page lands, Glean drops any documents in the datasource that weren't
   * part of this upload — the canonical "replace the source" flow.
   *
   * Returns the per-page CallResults in upload order.
   */
  async bulkIndexDocuments(
    documents: any[],
    opts: BulkIndexOptions = {}
  ): Promise<CallResult[]> {
    const url = `${this.cfg.indexingBaseUrl}/bulkindexdocuments`;
    const pageSize = opts.pageSize ?? 50;
    const uploadId = opts.uploadId ?? `bulk-${Math.floor(Date.now() / 1000)}`;

    if (documents.length === 0) {
      throw new Error('bulkIndexDocuments: documents must be non-empty');
    }

    const pages: any[][] = [];
    for (let i = 0; i < documents.length; i += pageSize) {
      pages.push(documents.slice(i, i + pageSize));
    }

    const results: CallResult[] = [];
    for (let i = 0; i < pages.length; i++) {
      const isFirstPage = i === 0;
      const isLastPage = i === pages.length - 1;
      const payload: any = {
        datasource: opts.datasource ?? this.cfg.config.gleanDatasource,
        documents: pages[i],
        uploadId,
        isFirstPage,
        isLastPage,
      };
      if (isFirstPage && opts.forceRestartUpload) {
        payload.forceRestartUpload = true;
      }
      if (isLastPage && opts.disableStaleDocumentDeletionCheck) {
        payload.disableStaleDocumentDeletionCheck = true;
      }

      this.log('info', 'bulk_index_page', {
        uploadId,
        page: i + 1,
        totalPages: pages.length,
        pageDocs: pages[i].length,
        isFirstPage,
        isLastPage,
      });

      results.push(await this.post(url, payload, 'bulk_index_documents'));
    }

    return results;
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
