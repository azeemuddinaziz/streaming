import { HttpError } from "../errors.ts";
import { enrich } from "../lib/wide-event.ts";
import { ReactionRepository } from "../repositories/reactions.repository.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";

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

export const ReactionService = {
  // Sets the User's Reaction to a Video, replacing the one they had.
  async set(userId: string, videoId: string, kind: unknown) {
    enrich({ reactionAction: "set" });
    if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
      throw new HttpError(400, "A reaction is LIKE or DISLIKE.");
    }
    enrich({ reactionKind: kind });
    const { isOwner } = await reactableVideo(userId, videoId);
    const from = await ReactionRepository.find(userId, videoId);
    enrich({ reactionFrom: from });
    // Last, so a request that would fail anyway is told why, not to slow down.
    await limitWriting(userId);
    // Repeating the kind they already have changes nothing, not even `updatedAt`.
    if (from !== kind) await ReactionRepository.set(userId, videoId, kind as (typeof KINDS)[number]);
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
