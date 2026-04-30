/**
 * CLI Dashboard for Glean Indexing Status
 *
 * Shows:
 * - Local corpus files and their indexing status
 * - All documents indexed in the Glean datasource
 * - Clear distinction between local vs remote documents
 * - Overall indexing progress
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig } from '../config.js';
import { QueryClient } from '../glean-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORPUS_DIR = resolve(__dirname, '../../corpus');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

function stableId(prefix: string, content: string): string {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return `${prefix}:${hash.slice(0, 16)}`;
}

interface LocalDocument {
  filename: string;
  title: string;
  docId: string;
  size: number;
  indexed: boolean;
}

interface RemoteDocument {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

function printHeader(): void {
  console.log('\n' + colors.bright + colors.cyan + '╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         GLEAN INDEXING DASHBOARD                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝' + colors.reset);
}

function printSection(title: string): void {
  console.log('\n' + colors.bright + colors.blue + '━━━ ' + title + ' ' + '━'.repeat(Math.max(0, 63 - title.length)) + colors.reset);
}

function printProgress(current: number, total: number, label: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  console.log(
    `${colors.cyan}${label}${colors.reset} [${colors.green}${bar}${colors.reset}] ${colors.bright}${current}/${total}${colors.reset} (${percentage}%)`
  );
}

async function getLocalCorpusDocuments(datasource: string): Promise<LocalDocument[]> {
  if (!existsSync(CORPUS_DIR)) {
    return [];
  }

  const files = readdirSync(CORPUS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort();

  return files.map((filename) => {
    const filePath = join(CORPUS_DIR, filename);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const title =
      lines.find((line) => line.trim())?.replace(/^#\s*/, '').trim() ||
      basename(filename, '.md');

    const docId = stableId(datasource, content);
    const stats = statSync(filePath);

    return {
      filename,
      title,
      docId,
      size: stats.size,
      indexed: false,
    };
  });
}

