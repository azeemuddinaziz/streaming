"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useState } from "react";
import { SignInLink } from "@/components/SignInLink";
import { Button } from "@/components/ui/button";
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

  const pressed = "aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:[&_svg]:fill-current";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={commentId ? "React to this comment" : "React to this video"}
    >
      <Button
        type="button"
        variant="outline"
        size={commentId ? "sm" : "default"}
        className={pressed}
        aria-pressed={mine === "LIKE"}
        disabled={!signedIn}
        onClick={() => press("LIKE")}
      >
        <ThumbsUpIcon aria-hidden="true" />
        Like · {count(likes)}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={commentId ? "sm" : "default"}
        className={pressed}
        aria-pressed={mine === "DISLIKE"}
        disabled={!signedIn}
        onClick={() => press("DISLIKE")}
      >
        <ThumbsDownIcon aria-hidden="true" />
        Dislike{dislikes !== undefined && ` · ${count(dislikes)}`}
      </Button>
      {!signedIn && (
        <span className="text-sm text-muted-foreground">
          <SignInLink>
            Sign in to react
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
