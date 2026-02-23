import { describe, test, expect } from '@jest/globals';
import { normalizeSkillName, normalizeSkillList, isKnownSkill } from './skillTaxonomy.js';

describe('Skill Taxonomy - Unit Tests', () => {
  
  describe('normalizeSkillName()', () => {
    test('should normalize JavaScript variants to "javascript"', () => {
      expect(normalizeSkillName('JavaScript')).toBe('javascript');
      expect(normalizeSkillName('js')).toBe('javascript');
      expect(normalizeSkillName('JS')).toBe('javascript');
      expect(normalizeSkillName('  javascript  ')).toBe('javascript');
    });

    test('should normalize Python variants to "python"', () => {
      expect(normalizeSkillName('Python')).toBe('python');
      expect(normalizeSkillName('py')).toBe('python');
      expect(normalizeSkillName('python3')).toBe('python');
    });

    test('should handle unknown skills by lowercasing', () => {
      expect(normalizeSkillName('UnknownSkill')).toBe('unknownskill');
      expect(normalizeSkillName('  WEIRD SKILL  ')).toBe('weird skill');
    });

    test('should handle empty strings', () => {
      expect(normalizeSkillName('')).toBe('');
      expect(normalizeSkillName('   ')).toBe('');
    });
  });

  describe('normalizeSkillList()', () => {
    test('should normalize and deduplicate skills', () => {
      const input = ['JavaScript', 'js', 'Python', 'python'];
      const result = normalizeSkillList(input);
      expect(result).toEqual(['javascript', 'python']);
      expect(result.length).toBe(2);
    });

    test('should handle empty array', () => {
      expect(normalizeSkillList([])).toEqual([]);
    });

    test('should remove duplicates after normalization', () => {
      const input = ['React', 'react', 'REACT', 'reactjs'];
      const result = normalizeSkillList(input);
      expect(result).toEqual(['react']);
    });
  });

  describe('isKnownSkill()', () => {
    test('should return true for known skills', () => {
      expect(isKnownSkill('javascript')).toBe(true);
      expect(isKnownSkill('JS')).toBe(true);
      expect(isKnownSkill('React')).toBe(true);
    });

    test('should return false for unknown skills', () => {
      expect(isKnownSkill('unknownskill123')).toBe(false);
      expect(isKnownSkill('randomtech')).toBe(false);
    });
  });
});
