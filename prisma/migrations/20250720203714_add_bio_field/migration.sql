-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "skillsHave" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skillsWant" TEXT[] DEFAULT ARRAY[]::TEXT[];
