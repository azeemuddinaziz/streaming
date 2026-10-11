"use client";

import { Share2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildShareLink, formatTimestamp } from "@/lib/share-link";

type Props = {
  // On a watch page: offer "Start at <time>" from the player's position.
  withStartTime?: boolean;
  // The Video is PRIVATE (so the viewer is its owner): no link, only a note.
  privateVideo?: boolean;
  // What the link is to, for the accessible name and the share sheet.
  subject: "video" | "channel";
  title: string;
};

// Share control for a Video or a Channel: a popover with the link to copy and,
// where the browser has one, the device's share sheet. A link only; nothing is
// recorded or counted (GLOSSARY, Share link). Radix closes it on Escape and
// returns focus to the button.
export function ShareButton({ withStartTime = false, privateVideo = false, subject, title }: Props) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [canShare, setCanShare] = useState(false);
  const [position, setPosition] = useState(0);
  const [useStart, setUseStart] = useState(false);
  const [base, setBase] = useState("");
  const [status, setStatus] = useState<string>();

  // Decided after mount so server and browser markup agree.
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  // Each opening starts fresh, from the player's position at that moment.
  function onOpenChange(open: boolean) {
    if (!open) return;
    setBase(window.location.origin + window.location.pathname);
    const player = withStartTime ? document.querySelector<HTMLVideoElement>("video.player") : null;
    setPosition(Math.floor(player?.currentTime ?? 0));
    setUseStart(false);
    setStatus(undefined);
  }

  const link = buildShareLink(base, "", withStartTime && useStart ? position : undefined);

  async function copy() {
    field.current?.select();
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied");
    } catch {
      // No Clipboard API (or refused): the field is selected for the person to copy.
      setStatus("Press Ctrl+C (⌘C on a Mac) to copy the selected link");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url: link });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <Share2Icon aria-hidden="true" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        role="dialog"
        aria-label={`Share this ${subject}`}
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      >
        {privateVideo ? (
          <p className="text-sm">
            Only you can watch this.{" "}
            <Link className="text-primary underline underline-offset-4" href="/studio">
              Change Visibility to share it
            </Link>
            .
          </p>
        ) : (
          <>
            <Label htmlFor={`${id}-link`} className="text-muted-foreground">
              Link
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-link`}
                ref={field}
                type="text"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" onClick={copy}>
                Copy
              </Button>
            </div>
            {withStartTime && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-start`}
                  checked={useStart}
                  onCheckedChange={(checked) => setUseStart(checked === true)}
                />
                <Label htmlFor={`${id}-start`}>Start at {formatTimestamp(position)}</Label>
              </div>
            )}
            {canShare && (
              <Button type="button" variant="outline" onClick={share}>
                Share…
              </Button>
            )}
            <p className="min-h-5 text-sm text-muted-foreground" role="status">
              {status}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
