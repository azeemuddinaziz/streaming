"use client";

import Link from "next/link";
import { useState } from "react";
import { setSubscription } from "@/lib/api-client";

type Props = {
  channelName: string;
  signedIn: boolean;
  // The signed-in person owns this Channel: they see the count only.
  isOwner: boolean;
  subscribers: number;
  subscribed: boolean;
};

// Subscribe to a Channel, or end it. The page updates at once and goes back,
// with a message, if the API refuses. Who subscribes is never shown, only how many.
export function SubscribeButton(props: Props) {
  const { channelName, signedIn, isOwner } = props;
  const [subscribers, setSubscribers] = useState(props.subscribers);
  const [subscribed, setSubscribed] = useState(props.subscribed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function toggle() {
    if (busy) return;
    const before = { subscribers, subscribed };
    const next = !subscribed;

    setBusy(true);
    setMessage(undefined);
    setSubscribed(next);
    setSubscribers(subscribers + (next ? 1 : -1));

    const result = await setSubscription(channelName, next);
    setBusy(false);
    if (result.ok) {
      setSubscribed(result.state.subscribed);
      setSubscribers(result.state.subscribers);
    } else {
      setSubscribed(before.subscribed);
      setSubscribers(before.subscribers);
      setMessage(result.message);
    }
  }

  const count = `${subscribers.toLocaleString("en")} ${subscribers === 1 ? "subscriber" : "subscribers"}`;

  return (
    <div className="subscribe">
      <span className="hint">{count}</span>
      {signedIn && !isOwner && (
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={subscribed}
          disabled={busy}
          onClick={toggle}
        >
          {subscribed ? "Subscribed" : "Subscribe"}
        </button>
      )}
      {!signedIn && (
        <span className="hint">
          <Link href="/sign-in">Sign in to subscribe</Link>
        </span>
      )}
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
