/**
 * Matching Engine Test Suite
 * 
 * Tests the core matching logic: skill taxonomy, fuzzy matching, 
 * score calculation, and the full matching pipeline.
 * 
 * Run: npm test -- src/test/matchEngine.test.ts
 */

import {
    normalizeSkillName,
    normalizeSkillList,
    isKnownSkill,
    getCanonicalSkills,
} from '../utils/skillTaxonomy';

import {
    normalizeSkills,
    calculateWeightedMatchScore,
} from '../controllers/matchController';

// ─── Skill Taxonomy Tests ──────────────────────────────────────

describe('Skill Taxonomy', () => {
    describe('normalizeSkillName', () => {
        it('should normalize common programming language aliases', () => {
            expect(normalizeSkillName('JavaScript')).toBe('javascript');
            expect(normalizeSkillName('JS')).toBe('javascript');
            expect(normalizeSkillName('js')).toBe('javascript');
            expect(normalizeSkillName('ECMAScript')).toBe('javascript');
            expect(normalizeSkillName('ES6')).toBe('javascript');
        });

        it('should normalize framework aliases', () => {
            expect(normalizeSkillName('React')).toBe('react');
            expect(normalizeSkillName('react.js')).toBe('react');
            expect(normalizeSkillName('ReactJS')).toBe('react');
            expect(normalizeSkillName('react js')).toBe('react');
        });

        it('should normalize Node.js variants', () => {
            expect(normalizeSkillName('Node')).toBe('nodejs');
            expect(normalizeSkillName('node.js')).toBe('nodejs');
            expect(normalizeSkillName('NodeJS')).toBe('nodejs');
            expect(normalizeSkillName('Node JS')).toBe('nodejs');
        });

        it('should normalize TypeScript', () => {
            expect(normalizeSkillName('TypeScript')).toBe('typescript');
            expect(normalizeSkillName('TS')).toBe('typescript');
            expect(normalizeSkillName('ts')).toBe('typescript');
        });

        it('should normalize database names', () => {
            expect(normalizeSkillName('PostgreSQL')).toBe('postgresql');
            expect(normalizeSkillName('Postgres')).toBe('postgresql');
            expect(normalizeSkillName('MongoDB')).toBe('mongodb');
            expect(normalizeSkillName('Mongo')).toBe('mongodb');
        });

        it('should normalize DevOps skills', () => {
            expect(normalizeSkillName('K8s')).toBe('kubernetes');
            expect(normalizeSkillName('Kubernetes')).toBe('kubernetes');
            expect(normalizeSkillName('CI/CD')).toBe('cicd');
            expect(normalizeSkillName('Amazon Web Services')).toBe('aws');
        });

        it('should normalize non-tech skills', () => {
            expect(normalizeSkillName('Guitar')).toBe('guitar');
            expect(normalizeSkillName('Public Speaking')).toBe('public-speaking');
            expect(normalizeSkillName('UI/UX')).toBe('uiux-design');
        });

        it('should handle unknown skills by lowercasing and trimming', () => {
            expect(normalizeSkillName('  Quantum Computing  ')).toBe('quantum computing');
            expect(normalizeSkillName('Blockchain')).toBe('blockchain');
        });

        it('should handle extra whitespace', () => {
            expect(normalizeSkillName('  react  ')).toBe('react');
            expect(normalizeSkillName('Vue   JS')).toBe('vue'); // after normalize: 'vue js'
            // 'vue js' is in taxonomy
        });
    });

    describe('normalizeSkillList', () => {
        it('should normalize and deduplicate skills', () => {
            const result = normalizeSkillList(['JavaScript', 'JS', 'js', 'Python']);
            expect(result).toEqual(['javascript', 'python']);
            expect(result.length).toBe(2); // JS variants collapsed
        });

        it('should handle empty array', () => {
            expect(normalizeSkillList([])).toEqual([]);
        });

        it('should handle mixed known/unknown skills', () => {
            const result = normalizeSkillList(['React', 'Quantum Physics', 'node.js']);
            expect(result).toContain('react');
            expect(result).toContain('nodejs');
            expect(result).toContain('quantum physics');
            expect(result.length).toBe(3);
        });
    });

    describe('isKnownSkill', () => {
        it('should return true for known skills', () => {
            expect(isKnownSkill('javascript')).toBe(true);
            expect(isKnownSkill('React')).toBe(true);
            expect(isKnownSkill('K8s')).toBe(true);
        });

        it('should return false for unknown skills', () => {
            expect(isKnownSkill('quantum computing')).toBe(false);
            expect(isKnownSkill('underwater basket weaving')).toBe(false);
        });
    });

    describe('getCanonicalSkills', () => {
        it('should return unique canonical skill names', () => {
            const canonicals = getCanonicalSkills();
            expect(canonicals.length).toBeGreaterThan(50);
            // Check no duplicates
            expect(new Set(canonicals).size).toBe(canonicals.length);
            // Check some expected canonicals
            expect(canonicals).toContain('javascript');
            expect(canonicals).toContain('react');
            expect(canonicals).toContain('guitar');
        });
    });
});

// ─── Match Scoring Tests ───────────────────────────────────────

