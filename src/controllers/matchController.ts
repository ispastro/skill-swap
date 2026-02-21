import { Request, Response } from 'express';
import prisma from '../config/db.js';
import redis from '../config/redisClient.js';
import { normalizeSkillName, normalizeSkillList } from '../utils/skillTaxonomy.js';
import { suggestSkills } from '../utils/suggestSkills.js';
import { findSimilarSkills, ensureSkillEmbeddings } from '../services/embeddingService.js';
import { storeEmbeddings } from '../services/matchingClient.js';
import { getPythonMatches, isPythonServiceHealthy } from '../services/pythonMatchService.js';
import Fuse from 'fuse.js';

// Feature flag: Use Python matching service if available
const USE_PYTHON_SERVICE = process.env.USE_PYTHON_MATCHING !== 'false';

// ─── Types ─────────────────────────────────────────────────────

interface UserWithSkills {
    id: string;
    name: string;
    bio?: string | null;
    skillsHave: string[];
    skillsWant: string[];
    normalizedSkillsHave: string[];
    normalizedSkillsWant: string[];
}

interface MatchResult {
    matchScore: number;
    matchedHave: string[];
    matchedWant: string[];
    semanticMatches: string[];
    matchConfidence: string;
}

interface EnrichedMatch extends MatchResult {
    id: string;
    name: string;
    bio: string | null;
    skillsHave: string[];
    skillsWant: string[];
}

// ─── Helpers ───────────────────────────────────────────────────

function extractYearsOfExperience(bio: string | null): number {
    if (!bio) return 0;
    const match = bio.match(/(\d+)\s*(?:years?|yrs?)/i);
    return match ? parseInt(match[1], 10) : 0;
}

function getConfidenceLabel(score: number): string {
    if (score >= 80) return 'Strong Match';
    if (score >= 50) return 'Good Match';
    if (score >= 30) return 'Moderate Match';
    return 'Light Match';
}

/**
 * Fuzzy match skills using Fuse.js with a pre-built index.
 * Returns skills from `targetSkills` that loosely match `querySkills`.
 */
function fuzzyMatchSkills(querySkills: string[], targetSkills: string[]): string[] {
    if (!querySkills.length || !targetSkills.length) return [];
    const fuse = new Fuse(targetSkills, { threshold: 0.4 });
    const matched = new Set<string>();
    for (const skill of querySkills) {
        const results = fuse.search(skill);
        if (results.length > 0) matched.add(results[0].item);
    }
    return [...matched];
}

// ─── Skill Normalization (exported for profileController) ──────

export async function normalizeSkills(skills: string[]): Promise<string[]> {
    return normalizeSkillList(skills);
}

// ─── Core Match Scoring ────────────────────────────────────────

/**
 * Calculate match score between two users.
 * 
 * Scoring weights:
 *   50% — Overlap score (how many of my wants match their haves)
 *   30% — Mutual benefit (how many of their wants match my haves)
 *   10% — Semantic similarity bonus (pgvector cosine distance)
 *    5% — Fuzzy match bonus (handles typos via Fuse.js)
 *    5% — Experience boost (years extracted from bio)
 */