async function getRemoteIndexedDocuments(
  client: QueryClient,
  datasource: string
): Promise<RemoteDocument[]> {
  try {
    const result = await client.getAllDocuments(datasource, 100);
    const results = (result.json as any).results || [];

    return results.map((r: any) => ({
      id: r.id || 'unknown',
      title: r.title || 'Untitled',
      url: r.url,
      snippet: r.snippet?.text || r.bodyText,
    }));
  } catch (error) {
    console.error(
      `${colors.red}Error fetching remote documents:${colors.reset}`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function run(): Promise<void> {
  const cfg = loadConfig();
  const client = new QueryClient(cfg);

  printHeader();

  // Display configuration
  printSection('Configuration');
  console.log(`${colors.gray}Instance:${colors.reset}   ${colors.bright}${cfg.config.gleanInstance}${colors.reset}`);
  console.log(`${colors.gray}Datasource:${colors.reset} ${colors.bright}${cfg.config.gleanDatasource}${colors.reset}`);
  console.log(`${colors.gray}Corpus Dir:${colors.reset} ${colors.dim}${CORPUS_DIR}${colors.reset}`);

  // Get local corpus documents
  printSection('📁 Local Corpus Files');
  const localDocs = await getLocalCorpusDocuments(cfg.config.gleanDatasource);

  if (localDocs.length === 0) {
    console.log(colors.yellow + '\n⚠ No markdown files found in local corpus directory' + colors.reset);
  } else {
    console.log(`\nFound ${colors.bright}${localDocs.length}${colors.reset} document(s) in local corpus:\n`);

    localDocs.forEach((doc, index) => {
      const fileSize = doc.size < 1024 ? `${doc.size}B` : `${(doc.size / 1024).toFixed(1)}KB`;
      console.log(`  ${colors.dim}${index + 1}.${colors.reset} ${colors.bright}${doc.filename}${colors.reset} ${colors.gray}(${fileSize})${colors.reset}`);
      console.log(`     ${colors.dim}Title:${colors.reset} ${doc.title}`);
      console.log(`     ${colors.dim}ID:${colors.reset}    ${colors.gray}${doc.docId}${colors.reset}`);
    });
  }

  // Get remote indexed documents
  printSection('☁️  Remote Indexed Documents (in Glean)');
  console.log('\nQuerying Glean for all indexed documents...\n');

  const remoteDocs = await getRemoteIndexedDocuments(client, cfg.config.gleanDatasource);

  if (remoteDocs.length === 0) {
    console.log(colors.yellow + '⚠ No documents found in Glean datasource' + colors.reset);
  } else {
    console.log(`Found ${colors.bright}${remoteDocs.length}${colors.reset} document(s) indexed in Glean:\n`);

    remoteDocs.forEach((doc, index) => {
      console.log(`  ${colors.dim}${index + 1}.${colors.reset} ${colors.bright}${doc.title}${colors.reset}`);
      console.log(`     ${colors.dim}ID:${colors.reset}  ${colors.gray}${doc.id}${colors.reset}`);
      if (doc.url) {
        console.log(`     ${colors.dim}URL:${colors.reset} ${colors.cyan}${doc.url}${colors.reset}`);
      }
    });
  }

  // Cross-reference: which local files are indexed?
  if (localDocs.length > 0 && remoteDocs.length > 0) {
    printSection('🔍 Verifying Local Files in Remote Index');
    console.log('\nChecking which local corpus files are indexed in Glean...\n');

    const remoteIds = new Set(remoteDocs.map((d) => d.id));
    const remoteTitles = new Set(remoteDocs.map((d) => d.title.toLowerCase()));

    for (const doc of localDocs) {
      const foundById = remoteIds.has(doc.docId);
      const foundByTitle = remoteTitles.has(doc.title.toLowerCase());
      doc.indexed = foundById || foundByTitle;

      const status = doc.indexed
        ? `${colors.green}✓ Indexed${colors.reset}`
        : `${colors.yellow}⚠ NOT indexed${colors.reset}`;

      console.log(`  ${status}  ${colors.bright}${doc.filename}${colors.reset}`);
    }
  }

  // Identify remote-only documents (not in local corpus)
  if (localDocs.length > 0 && remoteDocs.length > 0) {
    printSection('🌐 Remote-Only Documents (not in local corpus)');

    const localIds = new Set(localDocs.map((d) => d.docId));
    const localTitles = new Set(localDocs.map((d) => d.title.toLowerCase()));

    const remoteOnly = remoteDocs.filter((doc) => {
      const inLocalById = localIds.has(doc.id);
      const inLocalByTitle = localTitles.has(doc.title.toLowerCase());
      return !inLocalById && !inLocalByTitle;
    });

    if (remoteOnly.length === 0) {
      console.log(`\n${colors.green}✓ All remote documents exist in local corpus${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}Found ${remoteOnly.length} document(s) in Glean that are NOT in local corpus:${colors.reset}\n`);

      remoteOnly.forEach((doc, index) => {
        console.log(`  ${colors.dim}${index + 1}.${colors.reset} ${colors.magenta}${doc.title}${colors.reset}`);
        console.log(`     ${colors.dim}ID:${colors.reset}  ${colors.gray}${doc.id}${colors.reset}`);
        if (doc.url) {
          console.log(`     ${colors.dim}URL:${colors.reset} ${colors.cyan}${doc.url}${colors.reset}`);
        }
      });
      console.log(`\n${colors.yellow}⚠ These documents may have been indexed separately or from another source.${colors.reset}`);
    }
  }

  // Summary
  printSection('📊 Summary');
  console.log();

  const localIndexed = localDocs.filter((d) => d.indexed).length;
  const localTotal = localDocs.length;
  const remoteTotal = remoteDocs.length;

  console.log(`${colors.bright}Local Corpus:${colors.reset}`);
  if (localTotal > 0) {
    printProgress(localIndexed, localTotal, '  Files Indexed  ');
  } else {
    console.log(`  ${colors.dim}No local files${colors.reset}`);
  }

  console.log();
  console.log(`${colors.bright}Remote Datasource:${colors.reset}`);
  console.log(`  Total Documents: ${colors.bright}${remoteTotal}${colors.reset}`);

  console.log();

  if (localTotal > 0) {
    if (localIndexed === localTotal) {
      console.log(colors.green + '✓ All local corpus files are indexed in Glean!' + colors.reset);
    } else if (localIndexed === 0) {
      console.log(colors.yellow + '⚠ No local corpus files are indexed. Run: npm run index' + colors.reset);
    } else {
      console.log(colors.yellow + `⚠ ${localTotal - localIndexed} local file(s) not indexed. Run: npm run index` + colors.reset);
    }
  }

  // Available documents for search & chat
  if (remoteDocs.length > 0) {
    printSection('✅ Available for Search & Chat');
    console.log(`\nAll ${colors.bright}${remoteDocs.length}${colors.reset} remote documents are available:\n`);

    remoteDocs.forEach((doc) => {
      const isLocal = localDocs.some(
        (ld) => ld.docId === doc.id || ld.title.toLowerCase() === doc.title.toLowerCase()
      );
      const badge = isLocal
        ? `${colors.green}[LOCAL]${colors.reset}`
        : `${colors.magenta}[REMOTE]${colors.reset}`;

      console.log(`  ${colors.green}✓${colors.reset} ${badge} ${colors.bright}${doc.title}${colors.reset}`);
    });
  }

  console.log('\n' + colors.dim + '─'.repeat(70) + colors.reset);
  console.log(colors.gray + 'Tip: Run "npm run index" to index/update local corpus files' + colors.reset);
  console.log(colors.gray + 'Tip: Run "npm run dashboard" anytime to check status' + colors.reset);
  console.log();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(colors.red + '\n❌ Dashboard error:' + colors.reset, error);
    process.exit(1);
  });
}

export { run };
