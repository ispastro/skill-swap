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
        await prisma.user.upsert({
            where: { email: userA_Email },
            update: {},
            create: {
                name: 'Matcher A',
                email: userA_Email,
                password: 'HashedPassword123!',
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
        await prisma.user.upsert({
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

        // 4. Test complete - matching now handled by Python service
        console.log('\n--- Match Engine Test ---');
        console.log('✅ Users created successfully');
        console.log('✅ Embeddings generated');
        console.log('Note: Matching is now handled by Python service');
        console.log('To test matching, use the API endpoint: GET /api/match/matches');

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
