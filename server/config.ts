/**
 * Configuration loading and validation.
 *
 * Fails loudly at startup if required environment variables are missing — better
 * than a cryptic error three API calls deep.
 *
 * Note on tokens (ADR-004): Glean deliberately separates indexing auth from
 * client auth. We model that separation here by accepting three tokens:
 *     - Indexing token   — privileged back-end write path.
 *     - Search token     — user-facing read path (optional; Client token also works).
 *     - Client token     — Chat + Search; represents an end-user-style identity.
 * This isn't pedantry — it matches how a customer would wire this up in prod,
 * where the indexing pipeline runs under a service identity and Chat/Search
 * run as the end user.
 */

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface Config {
  // --- Instance + datasource ---
  gleanInstance: string;          // e.g. "support-lab-be.glean.com"
  gleanDatasource: string;        // one of interviewds, interviewds2 ... interviewds6

  // --- Tokens (three distinct ones) ---
  gleanIndexingToken: string;     // Indexing API
  gleanClientToken: string;       // Chat + Search (Global scope)
  gleanSearchToken?: string;      // optional dedicated Search token

  // --- Behavior ---
  logLevel: string;
  defaultMaxSources: number;
  httpTimeoutS: number;
  retryMaxAttempts: number;

  // --- Server config ---
  port: number;
  corsOrigins: string[];
}

export class ConfiguredInstance {
  constructor(public readonly config: Config) {}

  get indexingBaseUrl(): string {
    return `https://${this.config.gleanInstance}/api/index/v1`;
  }

  get restBaseUrl(): string {
    return `https://${this.config.gleanInstance}/rest/api/v1`;
  }

  tokenForSearch(): string {
    return this.config.gleanSearchToken || this.config.gleanClientToken;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for the full list.`
    );
  }
  return value;
}

export function loadConfig(): ConfiguredInstance {
  const config: Config = {
    gleanInstance: process.env.GLEAN_INSTANCE || 'https://support-lab-be.glean.com',
    gleanDatasource: process.env.GLEAN_DATASOURCE || 'interviewds',
    gleanIndexingToken: requireEnv('GLEAN_INDEXING_TOKEN'),
    gleanClientToken: requireEnv('GLEAN_CLIENT_TOKEN'),
    gleanSearchToken: process.env.GLEAN_SEARCH_TOKEN || undefined,
    logLevel: process.env.LOG_LEVEL || 'INFO',
    defaultMaxSources: parseInt(process.env.DEFAULT_MAX_SOURCES || '5', 10),
    httpTimeoutS: parseFloat(process.env.HTTP_TIMEOUT_S || '30'),
    retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  };

  return new ConfiguredInstance(config);
}
