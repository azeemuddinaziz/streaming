-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "videoId" TEXT;

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PROCESSING',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_channelId_idx" ON "Video"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_videoId_key" ON "Upload"("videoId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

