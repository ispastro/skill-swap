import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  createReview,
  getUserReviews,
  getReviewsGiven,
  getUserAverageRating
} from '../controllers/reviewController.js';

const router = express.Router();

// Create a review (protected)
router.post('/', authMiddleware, createReview);

// Get all reviews for a user (as reviewee)
router.get('/user/:userId', getUserReviews);

// Get all reviews given by a user (as reviewer)
router.get('/given/:userId', getReviewsGiven);

// Get average rating for a user
router.get('/average/:userId', getUserAverageRating);

export default router;
