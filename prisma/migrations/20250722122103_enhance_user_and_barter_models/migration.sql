/*
  Warnings:

  - You are about to alter the column `bio` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'declined');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "bio" SET DATA TYPE VARCHAR(255);

-- CreateTable
CREATE TABLE "BarterProposal" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "offer" VARCHAR(255) NOT NULL,
    "request" VARCHAR(255) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarterProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "BarterProposal" ADD CONSTRAINT "BarterProposal_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarterProposal" ADD CONSTRAINT "BarterProposal_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
