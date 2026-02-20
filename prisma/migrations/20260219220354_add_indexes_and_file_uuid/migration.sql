/*
  Warnings:

  - The primary key for the `File` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `BarterProposal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BarterProposal" DROP CONSTRAINT "BarterProposal_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "BarterProposal" DROP CONSTRAINT "BarterProposal_toUserId_fkey";

-- AlterTable
ALTER TABLE "File" DROP CONSTRAINT "File_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "File_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "File_id_seq";

-- DropTable
DROP TABLE "BarterProposal";

-- DropEnum
DROP TYPE "ProposalStatus";

-- CreateIndex
CREATE INDEX "ChatSession_initiatorId_idx" ON "ChatSession"("initiatorId");

-- CreateIndex
CREATE INDEX "ChatSession_recipientId_idx" ON "ChatSession"("recipientId");

-- CreateIndex
CREATE INDEX "File_uploaderId_idx" ON "File"("uploaderId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");
