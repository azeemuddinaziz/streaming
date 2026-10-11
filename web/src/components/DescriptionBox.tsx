"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Long enough that two lines would cut it off, by characters or by line breaks.
const COLLAPSE_AFTER = 160;

export function needsCollapse(description: string): boolean {
  return description.length > COLLAPSE_AFTER || description.split("\n").length > 2;
}

// The View count and date, with the description under them, cut to two lines until opened.
export function DescriptionBox({
  views,
  date,
  description,
}: {
  views: number;
  date: string;
  description: string | null;
}) {
  const id = useId();
  const text = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  // The character count is a guess at two lines; the measured clip catches what it misses
  // (a narrow screen wraps sooner).
  const collapsible = description !== null && (needsCollapse(description) || clipped);

  useEffect(() => {
    const element = text.current;
    if (element && !open) setClipped(element.scrollHeight > element.clientHeight + 1);
  }, [description, open]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">
        <span className="font-mono">{views.toLocaleString("en")}</span> {views === 1 ? "view" : "views"} · {date}
      </p>
      {description && (
        <>
          <p
            id={id}
            ref={text}
            className={`mt-2 whitespace-pre-wrap break-words text-sm ${open ? "" : "line-clamp-2"}`}
          >
            {description}
          </p>
          {collapsible && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto px-0"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
            >
              {open ? "Show less" : "Show more"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
