import { body } from 'express-validator';

export const registerValidator = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Name must be 2-20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Name can only contain letters, numbers, hyphens, and underscores'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must have uppercase, lowercase, number, and special character'),
];

export const loginValidator = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];
