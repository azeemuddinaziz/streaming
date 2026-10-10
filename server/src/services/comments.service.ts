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
  return { ownerId: video.channel.userId, isOwner };
}

// A deleted Comment still listed is a placeholder: it keeps its place and
// Reply count but carries no author and no text.
function present(
  comment: {
    id: string;
    parentId: string | null;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
    hiddenAt: Date | null;
    authorId: string;
    author: { name: string };
    _count: { replies: number };
  },
  ownerId: string,
  viewerId: string | undefined,
) {
  const deleted = comment.deletedAt !== null;
  return {
    id: comment.id,
    parentId: comment.parentId,
    body: deleted ? null : comment.body,
    authorName: deleted ? null : comment.author.name,
    isChannelOwner: !deleted && comment.authorId === ownerId,
    isAuthor: !deleted && viewerId !== undefined && comment.authorId === viewerId,
    deleted,
    edited: !deleted && comment.editedAt !== null,
    // Only the owner is told: an author never learns their Comment was hidden.
    hidden: !deleted && viewerId === ownerId && comment.hiddenAt !== null,
    createdAt: comment.createdAt,
    replyCount: comment._count.replies,
  };
}

const commentNotFound = () => new HttpError(404, "Comment not found.");

// The author's own live Comment; someone else's, a missing or a deleted one is not found.
async function ownComment(videoId: string, commentId: string, authorId: string) {
  const comment = await CommentRepository.findOwn(videoId, commentId, authorId);
  if (!comment) throw commentNotFound();
  return comment;
}

// Text of a Comment, as written or edited.
function commentText(body: unknown) {
  if (typeof body !== "string") throw new HttpError(400, "The comment must be text.");
  const text = body.trim();
  if (text === "") throw new HttpError(400, "Write something before posting.");
  if (text.length > BODY_MAX) {
    throw new HttpError(400, `A comment can be at most ${BODY_MAX} characters.`);
  }
  return text;
}

export const CommentService = {
  // One page of top-level Comments, newest first. A page number that is not a
  // whole number from 1 is the first page.
  async list(viewerId: string | undefined, videoId: string, pageParam: unknown) {
    enrich({ commentAction: "list" });
    const { ownerId } = await commentableVideo(viewerId, videoId);
    const parsed = Number(pageParam);
    const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;

    const rows = await CommentRepository.listTopLevel(videoId, viewerId, (page - 1) * PAGE_SIZE, PAGE_SIZE);
    const comments = rows.slice(0, PAGE_SIZE).map((row) => present(row, ownerId, viewerId));
    enrich({ commentCount: comments.length });
    return { comments, page, hasMore: rows.length > PAGE_SIZE };
  },

  // The Replies to a top-level Comment, oldest first.
  async listReplies(viewerId: string | undefined, videoId: string, commentId: string) {
    enrich({ commentAction: "replies", commentParentId: commentId });
    const { ownerId } = await commentableVideo(viewerId, videoId);
    if (!(await CommentRepository.findThread(videoId, commentId, viewerId))) {
      throw commentNotFound();
    }

    const replies = (await CommentRepository.listReplies(commentId, viewerId)).map((row) => present(row, ownerId, viewerId));
    enrich({ commentCount: replies.length });
    return { replies };
  },

  // Writes a Comment, or a Reply when `parentId` names one. A Reply to a Reply
  // attaches to the same top-level Comment, so conversations stay one level deep.
  async create(authorId: string, videoId: string, body: unknown, parentId: unknown) {
    enrich({ commentAction: "create" });
    const text = commentText(body);
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
    return present(comment, ownerId, authorId);
  },

  // Changes the author's own Comment. Someone else's, a missing or a deleted
  // Comment is not found. The earlier wording is not kept.
  async edit(authorId: string, videoId: string, commentId: string, body: unknown) {
    enrich({ commentAction: "edit", commentId });
    const { ownerId } = await commentableVideo(authorId, videoId);
    const comment = await ownComment(videoId, commentId, authorId);
    // Someone else's Comment is not found whatever they send; only then is the text checked.
    const text = commentText(body);

    // Saving the same words is not an edit.
    if (text !== comment.body && !(await CommentRepository.edit(commentId, authorId, text))) {
      throw commentNotFound();
    }
    const changed = await CommentRepository.findWithAuthor(commentId, authorId);
    if (!changed || changed.deletedAt) throw commentNotFound();
    return present(changed, ownerId, authorId);
  },

  // The Comments and Replies the owner has hidden, newest first, with how many
  // there are. A page number that is not a whole number from 1 is the first page.
  async listHidden(viewerId: string, videoId: string, pageParam: unknown) {
    enrich({ commentAction: "hidden" });
    const { isOwner } = await commentableVideo(viewerId, videoId);
    if (!isOwner) throw commentNotFound();
    const parsed = Number(pageParam);
    const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;

    const [rows, total] = await Promise.all([
      CommentRepository.listHidden(videoId, viewerId, (page - 1) * PAGE_SIZE, PAGE_SIZE),
      CommentRepository.countHidden(videoId),
    ]);
    const comments = rows.slice(0, PAGE_SIZE).map((row) => present(row, viewerId, viewerId));
    enrich({ commentCount: comments.length });
    return { comments, page, hasMore: rows.length > PAGE_SIZE, total };
  },

  // The Video's owner hides a Comment or Reply, or brings it back. Anyone else
  // is told it is not found. Hiding is not deletion.
  async setHidden(viewerId: string, videoId: string, commentId: string, hidden: boolean) {
    enrich({ commentAction: hidden ? "hide" : "unhide", commentId });
    const { isOwner } = await commentableVideo(viewerId, videoId);
    if (!isOwner || !(await CommentRepository.exists(videoId, commentId))) throw commentNotFound();
    await CommentRepository.setHidden(commentId, hidden);
  },

  // Deletes the author's own Comment. It is only flagged (ADR 0001). A Comment
  // with Replies stays listed as a placeholder, which the listing decides.
  async remove(authorId: string, videoId: string, commentId: string) {
    enrich({ commentAction: "delete", commentId });
    await commentableVideo(authorId, videoId);
    await ownComment(videoId, commentId, authorId);
    if (!(await CommentRepository.softDelete(commentId, authorId))) throw commentNotFound();
  },
};
