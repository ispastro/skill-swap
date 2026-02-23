import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { login, register } from './authController.js';
import { registerValidator, loginValidator } from '../validators/authValidators.js';
import { validateResult } from '../middleware/validateRequest.js';
import prisma from '../config/db.js';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  
  // Setup routes WITHOUT rate limiting for tests
  app.post('/api/auth/register', registerValidator, validateResult, register);
  app.post('/api/auth/login', loginValidator, validateResult, login);
});

afterAll(async () => {
  // Cleanup: Delete test users
  await prisma.user.deleteMany({
    where: { email: { contains: 'test-auth-' } }
  });
  await prisma.$disconnect();
}, 10000); // 10 second timeout for cleanup

describe('Auth API - Integration Tests', () => {
  
  const testEmail = `test-auth-${Date.now()}@skillswap.com`;
  const testPassword = 'Test123!@#';

  describe('POST /api/auth/register', () => {
    test('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'testuser',
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    }, 10000); // 10 second timeout for bcrypt

    test('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'testuser2',
          email: testEmail, // Same email
          password: testPassword,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('User already exists');
    }, 10000);

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'testuser',
          email: 'invalid-email',
          password: testPassword,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'testuser',
          email: 'new@test.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'a', // Too short
          email: 'new@test.com',
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    test('should reject wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });
  });
});
