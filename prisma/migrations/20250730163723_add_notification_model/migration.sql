-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- RenameForeignKey
ALTER TABLE "Message" RENAME CONSTRAINT "message_recipient_fkey" TO "message_sender_fkey";

-- RenameForeignKey
ALTER TABLE "Message" RENAME CONSTRAINT "message_sender_fkey" TO "message_recipient_fkey";

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "notification_sender_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "notification_recipient_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
