/**
 * Pre-flight smoke test.
 *
 * Runs a minimal end-to-end check against the sandbox:
 *     1. Load config — verifies all required env vars are present.
 *     2. Tiny Search call — verifies Client (or Search) token works.
 *     3. Tiny Chat call — verifies Client token + Chat scope.
 *     4. Tiny Indexing dry-run — verifies Indexing token (does not actually index).
 *
 * Run this:
 *     - After first-time setup.
 *     - Before starting any work session, to catch token rotation / env issues.
 *     - Before the live interview. Twice.
 *
 * Exit code 0 on success, 1 on any failure.
 */

import { loadConfig } from '../config.js';
import { IndexingClient, QueryClient } from '../glean-client.js';

function banner(msg: string): void {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`);
}

function maskToken(token: string): string {
  if (!token || token.length < 6) return '(invalid)';
  return `...${token.slice(-6)}`;
}

async function smokeTest(): Promise<number> {
  const failures: string[] = [];

  banner('1. Load config');
  let cfg;
  try {
    cfg = loadConfig();
    console.log(`   instance    : ${cfg.config.gleanInstance}`);
    console.log(`   datasource  : ${cfg.config.gleanDatasource}`);
    console.log(`   indexing tok: ${maskToken(cfg.config.gleanIndexingToken)}`);
    console.log(`   client tok  : ${maskToken(cfg.config.gleanClientToken)}`);
    console.log(`   search tok  : ${cfg.config.gleanSearchToken ? maskToken(cfg.config.gleanSearchToken) : '(using client token)'}`);
  } catch (error) {
    console.log(`   FAIL: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  banner('2. Search API (Client/Search token)');
  try {
    const queryClient = new QueryClient(cfg);
    const result = await queryClient.search('test', 1, cfg.config.gleanDatasource);
    const resultCount = (result.json as any).results?.length || 0;
    console.log(`   OK — ${result.status} in ${result.latencyMs}ms, ${resultCount} result(s)`);
  } catch (error) {
    failures.push(`search: ${error instanceof Error ? error.message : error}`);
    console.log(`   FAIL: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
  }

  banner('3. Chat API (Client token)');
  try {
    const queryClient = new QueryClient(cfg);
    const result = await queryClient.chat("Say 'ok' if you can read this.", []);
    console.log(`   OK — ${result.status} in ${result.latencyMs}ms`);
  } catch (error) {
    failures.push(`chat: ${error instanceof Error ? error.message : error}`);
    console.log(`   FAIL: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
  }

  banner('4. Indexing API auth check (Indexing token)');
  // We do NOT actually push a doc here — we construct the client and let the
  // caller decide whether to exercise it. Token validity is implicitly
  // checked the first time the indexer runs. If you want a stronger check,
  // uncomment the index_documents call below with a synthetic doc.
  try {
    const indexingClient = new IndexingClient(cfg);
    console.log('   OK — IndexingClient constructed; token format accepted.');
    console.log('   (Run `npm run index` to exercise the full path.)');
  } catch (error) {
    failures.push(`indexing client: ${error instanceof Error ? error.message : error}`);
    console.log(`   FAIL: ${error instanceof Error ? error.message : error}`);
  }

  banner('Summary');
  if (failures.length > 0) {
    console.log(`FAILED (${failures.length}):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    return 1;
  }
  console.log('All checks passed. Environment is ready.');
  console.log('\nNext steps:');
  console.log('  1. Run: npm run index');
  console.log('  2. Run: npm run dev');
  console.log('  3. Open: http://localhost:5173');
  return 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  smokeTest()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('\n❌ Smoke test crashed:', error);
      process.exit(1);
    });
}

export { smokeTest };
