import prisma from '../config/db.js';
import { normalizeSkills } from '../controllers/matchController.js';
import { ensureSkillEmbeddings } from '../services/embeddingService.js';
import dotenv from 'dotenv';

dotenv.config();

async function runLiveTest() {
    console.log('🚀 Starting Live Matching Engine Test...');

    const ts = Date.now();
    const userA_Email = `test_matcher_a_${ts}@example.com`;
    const userB_Email = `test_matcher_b_${ts}@example.com`;

    try {
        // 1. Create/Update User A (The Searcher)
        // He HAS Javascript/React, WANTS Python/Guitar
        const skillsHaveA = ['JavaScript', 'React'];
        const skillsWantA = ['Python', 'Guitar'];
        const normHaveA = await normalizeSkills(skillsHaveA);
        const normWantA = await normalizeSkills(skillsWantA);

        console.log('Creating User A...');
        const userA = await prisma.user.upsert({
            where: { email: userA_Email },
            update: {},
            create: {
                name: 'Matcher A',
                email: userA_Email,
                password: 'HashedPassword123!', // Doesn't matter for this direct DB test
                skillsHave: skillsHaveA,
                skillsWant: skillsWantA,
                normalizedSkillsHave: normHaveA,
                normalizedSkillsWant: normWantA,
                bio: 'I am a web developer with 5 years of experience.'
            }
        });

        // 2. Create/Update User B (The Perfect Match)
        // He HAS Python/Guitar, WANTS Javascript
        const skillsHaveB = ['Python', 'Guitar'];
        const skillsWantB = ['JavaScript'];
        const normHaveB = await normalizeSkills(skillsHaveB);
        const normWantB = await normalizeSkills(skillsWantB);

        console.log('Creating User B...');
        const userB = await prisma.user.upsert({
            where: { email: userB_Email },
            update: {},
            create: {
                name: 'Matcher B',
                email: userB_Email,
                password: 'HashedPassword123!',
                skillsHave: skillsHaveB,
                skillsWant: skillsWantB,
                normalizedSkillsHave: normHaveB,
                normalizedSkillsWant: normWantB,
                bio: 'I love playing guitar and want to learn JS.'
            }
        });

        // 3. Ensure embeddings exist (Simulate background process)
        console.log('Ensuring embeddings exist for skills...');
        await ensureSkillEmbeddings([...skillsHaveA, ...skillsWantA, ...skillsHaveB, ...skillsWantB]);

        // 4. Manually trigger the matching logic for User A
        console.log('\n--- Running Match Engine Logic ---');

        // We'll import the matching controller logic directly to test the calculation
        const { calculateWeightedMatchScore } = await import('../controllers/matchController.js');

        const result = await calculateWeightedMatchScore(userA as any, userB as any);

        console.log(`\nMatch Result between User A and User B:`);
        console.log(`Score: ${result.matchScore}%`);
        console.log(`Confidence: ${result.matchConfidence}`);
        console.log(`Matched (What A gets from B):`, result.matchedHave);
        console.log(`Matched (What B gets from A):`, result.matchedWant);

        if (result.matchScore > 50) {
            console.log('\n✅ SUCCESS: Matching engine correctly identified the relationship!');
        } else {
            console.log('\n❌ FAILURE: Match score too low for perfect overlap.');
        }

        // 5. Cleanup
        console.log('\nCleaning up test users...');
        await prisma.user.deleteMany({
            where: { email: { in: [userA_Email, userB_Email] } }
        });

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runLiveTest();
