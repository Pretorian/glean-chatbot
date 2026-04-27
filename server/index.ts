/**
 * Express REST API server for Glean RAG chatbot.
 *
 * Provides HTTP endpoints as an alternative to the MCP stdio interface,
 * making the service accessible to web clients (React frontend).
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config.js';
import { QueryClient } from './glean-client.js';
import { answerQuestion } from './rag.js';

const cfg = loadConfig();
const app = express();
const client = new QueryClient(cfg);

// Middleware
app.use(cors({
  origin: cfg.config.corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main RAG endpoint
interface AskRequest {
  question: string;
  maxSources?: number;
  datasourceFilter?: string;
}

app.post('/api/ask', async (req: Request<{}, {}, AskRequest>, res: Response) => {
  try {
    const { question, maxSources, datasourceFilter } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        error: 'question is required and must be a non-empty string',
      });
    }

    const requestId = uuidv4();
    const maxSourcesValue = maxSources || cfg.config.defaultMaxSources;

    console.log(
      JSON.stringify({
        message: 'api_request',
        requestId,
        endpoint: '/api/ask',
        maxSources: maxSourcesValue,
      })
    );

    const result = await answerQuestion(client, question.trim(), {
      maxSources: maxSourcesValue,
      datasourceFilter,
      requestId,
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId: uuidv4(),
    });
  }
});

// Search-only endpoint (for simplified retrieval without generation)
app.post('/api/search', async (req: Request, res: Response) => {
  try {
    const { query, maxResults = 5, datasourceFilter } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        error: 'query is required and must be a non-empty string',
      });
    }

    const requestId = uuidv4();

    const result = await client.search(
      query.trim(),
      maxResults,
      datasourceFilter
    );

    res.json({
      results: result.json,
      meta: {
        latencyMs: result.latencyMs,
        requestId,
      },
    });
  } catch (error) {
    console.error('Error processing search:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId: uuidv4(),
    });
  }
});

// Config info endpoint (for debugging)
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    instance: cfg.config.gleanInstance,
    datasource: cfg.config.gleanDatasource,
    defaultMaxSources: cfg.config.defaultMaxSources,
  });
});

// Start server
const PORT = cfg.config.port;

app.listen(PORT, () => {
  console.log(`\n🚀 Glean RAG API server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Ask endpoint: POST http://localhost:${PORT}/api/ask`);
  console.log(`   Search endpoint: POST http://localhost:${PORT}/api/search`);
  console.log(`\n   Instance: ${cfg.config.gleanInstance}`);
  console.log(`   Datasource: ${cfg.config.gleanDatasource}\n`);
});

export default app;
