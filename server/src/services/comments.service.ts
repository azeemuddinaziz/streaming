import { HttpError } from "../errors.ts";
import { enrich } from "../lib/wide-event.ts";
import { CommentRepository } from "../repositories/comments.repository.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";

const BODY_MAX = 1000;
const PAGE_SIZE = 20;

// The Video a person may read or write Comments on: one they can watch, once
// it is ready. A private Video is only the owner's; like a missing or deleted
// one it is not found for anyone else.
async function commentableVideo(viewerId: string | undefined, videoId: string) {
  enrich({ videoId });
  const video = await VideoRepository.findForComments(videoId);
  const isOwner = viewerId !== undefined && video?.channel.userId === viewerId;
  if (!video || (video.visibility === "PRIVATE" && !isOwner)) {
    throw new HttpError(404, "Video not found.");
  }
  if (video.status !== "READY") throw new HttpError(409, "This video is not ready for comments.");
  return { ownerId: video.channel.userId };
}

function present(
  comment: {
    id: string;
    parentId: string | null;
    body: string;
    createdAt: Date;
    authorId: string;
    author: { name: string };
    _count: { replies: number };
  },
  ownerId: string,
) {
  return {
    id: comment.id,
    parentId: comment.parentId,
    body: comment.body,
    authorName: comment.author.name,
    isChannelOwner: comment.authorId === ownerId,
    createdAt: comment.createdAt,
    replyCount: comment._count.replies,
  };
}

export const CommentService = {
  // One page of top-level Comments, newest first. A page number that is not a
  // whole number from 1 is the first page.
  async list(viewerId: string | undefined, videoId: string, pageParam: unknown) {
    enrich({ commentAction: "list" });
    const { ownerId } = await commentableVideo(viewerId, videoId);
    const parsed = Number(pageParam);
    const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;

    const rows = await CommentRepository.listTopLevel(videoId, (page - 1) * PAGE_SIZE, PAGE_SIZE);
    const comments = rows.slice(0, PAGE_SIZE).map((row) => present(row, ownerId));
    enrich({ commentCount: comments.length });
    return { comments, page, hasMore: rows.length > PAGE_SIZE };
  },

  // The Replies to a top-level Comment, oldest first.
  async listReplies(viewerId: string | undefined, videoId: string, commentId: string) {
    enrich({ commentAction: "replies", commentParentId: commentId });
    const { ownerId } = await commentableVideo(viewerId, videoId);
    const parent = await CommentRepository.findVisible(videoId, commentId);
    if (!parent || parent.parentId !== null) throw new HttpError(404, "Comment not found.");

    const replies = (await CommentRepository.listReplies(commentId)).map((row) => present(row, ownerId));
    enrich({ commentCount: replies.length });
    return { replies };
  },

  // Writes a Comment, or a Reply when `parentId` names one. A Reply to a Reply
  // attaches to the same top-level Comment, so conversations stay one level deep.
  async create(authorId: string, videoId: string, body: unknown, parentId: unknown) {
    enrich({ commentAction: "create" });
    if (typeof body !== "string") throw new HttpError(400, "The comment must be text.");
    const text = body.trim();
    if (text === "") throw new HttpError(400, "Write something before posting.");
    if (text.length > BODY_MAX) {
      throw new HttpError(400, `A comment can be at most ${BODY_MAX} characters.`);
    }
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      throw new HttpError(400, "The comment to answer must be an id.");
    }

    const { ownerId } = await commentableVideo(authorId, videoId);

    let topLevelId: string | null = null;
    if (typeof parentId === "string") {
      enrich({ commentParentId: parentId });
      const target = await CommentRepository.findVisible(videoId, parentId);
      const parent = target?.parent;
      if (!target || (parent && (parent.deletedAt || parent.hiddenAt))) {
        throw new HttpError(409, "That comment can no longer be answered.");
      }
      topLevelId = target.parent ? target.parent.id : target.id;
      enrich({ commentParentId: topLevelId });
    }

    const comment = await CommentRepository.create({ videoId, authorId, parentId: topLevelId, body: text });
    enrich({ commentId: comment.id });
    return present(comment, ownerId);
  },
};
