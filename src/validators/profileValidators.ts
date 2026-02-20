import { body } from 'express-validator';

export const updateProfileValidator = [
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Bio must be 255 characters or less'),
  
  body('skillsHave')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 skills in skillsHave'),
  
  body('skillsHave.*')
    .if(body('skillsHave').exists())
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be 2-50 characters'),
  
  body('skillsWant')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 skills in skillsWant'),
  
  body('skillsWant.*')
    .if(body('skillsWant').exists())
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be 2-50 characters'),
];
