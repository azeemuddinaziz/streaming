"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { InfiniteList } from "@/components/InfiniteList";
import { SubscribeButton } from "@/components/SubscribeButton";
import { RowListSkeleton } from "@/components/skeletons";
import { getSubscriptionsPage, setSubscription, type SubscribedChannel } from "@/lib/api-client";

const NOUN = { singular: "channel", plural: "channels" };

function isSubscribedChannel(value: unknown): value is SubscribedChannel {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.subscribers === "number";
}

const getId = (channel: SubscribedChannel) => channel.name;
const skeleton = <RowListSkeleton count={3} />;

function Empty() {
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border bg-card p-6">
      <p>You have not subscribed to any channels yet.</p>
      <Link className="text-primary underline underline-offset-4" href="/">
        Find something to watch
      </Link>
    </div>
  );
}

// The signed-in person's Subscriptions: page 1 from the server, the rest from the
// API. Unsubscribing takes the row away at once, with an Undo that subscribes again.
export function SubscriptionList({ channels, hasMore }: { channels: SubscribedChannel[]; hasMore: boolean }) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

  const setHidden = useCallback((name: string, hide: boolean) => {
    setRemoved((previous) => {
      const next = new Set(previous);
      if (hide) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  const undo = useCallback(
    async (name: string) => {
      const result = await setSubscription(name, true);
      if (result.ok) setHidden(name, false);
      else toast.error(`Could not subscribe to ${name} again. ${result.message}`);
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
          subscribers={channel.subscribers}
          subscribed
          onChange={(state) => {
            if (state.subscribed) return;
            setHidden(channel.name, true);
            toast(`Unsubscribed from ${channel.name}`, {
              action: { label: "Undo", onClick: () => void undo(channel.name) },
            });
          }}
        />
      </li>
    ),
    [setHidden, undo],
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
      empty={<Empty />}
    />
  );
}