describe('Match Scoring', () => {
    const makeUser = (
        overrides: Partial<{
            id: string; name: string; bio: string | null;
            skillsHave: string[]; skillsWant: string[];
            normalizedSkillsHave: string[]; normalizedSkillsWant: string[];
        }> = {}
    ) => ({
        id: overrides.id ?? 'user-1',
        name: overrides.name ?? 'Test User',
        bio: overrides.bio ?? null,
        skillsHave: overrides.skillsHave ?? [],
        skillsWant: overrides.skillsWant ?? [],
        normalizedSkillsHave: overrides.normalizedSkillsHave ?? [],
        normalizedSkillsWant: overrides.normalizedSkillsWant ?? [],
    });

    describe('calculateWeightedMatchScore', () => {
        it('should return high score for perfect skill overlap', async () => {
            const userA = makeUser({
                id: 'a',
                skillsHave: ['python', 'react'],
                skillsWant: ['guitar', 'piano'],
                normalizedSkillsHave: ['python', 'react'],
                normalizedSkillsWant: ['guitar', 'piano'],
            });
            const userB = makeUser({
                id: 'b',
                skillsHave: ['guitar', 'piano'],
                skillsWant: ['python', 'react'],
                normalizedSkillsHave: ['guitar', 'piano'],
                normalizedSkillsWant: ['python', 'react'],
            });

            const result = await calculateWeightedMatchScore(userA, userB);
            expect(result.matchScore).toBeGreaterThanOrEqual(70);
            expect(result.matchedHave).toContain('guitar');
            expect(result.matchedHave).toContain('piano');
            expect(result.matchedWant).toContain('python');
            expect(result.matchedWant).toContain('react');
            expect(result.matchConfidence).toBe('Strong Match');
        });

        it('should return 0 for no overlap at all', async () => {
            const userA = makeUser({
                id: 'a',
                skillsHave: ['python'],
                skillsWant: ['guitar'],
                normalizedSkillsHave: ['python'],
                normalizedSkillsWant: ['guitar'],
            });
            const userB = makeUser({
                id: 'b',
                skillsHave: ['cooking'],
                skillsWant: ['drawing'],
                normalizedSkillsHave: ['cooking'],
                normalizedSkillsWant: ['drawing'],
            });

            const result = await calculateWeightedMatchScore(userA, userB);
            expect(result.matchScore).toBe(0);
            expect(result.matchedHave).toHaveLength(0);
            expect(result.matchedWant).toHaveLength(0);
        });

        it('should return partial score for one-directional match', async () => {
            const userA = makeUser({
                id: 'a',
                skillsHave: ['python'],
                skillsWant: ['guitar'],
                normalizedSkillsHave: ['python'],
                normalizedSkillsWant: ['guitar'],
            });
            const userB = makeUser({
                id: 'b',
                skillsHave: ['guitar'],
                skillsWant: ['cooking'],  // doesn't want python
                normalizedSkillsHave: ['guitar'],
                normalizedSkillsWant: ['cooking'],
            });

            const result = await calculateWeightedMatchScore(userA, userB);
            expect(result.matchScore).toBeGreaterThan(0);
            expect(result.matchScore).toBeLessThan(80);
            expect(result.matchedHave).toContain('guitar');
            expect(result.matchedWant).toHaveLength(0);
        });

        it('should give experience boost when bio mentions years', async () => {
            const baseUser = {
                skillsHave: ['python'],
                skillsWant: ['react'],
                normalizedSkillsHave: ['python'],
                normalizedSkillsWant: ['react'],
            };
            const userB = makeUser({
                id: 'b',
                skillsHave: ['react'],
                skillsWant: ['python'],
                normalizedSkillsHave: ['react'],
                normalizedSkillsWant: ['python'],
            });

            const noBio = await calculateWeightedMatchScore(
                makeUser({ id: 'a1', bio: null, ...baseUser }),
                userB
            );
            const withBio = await calculateWeightedMatchScore(
                makeUser({ id: 'a2', bio: '10 years of software engineering', ...baseUser }),
                userB
            );

            expect(withBio.matchScore).toBeGreaterThanOrEqual(noBio.matchScore);
        });

        it('should handle empty skill arrays gracefully', async () => {
            const userA = makeUser({ id: 'a' });
            const userB = makeUser({ id: 'b' });

            const result = await calculateWeightedMatchScore(userA, userB);
            expect(result.matchScore).toBe(0);
        });
    });
});

// ─── normalizeSkills (exported function) ───────────────────────

describe('normalizeSkills (controller export)', () => {
    it('should normalize skills using taxonomy', async () => {
        const result = await normalizeSkills(['JavaScript', 'React.js', 'Node']);
        expect(result).toContain('javascript');
        expect(result).toContain('react');
        expect(result).toContain('nodejs');
    });

    it('should deduplicate after normalization', async () => {
        const result = await normalizeSkills(['JS', 'JavaScript', 'javascript']);
        expect(result).toEqual(['javascript']);
    });

    it('should handle empty input', async () => {
        const result = await normalizeSkills([]);
        expect(result).toEqual([]);
    });
});
