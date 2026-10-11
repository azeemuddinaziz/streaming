"use client";

import Link from "next/link";
import { useState } from "react";
import { reactToComment, reactToVideo, type ReactionKind } from "@/lib/api-client";

type Props = {
  videoId: string;
  // Given, the buttons react to this Comment or Reply instead of the Video.
  commentId?: string;
  signedIn: boolean;
  likes: number;
  // Only given to the Video's owner.
  dislikes?: number;
  myReaction: ReactionKind | null;
};

// Like and Dislike of a Video or a Comment. Pressing the active one takes the Reaction away. The page
// updates at once and goes back, with a message, if the API refuses.
export function ReactionButtons(props: Props) {
  const { videoId, commentId, signedIn } = props;
  const [likes, setLikes] = useState(props.likes);
  const [dislikes, setDislikes] = useState(props.dislikes);
  const [mine, setMine] = useState(props.myReaction);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function press(kind: ReactionKind) {
    if (busy) return;
    const before = { likes, dislikes, mine };
    const next = mine === kind ? null : kind;
    const bump = (n: number, from: boolean, to: boolean) => n - (from ? 1 : 0) + (to ? 1 : 0);

    setBusy(true);
    setMessage(undefined);
    setMine(next);
    setLikes(bump(likes, mine === "LIKE", next === "LIKE"));
    if (dislikes !== undefined) setDislikes(bump(dislikes, mine === "DISLIKE", next === "DISLIKE"));

    const result = commentId ? await reactToComment(videoId, commentId, next) : await reactToVideo(videoId, next);
    setBusy(false);
    if (result.ok) {
      setLikes(result.state.likes);
      setDislikes(result.state.dislikes);
      setMine(result.state.myReaction);
    } else {
      setLikes(before.likes);
      setDislikes(before.dislikes);
      setMine(before.mine);
      setMessage(result.message);
    }
  }

  const count = (n: number) => n.toLocaleString("en");

  return (
    <div className="reactions" role="group" aria-label={commentId ? "React to this comment" : "React to this video"}>
      <button
        className="button button-secondary"
        type="button"
        aria-pressed={mine === "LIKE"}
        disabled={!signedIn}
        onClick={() => press("LIKE")}
      >
        Like · {count(likes)}
      </button>
      <button
        className="button button-secondary"
        type="button"
        aria-pressed={mine === "DISLIKE"}
        disabled={!signedIn}
        onClick={() => press("DISLIKE")}
      >
        Dislike{dislikes !== undefined && ` · ${count(dislikes)}`}
      </button>
      {!signedIn && (
        <span className="hint">
          <Link href="/sign-in">Sign in to react</Link>
        </span>
      )}
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
