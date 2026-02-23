import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import authMiddleware from './authMiddleware.js';

describe('authMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should reject request without authorization header', async () => {
    await authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token format', async () => {
    req.headers = { authorization: 'InvalidFormat token123' };

    await authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token', async () => {
    req.headers = { authorization: 'Bearer invalid.token.here' };

    await authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept valid token and attach user to request', async () => {
    const userId = 'user-123';
    const token = jwt.sign({ id: userId }, 'test-secret', { expiresIn: '1h' });
    req.headers = { authorization: `Bearer ${token}` };

    await authMiddleware(req as Request, res as Response, next);

    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe(userId);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ id: 'user-123' }, 'test-secret');
    req.headers = { authorization: `Bearer ${token}` };

    await authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
