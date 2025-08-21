

import prisma from  '../config/db.js'
// Create a review for a completed SkillExchange
export const createReview = async (req, res) => {
    try {
        const { exchangeId, reviewedId, rating, feedback, tags } = req.body;
        const reviewerId = req.user.id;

        if (!exchangeId || !reviewedId || !rating) {
            return res.status(400).json({ message: "exchangeId, reviewedId, and rating are required." });
        }
        if (reviewerId === reviewedId) {
            return res.status(400).json({ message: "You cannot review yourself." });
        }

        // Check exchange exists and is completed, and user is a participant
        const exchange = await prisma.skillExchange.findUnique({ where: { id: exchangeId } });
        if (!exchange) {
            return res.status(404).json({ message: "SkillExchange not found." });
        }
        if (exchange.status !== "COMPLETED") {
            return res.status(400).json({ message: "Exchange must be COMPLETED to review." });
        }
        if (![exchange.userAId, exchange.userBId].includes(reviewerId) ||
                ![exchange.userAId, exchange.userBId].includes(reviewedId)) {
            return res.status(403).json({ message: "You are not a participant in this exchange." });
        }

        // Prevent duplicate review for this exchange/reviewer/reviewed
        const existing = await prisma.review.findFirst({
            where: { exchangeId, reviewerId, reviewedId }
        });
        if (existing) {
            return res.status(400).json({ message: "You have already reviewed this user for this exchange." });
        }

        // Create review
        const review = await prisma.review.create({
            data: {
                exchangeId,
                reviewerId,
                reviewedId,
                rating,
                feedback,
                tags,
            }
        });

        res.status(201).json({ message: "Review created successfully", review });
    } catch (error) {
        console.error("Review creation error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all reviews for a user (as reviewed)
export const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await prisma.review.findMany({
            where: { reviewedId: userId },
            include: {
                reviewer: { select: { id: true, username: true } },
                exchange: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all reviews given by a user (as reviewer)
export const getReviewsGiven = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await prisma.review.findMany({
            where: { reviewerId: userId },
            include: {
                reviewed: { select: { id: true, username: true } },
                exchange: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ reviews });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get average rating for a user
export const getUserAverageRating = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await prisma.review.aggregate({
            where: { reviewedId: userId },
            _avg: { rating: true },
            _count: { rating: true }
        });
        res.json({ averageRating: result._avg.rating, reviewCount: result._count.rating });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};