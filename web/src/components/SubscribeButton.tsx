"use client";

import { useState } from "react";
import { SignInLink } from "@/components/SignInLink";
import { Button } from "@/components/ui/button";
import { setSubscription } from "@/lib/api-client";

type Props = {
  channelName: string;
  signedIn: boolean;
  // The signed-in person owns this Channel: they see the count only.
  isOwner: boolean;
  subscribers: number;
  subscribed: boolean;
  // Called once the API has confirmed a change.
  onChange?: (state: { subscribed: boolean; subscribers: number }) => void;
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
      props.onChange?.(result.state);
    } else {
      setSubscribed(before.subscribed);
      setSubscribers(before.subscribers);
      setMessage(result.message);
    }
  }

  const count = `${subscribers.toLocaleString("en")} ${subscribers === 1 ? "subscriber" : "subscribers"}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm text-muted-foreground">{count}</span>
      {signedIn && !isOwner && (
        <Button
          type="button"
          variant={subscribed ? "secondary" : "default"}
          className="aria-pressed:border aria-pressed:border-primary"
          aria-pressed={subscribed}
          disabled={busy}
          onClick={toggle}
        >
          {subscribed ? "Subscribed" : "Subscribe"}
        </Button>
      )}
      {!signedIn && (
        <span className="text-sm text-muted-foreground">
          <SignInLink>
            Sign in to subscribe
          </SignInLink>
        </span>
      )}
      {message && (
        <span role="alert" className="text-sm text-destructive">
          {message}
        </span>
      )}
    </div>
  );
}
