/**
 * Matching Service Client
 * 
 * HTTP client for communicating with Python FastAPI matching service.
 * Handles embedding generation and match finding.
 */

const MATCHING_SERVICE_URL = process.env.MATCHING_SERVICE_URL || 'http://localhost:8001';
const TIMEOUT_MS = 10000; // 10 seconds

interface MatchRequest {
    user_id: string;
    skills_have: string[];
    skills_want: string[];
    limit?: number;
    min_score?: number;
}

interface MatchResponse {
    matches: Array<{
        user_id: string;
        match_score: number;
        matched_have: string[];
        matched_want: string[];
        semantic_matches: string[];
        confidence: string;
    }>;
    total: number;
    cached: boolean;
    processing_time_ms: number;
}

interface EmbeddingRequest {
    skills: string[];
}

interface EmbeddingResponse {
    embeddings: number[][];
    dimensions: number;
    model: string;
}

/**
 * Check if matching service is available
 */
export async function isMatchingServiceAvailable(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${MATCHING_SERVICE_URL}/health`, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Find matches using Python matching service
 */
export async function findMatchesFromService(
    userId: string,
    skillsHave: string[],
    skillsWant: string[]
): Promise<MatchResponse | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${MATCHING_SERVICE_URL}/api/v1/matches/find`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                skills_have: skillsHave,
                skills_want: skillsWant,
                limit: 50,
                min_score: 30,
            } as MatchRequest),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[MatchingClient] Service error: ${response.status}`);
            return null;
        }

        return await response.json() as MatchResponse;
    } catch (error) {
        console.error('[MatchingClient] Request failed:', error);
        return null;
    }
}

/**
 * Generate embeddings using Python service
 */
export async function generateEmbeddings(skills: string[]): Promise<number[][] | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${MATCHING_SERVICE_URL}/api/v1/embeddings/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills } as EmbeddingRequest),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[MatchingClient] Embedding error: ${response.status}`);
            return null;
        }

        const data = await response.json() as EmbeddingResponse;
        return data.embeddings;
    } catch (error) {
        console.error('[MatchingClient] Embedding request failed:', error);
        return null;
    }
}

/**
 * Store embeddings in database via Python service
 */
export async function storeEmbeddings(skills: string[]): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${MATCHING_SERVICE_URL}/api/v1/embeddings/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('[MatchingClient] Store embeddings failed:', error);
        return false;
    }
}
