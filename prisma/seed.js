// prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      username: 'HaileDev',
      email: 'haile@example.com',
      password: 'hashedpassword',
      bio: 'Frontend pro from Addis',
      skillsHave: ['React', 'Next.js'],
      skillsWant: ['Node.js', 'Prisma'],
    },
  });

  console.log('🌱 Seeded default user');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
