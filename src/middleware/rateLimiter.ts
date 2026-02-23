import rateLimit from 'express-rate-limit';

const createLimiter = (config: any) => {
  const limiter = rateLimit(config);
  return (req: any, res: any, next: any) => {
    // Bypass in test mode OR if test header is present
    if (process.env.NODE_ENV === 'test' || req.headers['x-test-mode'] === 'true') {
      return next();
    }
    return limiter(req, res, next);
  };
};

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50, // Increased from 5 to 50 for production load
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const reviewLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: 'Maximum 10 reviews per day allowed.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 50,
  message: 'Too many messages, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});
