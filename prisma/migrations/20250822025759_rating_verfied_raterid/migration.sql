-- AlterTable
ALTER TABLE "SkillVerification" ADD COLUMN     "raterId" TEXT,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedCount" INTEGER NOT NULL DEFAULT 0;
