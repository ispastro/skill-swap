import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints - 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Review creation limiter - 10 reviews per day
export const reviewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: 'Maximum 10 reviews per day allowed.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat message limiter - 50 messages per minute
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: 'Too many messages, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});
