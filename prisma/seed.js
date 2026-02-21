import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.review.deleteMany();
  await prisma.skillExchange.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.file.deleteMany();
  await prisma.skillVerification.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Hash password for realistic data
  const hashedPassword = await bcrypt.hash('Test123!@#', 10);

  // Create 5 diverse users
  const alice = await prisma.user.create({
    data: {
      id: 'a1111111-1111-1111-1111-111111111111',
      name: 'alice',
      email: 'alice@skillswap.com',
      password: hashedPassword,
      bio: 'Frontend developer with 5 years experience. Love React and TypeScript!',
      skillsHave: ['JavaScript', 'React', 'TypeScript', 'CSS'],
      skillsWant: ['Python', 'Django', 'Machine Learning'],
      normalizedSkillsHave: ['javascript', 'react', 'typescript', 'css'],
      normalizedSkillsWant: ['python', 'django', 'machine learning'],
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: 'b2222222-2222-2222-2222-222222222222',
      name: 'bob',
      email: 'bob@skillswap.com',
      password: hashedPassword,
      bio: 'Backend engineer specializing in Python and Django. 3 years experience.',
      skillsHave: ['Python', 'Django', 'PostgreSQL', 'Docker'],
      skillsWant: ['JavaScript', 'React', 'AWS'],
      normalizedSkillsHave: ['python', 'django', 'postgresql', 'docker'],
      normalizedSkillsWant: ['javascript', 'react', 'aws'],
    },
  });

  const charlie = await prisma.user.create({
    data: {
      id: 'c3333333-3333-3333-3333-333333333333',
      name: 'charlie',
      email: 'charlie@skillswap.com',
      password: hashedPassword,
      bio: 'Full-stack developer and DevOps enthusiast. Building scalable systems.',
      skillsHave: ['Node.js', 'AWS', 'Kubernetes', 'Terraform'],
      skillsWant: ['Go', 'Rust', 'System Design'],
      normalizedSkillsHave: ['nodejs', 'aws', 'kubernetes', 'terraform'],
      normalizedSkillsWant: ['go', 'rust', 'system design'],
    },
  });

  const diana = await prisma.user.create({
    data: {
      id: 'd4444444-4444-4444-4444-444444444444',
      name: 'diana',
      email: 'diana@skillswap.com',
      password: hashedPassword,
      bio: 'Data scientist passionate about ML and AI. 4 years in the field.',
      skillsHave: ['Python', 'Machine Learning', 'TensorFlow', 'Pandas'],
      skillsWant: ['Deep Learning', 'NLP', 'Computer Vision'],
      normalizedSkillsHave: ['python', 'machine learning', 'tensorflow', 'pandas'],
      normalizedSkillsWant: ['deep learning', 'nlp', 'computer vision'],
    },
  });

  const eve = await prisma.user.create({
    data: {
      id: 'e5555555-5555-5555-5555-555555555555',
      name: 'eve',
      email: 'eve@skillswap.com',
      password: hashedPassword,
      bio: 'Mobile developer building cross-platform apps. Love Flutter!',
      skillsHave: ['Flutter', 'Dart', 'Firebase', 'Mobile UI'],
      skillsWant: ['React Native', 'Swift', 'Kotlin'],
      normalizedSkillsHave: ['flutter', 'dart', 'firebase', 'mobile ui'],
      normalizedSkillsWant: ['react native', 'swift', 'kotlin'],
    },
  });

  console.log('✅ Created 5 users');

  // Create a skill exchange between Alice and Bob
  const exchange = await prisma.skillExchange.create({
    data: {
      id: 'ex111111-1111-1111-1111-111111111111',
      userAId: alice.id,
      userBId: bob.id,
      skillA: 'JavaScript',
      skillB: 'Python',
      status: 'COMPLETED',
      userACompleted: true,
      userBCompleted: true,
      completedAt: new Date(),
    },
  });

  console.log('✅ Created skill exchange');

  // Create a chat between Alice and Bob
  const chat = await prisma.chatSession.create({
    data: {
      id: 'ch111111-1111-1111-1111-111111111111',
      initiatorId: alice.id,
      recipientId: bob.id,
    },
  });

  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: alice.id,
      recipientId: bob.id,
      content: 'Hey Bob! Ready to start our skill exchange?',
    },
  });

  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: bob.id,
      recipientId: alice.id,
      content: 'Absolutely! Let me know when you want to start with React.',
    },
  });

  console.log('✅ Created chat with messages');

  // Create reviews
  await prisma.review.create({
    data: {
      reviewerId: alice.id,
      revieweeId: bob.id,
      exchangeId: exchange.id,
      rating: 5,
      comment: 'Excellent teacher! Bob explained Python concepts very clearly.',
      tags: ['patient', 'knowledgeable', 'helpful'],
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: bob.id,
      revieweeId: alice.id,
      exchangeId: exchange.id,
      rating: 5,
      comment: 'Alice is amazing at React! Learned so much in our sessions.',
      tags: ['expert', 'friendly', 'organized'],
    },
  });

  console.log('✅ Created reviews');

  // Create notifications
  await prisma.notification.create({
    data: {
      senderId: charlie.id,
      recipientId: alice.id,
      message: 'Charlie wants to learn React from you!',
    },
  });

  console.log('✅ Created notifications');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('Test Users:');
  console.log('1. alice@skillswap.com - Frontend (React, TypeScript)');
  console.log('2. bob@skillswap.com - Backend (Python, Django)');
  console.log('3. charlie@skillswap.com - DevOps (AWS, Kubernetes)');
  console.log('4. diana@skillswap.com - Data Science (ML, TensorFlow)');
  console.log('5. eve@skillswap.com - Mobile (Flutter, Dart)');
  console.log('\nPassword for all: Test123!@#\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
