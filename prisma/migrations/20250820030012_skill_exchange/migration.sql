/*
  Warnings:

  - Added the required column `exchangeId` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('PENDING', 'COMPLETION_REQUESTED', 'COMPLETED', 'DISPUTED');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "exchangeId" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[];

-- CreateTable
CREATE TABLE "SkillExchange" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "skillA" TEXT NOT NULL,
    "skillB" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING',
    "userACompleted" BOOLEAN NOT NULL DEFAULT false,
    "userBCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillExchange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "SkillExchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExchange" ADD CONSTRAINT "SkillExchange_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExchange" ADD CONSTRAINT "SkillExchange_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
