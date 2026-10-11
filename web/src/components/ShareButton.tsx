"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
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
// recorded or counted (GLOSSARY, Share link).
export function ShareButton({ withStartTime = false, privateVideo = false, subject, title }: Props) {
  const popoverId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [position, setPosition] = useState(0);
  const [useStart, setUseStart] = useState(false);
  const [base, setBase] = useState("");
  const [status, setStatus] = useState<string>();

  // Decided after mount so server and browser markup agree.
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  // Escape closes the popover wherever focus is, and focus goes back to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    setBase(window.location.origin + window.location.pathname);
    const player = withStartTime ? document.querySelector<HTMLVideoElement>("video.player") : null;
    setPosition(Math.floor(player?.currentTime ?? 0));
    setUseStart(false);
    setStatus(undefined);
    setOpen(true);
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
    <div className="share">
      <button
        ref={trigger}
        className="button button-secondary"
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        Share
      </button>
      <div id={popoverId} className="share-popover" role="dialog" aria-label={`Share this ${subject}`} hidden={!open}>
        {privateVideo ? (
          <p>
            Only you can watch this. <Link href="/studio">Change Visibility to share it</Link>.
          </p>
        ) : (
          <>
            <label className="share-label" htmlFor={`${popoverId}-link`}>
              Link
            </label>
            <div className="share-row">
              <input
                id={`${popoverId}-link`}
                ref={field}
                className="share-field"
                type="text"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button className="button" type="button" onClick={copy}>
                Copy
              </button>
            </div>
            {withStartTime && (
              <label className="share-start">
                <input type="checkbox" checked={useStart} onChange={(event) => setUseStart(event.target.checked)} />
                Start at {formatTimestamp(position)}
              </label>
            )}
            {canShare && (
              <button className="button button-secondary" type="button" onClick={share}>
                Share…
              </button>
            )}
            <p className="hint" role="status">
              {status}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