export async function calculateWeightedMatchScore(
    userA: UserWithSkills,
    userB: UserWithSkills
): Promise<MatchResult> {
    const myWant = userA.normalizedSkillsWant.length > 0
        ? userA.normalizedSkillsWant : normalizeSkillList(userA.skillsWant);
    const myHave = userA.normalizedSkillsHave.length > 0
        ? userA.normalizedSkillsHave : normalizeSkillList(userA.skillsHave);
    const theirHave = userB.normalizedSkillsHave.length > 0
        ? userB.normalizedSkillsHave : normalizeSkillList(userB.skillsHave);
    const theirWant = userB.normalizedSkillsWant.length > 0
        ? userB.normalizedSkillsWant : normalizeSkillList(userB.skillsWant);

    // --- Exact set overlap ---
    const exactMatchedHave = myWant.filter(s => theirHave.includes(s));  // what I can GET
    const exactMatchedWant = myHave.filter(s => theirWant.includes(s));  // what I can GIVE

    // --- Fuzzy matching (handles typos/abbreviations not in taxonomy) ---
    const fuzzyHave = fuzzyMatchSkills(myWant, theirHave);
    const fuzzyWant = fuzzyMatchSkills(myHave, theirWant);

    // Combine exact + fuzzy (deduplicated)
    const matchedHave = [...new Set([...exactMatchedHave, ...fuzzyHave])];
    const matchedWant = [...new Set([...exactMatchedWant, ...fuzzyWant])];

    // --- Semantic similarity via pgvector ---
    let semanticMatches: string[] = [];
    let semanticScore = 0;

    // Only run semantic search if we have some skills but not many exact matches
    if (matchedHave.length < myWant.length) {
        const unmatchedWants = myWant.filter(s => !matchedHave.includes(s));
        const semanticResults = await Promise.all(
            unmatchedWants.slice(0, 5).map(async (skill) => {
                const similar = await findSimilarSkills(skill, 0.3, 5);
                const matched = similar
                    .filter(s => theirHave.includes(s.normalizedSkill))
                    .map(s => s.normalizedSkill);
                return matched;
            })
        );
        semanticMatches = [...new Set(semanticResults.flat())];
        semanticScore = semanticMatches.length > 0
            ? Math.min(semanticMatches.length / unmatchedWants.length, 1)
            : 0;
    }

    // --- Score calculation ---
    const totalMySkills = new Set([...myWant, ...myHave]).size;
    const overlapScore = totalMySkills > 0 ? matchedHave.length / myWant.length : 0;
    const mutualScore = myHave.length > 0 ? matchedWant.length / myHave.length : 0;
    const fuzzyBonus = (fuzzyHave.length + fuzzyWant.length - exactMatchedHave.length - exactMatchedWant.length) > 0
        ? 0.05 : 0;

    const yearsA = extractYearsOfExperience(userA.bio ?? null);
    const yearsB = extractYearsOfExperience(userB.bio ?? null);
    const expBoost = Math.min((yearsA + yearsB) / 20, 1);

    const rawScore =
        0.50 * overlapScore +
        0.30 * mutualScore +
        0.10 * semanticScore +
        0.05 * fuzzyBonus +
        0.05 * expBoost;

    const matchScore = Math.min(Math.round(rawScore * 100), 100);
    const matchConfidence = getConfidenceLabel(matchScore);

    return {
        matchScore,
        matchedHave,
        matchedWant,
        semanticMatches,
        matchConfidence,
    };
}

// ─── Route Handlers ────────────────────────────────────────────

