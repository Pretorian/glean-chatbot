/**
 * One-time / scheduled corpus indexer.
 *
 * Reads markdown files from ./corpus, derives stable IDs via content hash,
 * and upserts them to the sandbox datasource via the Indexing API.
 *
 * Idempotent: re-running does not create duplicates.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig } from '../config.js';
import { IndexingClient } from '../glean-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORPUS_DIR = resolve(__dirname, '../../corpus');

function stableId(prefix: string, content: string): string {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return `${prefix}:${hash.slice(0, 16)}`;
}

function buildDocument(filePath: string, datasource: string, instanceUrl: string): any {
  const content = readFileSync(filePath, 'utf-8');

  // First non-empty line as title, falling back to filename.
  const lines = content.split('\n');
  const title = lines.find((line) => line.trim())?.replace(/^#\s*/, '').trim() ||
                basename(filePath, '.md');

  const docId = stableId(datasource, content);
  const filename = basename(filePath, '.md');

  // The exact schema depends on the Indexing API version — confirm against
  // sandbox docs. This shape matches the common Glean custom-datasource schema.
  // NOTE: viewURL must match the datasource's configured URL pattern.
  // Pattern for interviewds: https://internal.example.com/policies/.*
  return {
    id: docId,
    title,
    datasource,
    viewURL: `https://internal.example.com/policies/${filename}`,
    body: {
      mimeType: 'text/markdown',
      textContent: content,
    },
    permissions: {
      // Prototype: world-readable within the sandbox tenant.
      // Production: real ACLs derived from the source system.
      allowAnonymousAccess: true,
    },
  };
}

async function run(): Promise<void> {
  const cfg = loadConfig();
  const client = new IndexingClient(cfg);

  if (!existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(CORPUS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => join(CORPUS_DIR, file))
    .sort();

  if (files.length === 0) {
    console.error(`No markdown files in ${CORPUS_DIR}`);
    process.exit(1);
  }

  const documents = files.map((filePath) =>
    buildDocument(filePath, cfg.config.gleanDatasource, cfg.config.gleanInstance)
  );

  console.log(
    JSON.stringify({
      message: 'indexing_start',
      count: documents.length,
      datasource: cfg.config.gleanDatasource,
    })
  );

  // Batch if the API requires it; for ~20 docs a single call is fine.
  const result = await client.indexDocuments(documents);

  console.log(
    JSON.stringify({
      message: 'indexing_complete',
      count: documents.length,
      requestId: result.requestId,
      latencyMs: result.latencyMs,
    })
  );

  console.log(`\nIndexed ${documents.length} documents into ${cfg.config.gleanDatasource}.`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error('Indexing failed:', error);
    process.exit(1);
  });
}

export { run };
