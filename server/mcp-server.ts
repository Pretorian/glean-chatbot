/**
 * MCP server exposing `ask_knowledge_base` as a single tool.
 *
 * Runs over stdio for local MCP clients (Cursor, Claude Desktop).
 *
 * Also supports a `--test` flag for interactive verification without an MCP client.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config.js';
import { QueryClient } from './glean-client.js';
import { answerQuestion } from './rag.js';

const TOOL_NAME = 'ask_knowledge_base';
const TOOL_DESCRIPTION =
  'Ask a natural-language question against the indexed Glean corpus and ' +
  'receive a grounded answer with source citations. Use this when the user ' +
  'needs information that might live in company documents, policies, runbooks, ' +
  'or other indexed knowledge.';

const TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: 'The natural-language question to answer.',
    },
    max_sources: {
      type: 'integer',
      description: 'Maximum number of sources to retrieve (default 5).',
      minimum: 1,
      maximum: 10,
    },
    datasource_filter: {
      type: 'string',
      description: 'Optional: restrict retrieval to a specific datasource.',
    },
  },
  required: ['question'],
};

function buildServer(client: QueryClient, defaultMaxSources: number): Server {
  const server = new Server(
    {
      name: 'glean-rag',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: TOOL_NAME,
          description: TOOL_DESCRIPTION,
          inputSchema: TOOL_INPUT_SCHEMA,
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const requestId = uuidv4();
    const question = (request.params.arguments?.question as string || '').trim();

    if (!question) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'question is required' }),
          },
        ],
      };
    }

    const maxSources = parseInt(
      (request.params.arguments?.max_sources as string) || String(defaultMaxSources),
      10
    );
    const datasourceFilter = request.params.arguments?.datasource_filter as string | undefined;

    console.log(
      JSON.stringify({
        message: 'mcp_tool_invoked',
        requestId,
        tool: TOOL_NAME,
        maxSources,
      })
    );

    try {
      const result = await answerQuestion(client, question, {
        maxSources,
        datasourceFilter,
        requestId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'mcp_tool_error',
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              requestId,
            }),
          },
        ],
      };
    }
  });

  return server;
}

async function runStdio(): Promise<void> {
  const cfg = loadConfig();
  const client = new QueryClient(cfg);
  const server = buildServer(client, cfg.config.defaultMaxSources);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Glean RAG MCP server running on stdio');
}

async function runTest(question: string): Promise<void> {
  const cfg = loadConfig();
  const client = new QueryClient(cfg);

  const result = await answerQuestion(client, question, {
    maxSources: cfg.config.defaultMaxSources,
    requestId: uuidv4(),
  });

  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const testIndex = args.indexOf('--test');

  if (testIndex !== -1 && args[testIndex + 1]) {
    await runTest(args[testIndex + 1]);
  } else {
    await runStdio();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('MCP server failed:', error);
    process.exit(1);
  });
}

export { buildServer, runStdio, runTest };
