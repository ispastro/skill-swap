import { body, param } from 'express-validator';

export const createReviewValidator = [
  body('exchangeId')
    .isUUID()
    .withMessage('Invalid exchange ID format'),
  
  body('revieweeId')
    .isUUID()
    .withMessage('Invalid reviewee ID format'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('feedback')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be 1000 characters or less'),
  
  body('tags')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Maximum 5 tags allowed'),
  
  body('tags.*')
    .if(body('tags').exists())
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Each tag must be 2-30 characters'),
];

export const getUserReviewsValidator = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID format'),
];
