import { Request, Response } from 'express';
import prisma from '../config/db.js';

export const createReview = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { exchangeId, revieweeId, rating, feedback, tags } = req.body;
        const reviewerId = req.user!.id;

        if (reviewerId === revieweeId) {
            return res.status(400).json({ message: "You cannot review yourself." });
        }

        const exchange = await prisma.skillExchange.findUnique({ where: { id: exchangeId } });
        if (!exchange) {
            return res.status(404).json({ message: "SkillExchange not found." });
        }
        if (exchange.status !== "COMPLETED") {
            return res.status(400).json({ message: "Exchange must be COMPLETED to review." });
        }
        if (![exchange.userAId, exchange.userBId].includes(reviewerId) ||
            ![exchange.userAId, exchange.userBId].includes(revieweeId)) {
            return res.status(403).json({ message: "You are not a participant in this exchange." });
        }

        const existing = await prisma.review.findFirst({
            where: { exchangeId, reviewerId, revieweeId }
        });
        if (existing) {
            return res.status(400).json({ message: "You have already reviewed this user for this exchange." });
        }

        const review = await prisma.review.create({
            data: {
                exchangeId,
                reviewerId,
                revieweeId,
                rating,
                comment: feedback,
                tags,
            }
        });

        return res.status(201).json({ message: "Review created successfully", review });
    } catch (error) {
        console.error("Review creation error:", error);
        return res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const getUserReviews = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.params.userId as string;
        const reviews = await prisma.review.findMany({
            where: { revieweeId: userId },
            include: {
                reviewer: { select: { id: true, name: true } },
                exchange: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({ reviews });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const getReviewsGiven = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.params.userId as string;
        const reviews = await prisma.review.findMany({
            where: { reviewerId: userId },
            include: {
                reviewee: { select: { id: true, name: true } },
                exchange: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ reviews });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const getUserAverageRating = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.params.userId as string;
        const result = await prisma.review.aggregate({
            where: { revieweeId: userId },
            _avg: { rating: true },
            _count: { rating: true }
        });
        return res.json({ averageRating: result._avg?.rating ?? null, reviewCount: result._count?.rating ?? 0 });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
