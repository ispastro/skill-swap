import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  createReview,
  getUserReviews,
  getReviewsGiven,
  getUserAverageRating
} from '../controllers/reviewController.js';
import { createReviewValidator, getUserReviewsValidator } from '../validators/reviewValidators.js';
// @ts-ignore
import { validateResult } from '../middleware/validateRequest.js';
import { reviewLimiter } from '../middleware/rateLimiter.js';

const router: Router = express.Router();

router.post('/', authMiddleware, reviewLimiter, createReviewValidator, validateResult, createReview);
router.get('/user/:userId', authMiddleware, getUserReviewsValidator, validateResult, getUserReviews);
router.get('/given/:userId', authMiddleware, getUserReviewsValidator, validateResult, getReviewsGiven);
router.get('/average/:userId', authMiddleware, getUserReviewsValidator, validateResult, getUserAverageRating);

export default router;
