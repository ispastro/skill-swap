/*
  Warnings:

  - A unique constraint covering the columns `[userId,skill]` on the table `SkillVerification` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SkillVerification_userId_skill_key" ON "SkillVerification"("userId", "skill");
