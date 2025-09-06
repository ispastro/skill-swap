-- AlterTable
ALTER TABLE "User" ADD COLUMN     "normalizedSkillsHave" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "normalizedSkillsWant" TEXT[] DEFAULT ARRAY[]::TEXT[];
