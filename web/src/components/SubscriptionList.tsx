"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { InfiniteList } from "@/components/InfiniteList";
import { SubscribeButton } from "@/components/SubscribeButton";
import { SubscriptionRowsSkeleton } from "@/components/skeletons";
import { SubscriptionsEmpty } from "@/components/SubscriptionsEmpty";
import { getSubscriptionsPage, setSubscription, type SubscribedChannel } from "@/lib/api-client";

const NOUN = { singular: "channel", plural: "channels" };

function isSubscribedChannel(value: unknown): value is SubscribedChannel {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.subscribers === "number";
}

const getId = (channel: SubscribedChannel) => channel.name;
const skeleton = <SubscriptionRowsSkeleton count={3} />;

// The signed-in person's Subscriptions: page 1 from the server, the rest from the
// API. Unsubscribing takes the row away at once, with an Undo that subscribes again.
export function SubscriptionList({ channels, hasMore }: { channels: SubscribedChannel[]; hasMore: boolean }) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  // Counts the API last returned, so a row brought back by Undo is not stale.
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});

  const setHidden = useCallback((name: string, hide: boolean) => {
    setRemoved((previous) => {
      const next = new Set(previous);
      if (hide) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  const undo = useCallback(
    async (name: string): Promise<void> => {
      const result = await setSubscription(name, true);
      if (result.ok) {
        setCounts((previous) => ({ ...previous, [name]: result.state.subscribers }));
        setHidden(name, false);
      } else {
        toast.error(`Could not subscribe to ${name} again. ${result.message}`, {
          action: { label: "Try again", onClick: () => void undo(name) },
        });
      }
    },
    [setHidden],
  );

  const renderItem = useCallback(
    (channel: SubscribedChannel) => (
      <li
        key={channel.name}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card p-4"
      >
        <Link
          className="min-w-0 break-words text-lg font-semibold hover:underline"
          href={`/channels/${encodeURIComponent(channel.name)}`}
        >
          {channel.name}
        </Link>
        <SubscribeButton
          channelName={channel.name}
          signedIn
          isOwner={false}
          subscribers={counts[channel.name] ?? channel.subscribers}
          subscribed
          onChange={(state) => {
            if (state.subscribed) return;
            setCounts((previous) => ({ ...previous, [channel.name]: state.subscribers }));
            setHidden(channel.name, true);
            toast(`Unsubscribed from ${channel.name}`, {
              action: { label: "Undo", onClick: () => void undo(channel.name) },
            });
          }}
        />
      </li>
    ),
    [setHidden, undo, counts],
  );

  return (
    <InfiniteList
      listKey="subscriptions"
      initial={{ items: channels, page: 1, hasMore }}
      getId={getId}
      isItem={isSubscribedChannel}
      loadPage={async (page) => {
        const result = await getSubscriptionsPage(page);
        return result.ok ? { ok: true, items: result.channels, page: result.page, hasMore: result.hasMore } : result;
      }}
      renderItem={renderItem}
      skeleton={skeleton}
      noun={NOUN}
      label="Subscribed channels"
      className="my-6 grid gap-3"
      hidden={removed}
      empty={<SubscriptionsEmpty />}
    />
  );
}
