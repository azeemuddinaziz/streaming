import { HttpError } from "../errors.ts";
import { enrich } from "../lib/wide-event.ts";
import { ChannelRepository } from "../repositories/channels.repository.ts";
import { SubscriptionRepository } from "../repositories/subscriptions.repository.ts";

// A User may subscribe this many times in any window of this length.
const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60_000;

// The Channel a name stands for, regardless of case; unknown is not found.
async function findChannel(name: string) {
  const owner = await ChannelRepository.findByName(name);
  if (!owner?.channel) throw new HttpError(404, "Channel not found.");
  enrich({ subscribedChannelId: owner.channel.id });
  return { channelId: owner.channel.id, ownerId: owner.id };
}

// Refuses the 31st subscribe inside a minute, counted from the Subscription
// table itself, so one ended no longer counts. The caller is told to wait until
// the oldest of the counted ones leaves the window.
async function limitWriting(userId: string, now = Date.now()) {
  const recent = await SubscriptionRepository.recentlyCreated(userId, new Date(now - WRITE_WINDOW_MS), WRITE_LIMIT);
  if (recent.length < WRITE_LIMIT) return;

  const frees = recent[WRITE_LIMIT - 1]!.getTime() + WRITE_WINDOW_MS;
  const seconds = Math.min(Math.max(Math.ceil((frees - now) / 1000), 1), WRITE_WINDOW_MS / 1000);
  enrich({ rateLimited: true });
  throw new HttpError(429, "You are subscribing too fast. Slow down and try again shortly.", {
    "Retry-After": String(seconds),
  });
}

export const SubscriptionService = {
  // Subscribes the User to the Channel. Already subscribed is not an error.
  async subscribe(userId: string, name: string) {
    enrich({ subscriptionAction: "subscribe" });
    const { channelId, ownerId } = await findChannel(name);
    if (ownerId === userId) throw new HttpError(409, "You cannot subscribe to your own channel.");
    const from = await SubscriptionRepository.exists(userId, channelId);
    enrich({ subscriptionFrom: from });
    // Only a new Subscription counts, so repeating one is never refused. The
    // limit comes last, so a request that would fail anyway is told why.
    if (!from) {
      await limitWriting(userId);
      await SubscriptionRepository.add(userId, channelId);
    }
    return { subscribed: true, subscribers: await SubscriptionRepository.count(channelId) };
  },

  // Ends the User's Subscription. Having none, or none possible, is not an error.
  async unsubscribe(userId: string, name: string) {
    enrich({ subscriptionAction: "unsubscribe" });
    const { channelId } = await findChannel(name);
    enrich({ subscriptionFrom: await SubscriptionRepository.exists(userId, channelId) });
    await SubscriptionRepository.remove(userId, channelId);
    return { subscribed: false, subscribers: await SubscriptionRepository.count(channelId) };
  },

  // The public count and the viewer's own state, for Channel and watch
  // responses. `subscribed` is null signed out; the owner's is false.
  async stateFor(channelId: string, viewerId: string | undefined) {
    return {
      subscribers: await SubscriptionRepository.count(channelId),
      subscribed: viewerId ? await SubscriptionRepository.exists(viewerId, channelId) : null,
    };
  },
};
