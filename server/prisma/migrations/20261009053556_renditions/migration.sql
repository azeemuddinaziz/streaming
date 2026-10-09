-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "masterPlaylistKey" TEXT,
ADD COLUMN     "thumbnailKey" TEXT;

-- CreateTable
CREATE TABLE "Rendition" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bandwidth" INTEGER NOT NULL,
    "playlistKey" TEXT NOT NULL,

    CONSTRAINT "Rendition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rendition_videoId_height_key" ON "Rendition"("videoId", "height");

-- AddForeignKey
ALTER TABLE "Rendition" ADD CONSTRAINT "Rendition_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
