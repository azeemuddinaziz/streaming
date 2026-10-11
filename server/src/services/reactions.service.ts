import { HttpError } from "../errors.ts";
import { enrich } from "../lib/wide-event.ts";
import { CommentRepository } from "../repositories/comments.repository.ts";
import { ReactionRepository } from "../repositories/reactions.repository.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";
import { commentableVideo, commentNotFound, requireCommentsOn } from "./comments.service.ts";

const KINDS = ["LIKE", "DISLIKE"] as const;
// A User may change this many Reactions in any window of this length.
const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60_000;

// The Video a person may react to: one they can watch, once it is ready. A
// private Video is only the owner's; like a missing or deleted one it is not
// found for anyone else.
async function reactableVideo(userId: string, videoId: string) {
  enrich({ videoId });
  const video = await VideoRepository.findForComments(videoId);
  const isOwner = video?.channel.userId === userId;
  if (!video || (video.visibility === "PRIVATE" && !isOwner)) {
    throw new HttpError(404, "Video not found.");
  }
  if (video.status !== "READY") throw new HttpError(409, "This video is not ready for reactions.");
  return { isOwner };
}

// Refuses the 31st change inside a minute, counted from the Reaction table
// itself, so a Reaction taken away no longer counts. The caller is told to wait
// until the oldest of the counted changes leaves the window.
async function limitWriting(userId: string, now = Date.now()) {
  const recent = await ReactionRepository.recentlyChanged(userId, new Date(now - WRITE_WINDOW_MS), WRITE_LIMIT);
  if (recent.length < WRITE_LIMIT) return;

  const frees = recent[WRITE_LIMIT - 1]!.getTime() + WRITE_WINDOW_MS;
  const seconds = Math.min(Math.max(Math.ceil((frees - now) / 1000), 1), WRITE_WINDOW_MS / 1000);
  enrich({ rateLimited: true });
  throw new HttpError(429, "You are reacting too fast. Slow down and try again shortly.", {
    "Retry-After": String(seconds),
  });
}

// What the person sees afterwards: the Like count and their own Reaction, and
// the Dislike count only when they own the Video (GLOSSARY, Dislike).
async function seenBy(userId: string, videoId: string, isOwner: boolean) {
  const { likes, dislikes } = (await ReactionRepository.countsFor([videoId])).get(videoId)!;
  const myReaction = await ReactionRepository.find(userId, videoId);
  return isOwner ? { likes, dislikes, myReaction } : { likes, myReaction };
}

function parseKind(kind: unknown) {
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    throw new HttpError(400, "A reaction is LIKE or DISLIKE.");
  }
  enrich({ reactionKind: kind });
  return kind as (typeof KINDS)[number];
}

// The Comment a person may react to, on a Video they may comment on with
// Comments on. Missing, on another Video, or deleted and not listed is not
// found; a hidden one, a placeholder, or a Reply under a hidden or deleted
// parent refuses for everyone (the author included) with 409.
async function reactableComment(userId: string, videoId: string, commentId: string) {
  enrich({ commentId });
  const { isOwner, commentsEnabled } = await commentableVideo(userId, videoId);
  requireCommentsOn(commentsEnabled);
  const comment = await CommentRepository.findForReaction(videoId, commentId);
  if (!comment) throw commentNotFound();
  const refused = () => new HttpError(409, "That comment can no longer be reacted to.");
  if (comment.deletedAt) {
    // Only a deleted Comment still listed, as a placeholder, is more than "not found".
    const listed = comment.parentId === null && (await CommentRepository.findThread(videoId, commentId, userId));
    throw listed ? refused() : commentNotFound();
  }
  const { parent } = comment;
  if (comment.hiddenAt || parent?.hiddenAt || parent?.deletedAt) throw refused();
  return { isOwner };
}

// What the person sees afterwards for a Comment, as `seenBy` does for a Video.
async function commentSeenBy(userId: string, commentId: string, isOwner: boolean) {
  const { likes, dislikes } = (await ReactionRepository.countsForComments([commentId])).get(commentId)!;
  const myReaction = await ReactionRepository.findOnComment(userId, commentId);
  return isOwner ? { likes, dislikes, myReaction } : { likes, myReaction };
}

export const ReactionService = {
  // Sets the User's Reaction to a Comment, replacing the one they had. The
  // write limit is the one Video Reactions use: it counts every Reaction row.
  async setOnComment(userId: string, videoId: string, commentId: string, kindParam: unknown) {
    enrich({ reactionAction: "set" });
    const kind = parseKind(kindParam);
    const { isOwner } = await reactableComment(userId, videoId, commentId);
    const from = await ReactionRepository.findOnComment(userId, commentId);
    enrich({ reactionFrom: from });
    await limitWriting(userId);
    if (from !== kind) await ReactionRepository.setOnComment(userId, commentId, kind);
    return await commentSeenBy(userId, commentId, isOwner);
  },

  // Takes the User's Reaction to a Comment away. Having none is not an error.
  async removeFromComment(userId: string, videoId: string, commentId: string) {
    enrich({ reactionAction: "remove" });
    const { isOwner } = await reactableComment(userId, videoId, commentId);
    enrich({ reactionFrom: await ReactionRepository.findOnComment(userId, commentId) });
    await ReactionRepository.removeFromComment(userId, commentId);
    return await commentSeenBy(userId, commentId, isOwner);
  },

  // Sets the User's Reaction to a Video, replacing the one they had.
  async set(userId: string, videoId: string, kind: unknown) {
    enrich({ reactionAction: "set" });
    const parsed = parseKind(kind);
    const { isOwner } = await reactableVideo(userId, videoId);
    const from = await ReactionRepository.find(userId, videoId);
    enrich({ reactionFrom: from });
    // Last, so a request that would fail anyway is told why, not to slow down.
    await limitWriting(userId);
    // Repeating the kind they already have changes nothing, not even `updatedAt`.
    if (from !== parsed) await ReactionRepository.set(userId, videoId, parsed);
    return await seenBy(userId, videoId, isOwner);
  },

  // Takes the User's Reaction away. Having none is not an error.
  async remove(userId: string, videoId: string) {
    enrich({ reactionAction: "remove" });
    const { isOwner } = await reactableVideo(userId, videoId);
    enrich({ reactionFrom: await ReactionRepository.find(userId, videoId) });
    await ReactionRepository.remove(userId, videoId);
    return await seenBy(userId, videoId, isOwner);
  },
};