export const findSkillsMatches = async (req: Request, res: Response): Promise<Response> => {
    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: {
                id: true, name: true, bio: true,
                skillsHave: true, skillsWant: true,
                normalizedSkillsHave: true, normalizedSkillsWant: true,
            },
        });
        if (!currentUser) return res.status(404).json({ message: 'User not found' });

        const cacheKey = `matches:${currentUser.id}`;

        // Try Python matching service first (if enabled and available)
        if (USE_PYTHON_SERVICE && await isPythonServiceHealthy()) {
            try {
                console.log('[Match] Using Python matching service');
                const pythonResult = await getPythonMatches(currentUser.id);

                const response = {
                    message: pythonResult.message || (pythonResult.matches.length > 0 ? 'Matches found!' : 'No mutual matches yet'),
                    totalMatches: pythonResult.totalMatches,
                    suggestions: suggestSkills(currentUser.skillsHave),
                    matches: pythonResult.matches,
                    source: 'python-service',
                };

                // Cache Python results
                await redis.set(cacheKey, JSON.stringify(response), { ex: 1800 });
                return res.status(200).json(response);
            } catch (error) {
                console.warn('[Match] Python service failed, falling back to local matching:', error);
            }
        }

        // Check cache
        const cached = await redis.get(cacheKey);
        if (cached) {
            try {
                const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
                if (parsed && typeof parsed === 'object' && 'matches' in parsed) {
                    return res.status(200).json(parsed);
                }
            } catch { /* invalid cache, continue */ }
            await redis.del(cacheKey);
        }

        // Ensure embeddings exist for current user's skills
        const allUserSkills = [...currentUser.skillsHave, ...currentUser.skillsWant];
        if (USE_PYTHON_SERVICE && await isPythonServiceHealthy()) {
            // Use Python service for embeddings
            storeEmbeddings(allUserSkills).catch(err =>
                console.error('[Match] Python embedding error:', err)
            );
        } else {
            // Use local embedding service
            ensureSkillEmbeddings(allUserSkills).catch(err =>
                console.error('[Match] Background embedding error:', err)
            );
        }

        // Normalize current user's skills
        const normalizedWant = currentUser.normalizedSkillsWant.length > 0
            ? currentUser.normalizedSkillsWant : normalizeSkillList(currentUser.skillsWant);
        const normalizedHave = currentUser.normalizedSkillsHave.length > 0
            ? currentUser.normalizedSkillsHave : normalizeSkillList(currentUser.skillsHave);

        // Find candidates — users with overlapping skills (bounded to 200)
        const candidates = await prisma.user.findMany({
            where: {
                id: { not: currentUser.id },
                OR: [
                    { normalizedSkillsHave: { hasSome: normalizedWant } },
                    { normalizedSkillsWant: { hasSome: normalizedHave } },
                    { skillsHave: { hasSome: currentUser.skillsWant } },
                    { skillsWant: { hasSome: currentUser.skillsHave } },
                ],
            },
            select: {
                id: true, name: true, bio: true,
                skillsHave: true, skillsWant: true,
                normalizedSkillsHave: true, normalizedSkillsWant: true,
            },
            take: 200,
        });

        // Score candidates in controlled batches (10 at a time)
        const BATCH_SIZE = 10;
        const allMatches: EnrichedMatch[] = [];

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (candidate) => {
                    // Check pair cache
                    const pairKey = `match:${[currentUser.id, candidate.id].sort().join('-')}`;
                    const pairCached = await redis.get(pairKey);
                    if (pairCached) {
                        try {
                            const parsed = typeof pairCached === 'string' ? JSON.parse(pairCached) : pairCached;
                            if (parsed && typeof parsed === 'object' && 'matchScore' in parsed) {
                                return parsed as EnrichedMatch;
                            }
                        } catch { /* invalid cache */ }
                        await redis.del(pairKey);
                    }

                    const result = await calculateWeightedMatchScore(
                        currentUser as UserWithSkills,
                        candidate as UserWithSkills
                    );

                    if (result.matchScore > 0) {
                        const enriched: EnrichedMatch = {
                            id: candidate.id,
                            name: candidate.name,
                            bio: candidate.bio,
                            skillsHave: candidate.skillsHave,
                            skillsWant: candidate.skillsWant,
                            ...result,
                        };
                        await redis.set(pairKey, JSON.stringify(enriched), { ex: 3600 });
                        return enriched;
                    }
                    return null;
                })
            );
            allMatches.push(...batchResults.filter((m): m is EnrichedMatch => m !== null));
        }

        // Sort by match score descending
        allMatches.sort((a, b) => b.matchScore - a.matchScore);

        const aiSuggestions = suggestSkills(currentUser.skillsHave);

        const response = {
            message: allMatches.length > 0 ? 'Matches found!' : 'No mutual matches yet',
            totalMatches: allMatches.length,
            suggestions: aiSuggestions,
            matches: allMatches,
            source: 'local-nodejs',
        };

        await redis.set(cacheKey, JSON.stringify(response), { ex: 1800 }); // 30-min cache
        return res.status(200).json(response);
    } catch (error) {
        console.error('[Match] Error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const verifySkill = async (req: Request, res: Response): Promise<Response> => {
    const { userId, skill, raterId, rating } = req.body;
    try {
        const normalized = normalizeSkillName(skill);

        const verification = await prisma.skillVerification.upsert({
            where: { userId_skill: { userId, skill: normalized } },
            update: { rating: { increment: rating }, verifiedCount: { increment: 1 } },
            create: { userId, skill: normalized, rating, verifiedCount: 1, raterId },
        });

        // Ensure the skill has an embedding for future matching
        ensureSkillEmbeddings([skill]).catch(err =>
            console.error('[Verify] Background embedding error:', err)
        );

        return res.status(200).json({ message: 'Skill verification updated', verification });
    } catch (error) {
        console.error('[Verify] Error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};
