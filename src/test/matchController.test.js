import express from 'express';
import request from 'supertest';
import { findSkillsMatches, verifySkill, normalizeSkills, fuzzyMatch, semanticMatch, calculateWeightedMatchScore, fetchSkillEmbedding, cosineSimilarity, generateDynamicSynonyms, verifySkillWithHF, extractYearsOfExperience, getConfidenceLabel } from './matchController.js';

// Mock dependencies
jest.mock('../config/db.js', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    skillVerification: {
      upsert: jest.fn(),
    },
  },
}));
jest.mock('../config/redisClient.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock('node-fetch', () => jest.fn());
jest.mock('../utils/suggestSkills.js', () => ({
  suggestSkills: jest.fn(() => ['Python', 'React']),
}));
jest.mock('fuse.js', () => ({
  default: jest.fn(() => ({
    search: jest.fn((skill) => [{ item: skill + '_match' }]),
  })),
}));
jest.mock('string-similarity', () => ({
  stringSimilarity: { findBestMatch: jest.fn(() => ({ ratings: [{ score: 0.9 }] })) },
}));

const app = express();
app.use(express.json());
app.get('/match/matches', findSkillsMatches);
app.post('/verify-skill', verifySkill);

describe('Match Controller Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 'user123' }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
    process.env.HF_API_KEY = 'test-key';
  });

  // --- Utility Functions ---
  describe('fetchSkillEmbedding', () => {
    it('should return cached embedding', async () => {
      const skill = 'JavaScript';
      const embedding = [0.1, 0.2, 0.3];
      require('./matchController.js').skillEmbeddingCache[skill] = embedding;
      const result = await fetchSkillEmbedding(skill);
      expect(result).toEqual(embedding);
      expect(require('node-fetch')).not.toHaveBeenCalled();
    });

    it('should fetch and cache embedding successfully', async () => {
      const skill = 'Python';
      const mockResponse = { json: jest.fn().mockResolvedValue([[[0.1, 0.2, 0.3]]]) };
      require('node-fetch').mockResolvedValue(mockResponse);
      const result = await fetchSkillEmbedding(skill);
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(require('node-fetch')).toHaveBeenCalledWith(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        expect.objectContaining({ method: 'POST' })
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle slow fetch with warning', async () => {
      const skill = 'Java';
      const mockResponse = { json: jest.fn().mockResolvedValue([[[0.1, 0.2, 0.3]]]) };
      require('node-fetch').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 2500)));
      await fetchSkillEmbedding(skill);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Slow embedding fetch'));
    });

    it('should return null on fetch error', async () => {
      require('node-fetch').mockRejectedValue(new Error('Network error'));
      const result = await fetchSkillEmbedding('Ruby');
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vecA = [1, 0];
      const vecB = [1, 0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1);
    });

    it('should return 0 for unequal lengths', () => {
      expect(cosineSimilarity([1, 0], [1])).toBe(0);
    });

    it('should return 0 for null vectors', () => {
      expect(cosineSimilarity(null, [1, 0])).toBe(0);
    });
  });

  describe('generateDynamicSynonyms', () => {
    it('should return cached synonyms', async () => {
      const mockCache = { 'javascript': 'js' };
      require('../config/redisClient.js').get.mockResolvedValue(JSON.stringify(mockCache));
      const result = await generateDynamicSynonyms();
      expect(result).toEqual(mockCache);
      expect(require('../config/redisClient.js').get).toHaveBeenCalledWith('dynamicSynonyms');
    });

    it('should generate and cache new synonyms', async () => {
      require('../config/db.js').user.findMany.mockResolvedValue([{ skillsHave: ['JavaScript', 'JS'], skillsWant: [] }]);
      require('node-fetch').mockResolvedValue({ json: jest.fn().mockResolvedValue([[[0.1, 0.2, 0.3]]]) });
      const result = await generateDynamicSynonyms();
      expect(result).toHaveProperty('javascript', 'javascript');
      expect(require('../config/redisClient.js').set).toHaveBeenCalledWith('dynamicSynonyms', expect.any(String), { EX: 86400 });
    });
  });

  describe('verifySkillWithHF', () => {
    it('should return verification with confidence', async () => {
      const mockResponse = { json: jest.fn().mockResolvedValue({ scores: [0.8] }) };
      require('node-fetch').mockResolvedValue(mockResponse);
      const result = await verifySkillWithHF('Python', 'I know Python');
      expect(result).toEqual({ verified: true, confidence: 0.8 });
    });

    it('should return fallback on error', async () => {
      require('node-fetch').mockRejectedValue(new Error('API error'));
      const result = await verifySkillWithHF('Java', 'I know Java');
      expect(result).toEqual({ verified: false, confidence: 0.5 });
    });
  });

  describe('extractYearsOfExperience', () => {
    it('should extract years from bio', () => {
      expect(extractYearsOfExperience('5 years experience')).toBe(5);
      expect(extractYearsOfExperience('10 yrs')).toBe(10);
    });

    it('should return 0 for no match', () => {
      expect(extractYearsOfExperience('No experience')).toBe(0);
    });
  });

  describe('normalizeSkills', () => {
    it('should normalize skills with synonyms', async () => {
      require('../config/redisClient.js').get.mockResolvedValue(JSON.stringify({ 'javascript': 'js' }));
      const result = await normalizeSkills(['JavaScript', 'Python']);
      expect(result).toEqual(['js', 'python']);
    });
  });

  describe('fuzzyMatch', () => {
    it('should match skills with fuzzy logic', () => {
      const result = fuzzyMatch(['JavaScript'], ['JScript']);
      expect(result).toContain('JScript_match');
    });
  });

  describe('semanticMatch', () => {
    it('should calculate semantic similarity', async () => {
      require('node-fetch').mockResolvedValue({ json: jest.fn().mockResolvedValue([[[0.1, 0.2, 0.3]]]) });
      const result = await semanticMatch(['Java'], ['Java']);
      expect(result).toBeGreaterThan(0.7);
    });
  });

  describe('calculateWeightedMatchScore', () => {
    it('should calculate score with all components', async () => {
      require('../config/redisClient.js').get.mockResolvedValue(JSON.stringify({ 'javascript': 'js' }));
      fuzzyMatch.mockReturnValue(['java']);
      require('node-fetch').mockResolvedValue({ json: jest.fn().mockResolvedValue([[[0.1, 0.2, 0.3]]]) });
      verifySkillWithHF.mockResolvedValue({ verified: true, confidence: 0.9 });
      const userA = { skillsHave: ['java'], skillsWant: ['python'], bio: '5 years' };
      const userB = { skillsHave: ['python'], skillsWant: ['java'], bio: '3 years' };
      const result = await calculateWeightedMatchScore(userA, userB);
      expect(result.matchScore).toBeGreaterThan(80);
      expect(result.matchedHave).toContain('java');
      expect(result.verificationConfidence).toBeCloseTo(18); // 0.9 * 0.2 * 100
    });
  });

  describe('getConfidenceLabel', () => {
    it('should return correct label', () => {
      expect(getConfidenceLabel(85)).toBe('🔥 Strong Match');
      expect(getConfidenceLabel(50)).toBe('👌 Medium Match');
      expect(getConfidenceLabel(20)).toBe('🙂 Light Match');
    });
  });

  // --- Route Handlers ---
  describe('findSkillsMatches', () => {
    it('should return cached matches', async () => {
      const mockCache = {
        message: '✅ Matches found!',
        totalMatches: 1,
        suggestions: ['Python'],
        matches: [{ id: 'user456', matchScore: 85 }],
      };
      require('../config/redisClient.js').get.mockResolvedValue(JSON.stringify(mockCache));
      await findSkillsMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCache);
    });

    it('should find and cache new matches', async () => {
      require('../config/db.js').user.findUnique.mockResolvedValue({ id: 'user123', skillsHave: ['java'], skillsWant: ['python'], bio: '5 years' });
      require('../config/db.js').user.findMany.mockResolvedValue([{ id: 'user456', skillsHave: ['python'], skillsWant: ['java'], bio: '3 years' }]);
      calculateWeightedMatchScore.mockResolvedValue({ matchScore: 85, matchedHave: ['java'], matchedWant: [], verificationConfidence: 18 });
      await findSkillsMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ matches: expect.arrayContaining([{ matchScore: 85 }]) }));
      expect(require('../config/redisClient.js').set).toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      require('../config/db.js').user.findUnique.mockResolvedValue(null);
      await findSkillsMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should handle server error', async () => {
      require('../config/db.js').user.findUnique.mockRejectedValue(new Error('DB error'));
      await findSkillsMatches(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error' }));
    });
  });

  describe('verifySkill', () => {
    it('should update skill verification', async () => {
      req.body = { userId: 'user456', skill: 'Java', raterId: 'user123', rating: 1 };
      require('../config/db.js').user.skillVerification.upsert.mockResolvedValue({ id: 'ver1', userId: 'user456', skill: 'Java', rating: 1, verifiedCount: 1, raterId: 'user123' });
      await verifySkill(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Skill verification updated', verification: expect.any(Object) });
    });

    it('should handle server error', async () => {
      req.body = { userId: 'user456', skill: 'Java', raterId: 'user123', rating: 1 };
      require('../config/db.js').user.skillVerification.upsert.mockRejectedValue(new Error('DB error'));
      await verifySkill(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error' }));
    });
  });

  // --- API Integration Tests ---
  describe('API Integration', () => {
    it('should get matches via GET /match/matches', async () => {
      require('../config/db.js').user.findUnique.mockResolvedValue({ id: 'user123', skillsHave: ['java'], skillsWant: ['python'], bio: '5 years' });
      require('../config/db.js').user.findMany.mockResolvedValue([{ id: 'user456', skillsHave: ['python'], skillsWant: ['java'], bio: '3 years' }]);
      calculateWeightedMatchScore.mockResolvedValue({ matchScore: 85, matchedHave: ['java'], matchedWant: [], verificationConfidence: 18 });
      const response = await request(app).get('/match/matches').set('Authorization', 'Bearer test-token');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
    });

    it('should verify skill via POST /verify-skill', async () => {
      require('../config/db.js').user.skillVerification.upsert.mockResolvedValue({ id: 'ver1', userId: 'user456', skill: 'Java', rating: 1, verifiedCount: 1, raterId: 'user123' });
      const response = await request(app)
        .post('/verify-skill')
        .set('Authorization', 'Bearer test-token')
        .send({ userId: 'user456', skill: 'Java', raterId: 'user123', rating: 1 });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Skill verification updated');
    });
  });
});