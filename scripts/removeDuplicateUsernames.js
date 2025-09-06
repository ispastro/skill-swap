// scripts/removeDuplicateUsernames.js
import prisma from '../src/config/db.js'; // Adjust the path as needed

async function removeDuplicates() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Set();
  let renameCount = 1;

  for (const user of users) {
    if (seen.has(user.name)) {
      const newName = `${user.name}_${renameCount++}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newName },
      });
      console.log(`Renamed duplicate ${user.name} → ${newName}`);
    } else {
      seen.add(user.name);
    }
  }

  console.log("✅ Duplicate names fixed.");
}

removeDuplicates()
  .catch((e) => {
    console.error("❌ Error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
