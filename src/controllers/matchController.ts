import { Request, Response } from 'express';
import prisma from '../config/db.js';
import redis from '../config/redisClient.js';
import { normalizeSkillName, normalizeSkillList } from '../utils/skillTaxonomy.js';
import { getPythonMatches, isPythonServiceHealthy } from '../services/pythonMatchService.js';



export async function normalizeSkills(skills: string[]): Promise<string[]> {
    return normalizeSkillList(skills);
}

export const findSkillsMatches = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.user!.id;
        const cacheKey = `matches:${userId}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            try {
                const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
                if (parsed && typeof parsed === 'object' && 'matches' in parsed) {
                    return res.status(200).json(parsed);
                }
            } catch { /* invalid cache */ }
            await redis.del(cacheKey);
        }

        // Check Python service health
        const isHealthy = await isPythonServiceHealthy();
        if (!isHealthy) {
            return res.status(503).json({
                message: 'Matching service unavailable',
                error: 'Python matching service is not responding'
            });
        }

        // Get matches from Python service
        console.log('[Match] Requesting matches from Python service');
        const pythonResult = await getPythonMatches(userId);

        const response = {
            message: pythonResult.message || (pythonResult.matches.length > 0 ? 'Matches found!' : 'No mutual matches yet'),
            totalMatches: pythonResult.totalMatches,
            matches: pythonResult.matches,
            source: 'python-service',
        };

        // Cache results for 30 minutes
        await redis.set(cacheKey, JSON.stringify(response), { ex: 1800 });
        return res.status(200).json(response);
    } catch (error) {
        console.error('[Match] Error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Matching service error', error: errMsg });
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

        return res.status(200).json({ message: 'Skill verification updated', verification });
    } catch (error) {
        console.error('[Verify] Error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};
