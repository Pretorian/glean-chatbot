import type { GroundedAnswer } from './types';

const API_BASE_URL = '/api';

export async function askQuestion(
  question: string,
  maxSources?: number,
  datasourceFilter?: string
): Promise<GroundedAnswer> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      maxSources,
      datasourceFilter,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch('/health');
  return response.json();
}
