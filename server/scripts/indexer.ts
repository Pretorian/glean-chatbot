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
import { join, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig } from '../config.js';
import { IndexingClient } from '../glean-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORPUS_DIR = resolve(__dirname, '../../corpus');
const SUPPORTED_EXTENSIONS = ['.md', '.txt'];
const MIME_BY_EXT: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
};

function stableId(prefix: string, content: string): string {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return `${prefix}:${hash.slice(0, 16)}`;
}

function buildDocument(filePath: string, datasource: string, instanceUrl: string): any {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();
  const stem = basename(filePath, ext);

  // First non-empty line as title, falling back to filename.
  const lines = content.split('\n');
  const title = lines.find((line) => line.trim())?.replace(/^#\s*/, '').trim() || stem;

  const docId = stableId(datasource, content);
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // The exact schema depends on the Indexing API version — confirm against
  // sandbox docs. This shape matches the common Glean custom-datasource schema.
  // NOTE: viewURL must match the datasource's configured URL pattern.
  // Pattern for interviewds: https://internal.example.com/policies/.*
  return {
    id: docId,
    title,
    datasource,
    viewURL: `https://internal.example.com/policies/${slug}`,
    body: {
      mimeType: MIME_BY_EXT[ext] ?? 'text/plain',
      textContent: content,
    },
    permissions: {
      // Prototype: world-readable within the sandbox tenant.
      // Production: real ACLs derived from the source system.
      allowAnonymousAccess: true,
    },
  };
}

function parseFlags(argv: string[]): { bulk: boolean; pageSize?: number; forceRestart: boolean } {
  let bulk = false;
  let pageSize: number | undefined;
  let forceRestart = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bulk') bulk = true;
    else if (a === '--force-restart') forceRestart = true;
    else if (a === '--page-size') pageSize = parseInt(argv[++i], 10);
    else if (a.startsWith('--page-size=')) pageSize = parseInt(a.split('=')[1], 10);
  }
  return { bulk, pageSize, forceRestart };
}

async function run(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const cfg = loadConfig();
  const client = new IndexingClient(cfg);

  if (!existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory not found: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(CORPUS_DIR)
    .filter((file) => SUPPORTED_EXTENSIONS.includes(extname(file).toLowerCase()))
    .map((file) => join(CORPUS_DIR, file))
    .sort();

  if (files.length === 0) {
    console.error(
      `No ${SUPPORTED_EXTENSIONS.join('/')} files in ${CORPUS_DIR}`
    );
    process.exit(1);
  }

  const documents = files.map((filePath) =>
    buildDocument(filePath, cfg.config.gleanDatasource, cfg.config.gleanInstance)
  );

  const mode = flags.bulk ? 'bulk' : 'upsert';
  console.log(
    JSON.stringify({
      message: 'indexing_start',
      mode,
      count: documents.length,
      datasource: cfg.config.gleanDatasource,
    })
  );

  if (flags.bulk) {
    const results = await client.bulkIndexDocuments(documents, {
      pageSize: flags.pageSize,
      forceRestartUpload: flags.forceRestart,
    });
    const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);
    console.log(
      JSON.stringify({
        message: 'indexing_complete',
        mode,
        count: documents.length,
        pages: results.length,
        totalLatencyMs: totalLatency,
        lastRequestId: results[results.length - 1].requestId,
      })
    );
    console.log(
      `\nBulk-indexed ${documents.length} documents into ${cfg.config.gleanDatasource} ` +
        `across ${results.length} page(s).`
    );
    return;
  }

  // Batch if the API requires it; for ~20 docs a single call is fine.
  const result = await client.indexDocuments(documents);

  console.log(
    JSON.stringify({
      message: 'indexing_complete',
      mode,
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
