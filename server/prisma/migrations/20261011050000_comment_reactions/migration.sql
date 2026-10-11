-- A Reaction targets a Video or a Comment, exactly one of the two.
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_videoId_fkey";
ALTER TABLE "Reaction" ALTER COLUMN "videoId" DROP NOT NULL;
ALTER TABLE "Reaction" ADD COLUMN "commentId" TEXT;

CREATE UNIQUE INDEX "Reaction_userId_commentId_key" ON "Reaction"("userId", "commentId");
CREATE INDEX "Reaction_commentId_kind_idx" ON "Reaction"("commentId", "kind");

ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma cannot express this: never both targets, never neither.
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_one_target_check" CHECK (("videoId" IS NULL) <> ("commentId" IS NULL));
