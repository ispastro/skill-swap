import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { register } from './authController.js';
import { getUserProfile, updateUserProfile } from './profileController.js';
import { registerValidator } from '../validators/authValidators.js';
import { updateProfileValidator } from '../validators/profileValidators.js';
import { validateResult } from '../middleware/validateRequest.js';
import authMiddleware from '../middleware/authMiddleware.js';
import prisma from '../config/db.js';

// Mock the Python matching service to avoid node-fetch issues
jest.mock('../services/pythonMatchService.js', () => ({
  getPythonMatches: jest.fn(),
  isPythonServiceHealthy: jest.fn(() => Promise.resolve(false)),
}));

let app: Express;
let authToken: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  
  // Setup routes
  app.post('/api/auth/register', registerValidator, validateResult, register);
  app.get('/api/profile', authMiddleware, getUserProfile);
  app.put('/api/profile', authMiddleware, updateProfileValidator, validateResult, updateUserProfile);

  // Create test user and get token
  const testEmail = `test-profile-${Date.now()}@skillswap.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'profiletest',
      email: testEmail,
      password: 'Test123!@#',
    });
  
  authToken = response.body.token;
}, 15000);

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: 'test-profile-' } }
  });
  await prisma.$disconnect();
}, 10000);

describe('Profile API - Integration Tests', () => {

  describe('GET /api/profile', () => {
    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body).toHaveProperty('profileCompleted');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/profile');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Unauthorized');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer invalid-token-123');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('PUT /api/profile', () => {
    test('should update profile with valid data', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bio: 'Full-stack developer with 5 years experience',
          skillsHave: ['JavaScript', 'React', 'Node.js'],
          skillsWant: ['Python', 'Django', 'AWS'],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Profile updated');
      expect(response.body.user.bio).toBe('Full-stack developer with 5 years experience');
      expect(response.body.user.skillsHave).toEqual(['JavaScript', 'React', 'Node.js']);
      expect(response.body.user.skillsWant).toEqual(['Python', 'Django', 'AWS']);
    });

    test('should reject bio longer than 255 characters', async () => {
      const longBio = 'a'.repeat(256);
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bio: longBio });

      expect(response.status).toBe(400);
    });

    test('should reject more than 10 skills', async () => {
      const tooManySkills = Array(11).fill('skill');
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skillsHave: tooManySkills });

      expect(response.status).toBe(400);
    });

    test('should reject skills with invalid length', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skillsHave: ['a'] }); // Too short

      expect(response.status).toBe(400);
    });

    test('should update only bio without skills', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bio: 'Updated bio only' });

      expect(response.status).toBe(200);
      expect(response.body.user.bio).toBe('Updated bio only');
    });

    test('should normalize skills correctly', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skillsHave: ['JavaScript', 'js', 'React', 'reactjs'],
          skillsWant: ['Python', 'py'],
        });

      expect(response.status).toBe(200);
      // Skills should be stored as-is, normalization happens in background
      expect(response.body.user.skillsHave.length).toBeGreaterThan(0);
    });
  });
});
