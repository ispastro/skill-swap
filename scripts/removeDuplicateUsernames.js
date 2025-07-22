// scripts/removeDuplicateUsernames.js
import prisma from '../src/config/db.js'; // Adjust the path as needed

async function removeDuplicates() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Set();
  let renameCount = 1;

  for (const user of users) {
    if (seen.has(user.username)) {
      const newUsername = `${user.username}_${renameCount++}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { username: newUsername },
      });
      console.log(`Renamed duplicate ${user.username} → ${newUsername}`);
    } else {
      seen.add(user.username);
    }
  }

  console.log("✅ Duplicate usernames fixed.");
}

removeDuplicates()
  .catch((e) => {
    console.error("❌ Error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
