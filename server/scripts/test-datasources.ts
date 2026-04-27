/**
 * Datasource Availability Test
 *
 * Tests which datasources are available and properly configured for indexing.
 * Tries to index a minimal test document to each datasource to verify URL pattern acceptance.
 *
 * Run this to find which datasource you should use in .env
 */

import { createHash } from 'crypto';
import { loadConfig } from '../config.js';
import { IndexingClient } from '../glean-client.js';

function banner(msg: string): void {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`);
}

function stableId(prefix: string, content: string): string {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return `${prefix}:${hash.slice(0, 16)}`;
}

async function testDatasource(
  client: IndexingClient,
  datasource: string,
  instanceUrl: string
): Promise<{ success: boolean; error?: string }> {
  const testContent = `# Test Document\n\nThis is a test document for datasource configuration verification.`;
  const docId = stableId(datasource, testContent);

  // Try different URL patterns
  const urlPatterns = [
    {
      name: 'Glean instance URL',
      url: `https://${instanceUrl}/${datasource}/test-doc`,
    },
    {
      name: 'Glean instance with app path',
      url: `https://${instanceUrl}/app/document/${docId}`,
    },
    {
      name: 'Example.com URL',
      url: `https://${instanceUrl}/docs/${datasource}/test-doc`,
    },
  ];

  for (const pattern of urlPatterns) {
    const testDoc = {
      id: docId,
      title: 'Test Document - DELETE ME',
      datasource,
      viewURL: pattern.url,
      body: {
        mimeType: 'text/markdown',
        textContent: testContent,
      },
      permissions: {
        allowAnonymousAccess: true,
      },
    };

    try {
      console.log(`   Testing URL pattern: ${pattern.name}`);
      console.log(`   URL: ${pattern.url}`);

      await client.indexDocuments([testDoc]);

      console.log(`   ✅ SUCCESS! This datasource accepts this URL pattern.`);
      return { success: true };
    } catch (error: any) {
      if (error.status === 400 && error.body.includes('does not match the URL Regex pattern')) {
        console.log(`   ❌ URL pattern rejected`);
        continue; // Try next pattern
      } else {
        // Different error - might be auth, permissions, etc.
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }

  return {
    success: false,
    error: 'All URL patterns rejected. Datasource needs URL pattern configuration.'
  };
}

async function main(): Promise<void> {
  console.log('🔍 Testing Datasource Availability\n');
  console.log('This script tests which datasources are configured and ready to use.');
  console.log('It will try to index a minimal test document to each datasource.\n');

  const cfg = loadConfig();
  const client = new IndexingClient(cfg);

  // Datasources to test
  const datasourcesToTest = [
    'interviewds',
    'interviewds2',
    'interviewds3',
    'interviewds4',
    'interviewds5',
    'interviewds6',
  ];

  const results: { datasource: string; success: boolean; error?: string }[] = [];

  for (const datasource of datasourcesToTest) {
    banner(`Testing: ${datasource}`);

    const result = await testDatasource(client, datasource, cfg.config.gleanInstance);
    results.push({ datasource, ...result });

    if (result.success) {
      console.log(`\n   🎉 ${datasource} is AVAILABLE and configured!`);
    } else {
      console.log(`\n   ❌ ${datasource} is NOT available`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  banner('Summary');

  const available = results.filter(r => r.success);
  const unavailable = results.filter(r => !r.success);

  if (available.length > 0) {
    console.log('\n✅ AVAILABLE DATASOURCES (ready to use):');
    available.forEach(r => {
      console.log(`   • ${r.datasource}`);
    });

    console.log('\n📝 To use an available datasource, update your .env file:');
    console.log(`\n   GLEAN_DATASOURCE=${available[0].datasource}`);
    console.log('\nThen run: npm run index');
  } else {
    console.log('\n❌ NO AVAILABLE DATASOURCES FOUND');
    console.log('\nAll tested datasources require URL pattern configuration.');
  }

  if (unavailable.length > 0) {
    console.log('\n⚠️  UNAVAILABLE DATASOURCES (need configuration):');
    unavailable.forEach(r => {
      console.log(`   • ${r.datasource}`);
      if (r.error && !r.error.includes('URL pattern')) {
        console.log(`     Error: ${r.error}`);
      }
    });
  }

  console.log('\n💡 If no datasources are available:');
  console.log('   Contact your Glean administrator to configure URL patterns.');
  console.log('   See INDEXING_ISSUE.md for details.\n');

  // Exit with appropriate code
  process.exit(available.length > 0 ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
}

export { main };
