import fetch from 'node-fetch';

const PYTHON_SERVICE_URL = process.env.PYTHON_MATCH_SERVICE_URL || 'http://localhost:8001';

interface PythonMatchResponse {
  matches: any[];
  totalMatches: number;
  message?: string;
}

export async function getPythonMatches(userId: string): Promise<PythonMatchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/matches/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Python service returned ${response.status}`);
    }

    return await response.json() as PythonMatchResponse;
  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Python matching service error:', error);
    throw error;
  }
}

export async function isPythonServiceHealthy(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
