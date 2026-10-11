-- Nothing is hard-deleted (ADR 0001): keep the Reaction foreign keys RESTRICT.
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_videoId_fkey";
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_commentId_fkey";
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
