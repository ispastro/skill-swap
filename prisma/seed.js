import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.barterProposal.deleteMany();
  await prisma.user.deleteMany();

  // Seed users
  const user1 = await prisma.user.create({
    data: {
      id: 'f61c62d3-a9a2-412a-9448-62567ef1adf5', // Match initiatorId
      name: "alice",
      email: "a@example.com",
      password: "myPlainPassword123",

 // In production, hash with bcrypt
      skillsHave: ['JavaScript', 'React'],
      skillsWant: ['Python', 'Django'],
      bio: 'Frontend developer looking to learn backend',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: 'f61c62d3-a9a2-412a-9448-62567ef1adf6', // Match recipientId
      name: 'bob',
      email: 'bob@example.com',
      password: 'hashed_password',
      skillsHave: ['Python', 'Django'],
      skillsWant: ['JavaScript', 'React'],
      bio: 'Backend developer interested in frontend',
    },
  });

  // Seed a chat session
  const chat = await prisma.chatSession.create({
    data: {
      initiatorId: user1.id,
      recipientId: user2.id,
    },
  });

  // Seed a message
  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: user1.id,
      content: 'Hey Bob, want to swap JavaScript for Python skills?',
    },
  });

  // Seed a notification
  await prisma.notification.create({
    data: {
      senderId: user1.id,
      recipientId: user2.id,
      message: 'You have got matched skill with JavaScript with match skill of 85%',
    },
  });

  console.log('Seeded:', { user1, user2, chat });
}

main()
  .catch((e) => console.error('Seed error:', e))
  .finally(async () => await prisma.$disconnect());