import prisma from '../src/config/db.js';


const getUsers = async () => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true },
    });
    console.log('Available Users:\n');
    users.forEach((user) => {
  console.log(`ID: ${user.id}, Name: ${user.name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }
};

getUsers();
