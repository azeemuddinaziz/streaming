import { AlertTriangleIcon, LoaderCircleIcon, LockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type Kind = "processing" | "failed" | "not-found" | "unavailable";

const NOTICES: Record<Kind, { icon: typeof LoaderCircleIcon; heading: string; role: "status" | "alert" }> = {
  processing: { icon: LoaderCircleIcon, heading: "Still processing", role: "status" },
  failed: { icon: AlertTriangleIcon, heading: "Processing failed", role: "status" },
  "not-found": { icon: SearchXIcon, heading: "Video not found", role: "status" },
  unavailable: { icon: AlertTriangleIcon, heading: "Could not load this video", role: "alert" },
};

// What stands where the player would be when there is nothing to play. Each state has its own
// icon and heading, so none is told apart by color alone (docs/design.md).
export function WatchNotice({ kind }: { kind: Kind }) {
  const { icon: Icon, heading, role } = NOTICES[kind];
  // With a Video the page's own title is the h1; without one this is the page.
  const Heading = kind === "processing" || kind === "failed" ? "h2" : "h1";
  let body: ReactNode;
  switch (kind) {
    case "processing":
      body = "This video is still being prepared. Come back in a little while.";
      break;
    case "failed":
      body = (
        <>
          Processing this video failed. <Link className="text-primary underline underline-offset-4" href="/studio">Retry it from your studio</Link>.
        </>
      );
      break;
    case "not-found":
      body = (
        <>
          This video does not exist, or it is private.{" "}
          <Link className="text-primary underline underline-offset-4" href="/">Back to StreamSouk</Link>
        </>
      );
      break;
    case "unavailable":
      body = "Try again in a moment.";
      break;
  }

  return (
    <div
      role={role}
      data-kind={kind}
      className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-8 text-center"
    >
      <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <Heading className="font-sans text-xl font-semibold">{heading}</Heading>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

// Shown to the owner of a PRIVATE Video: nobody else can open this page.
export function PrivateBadge() {
  return (
    <Badge variant="outline" className="gap-1">
      <LockIcon aria-hidden="true" />
      Private · only you can watch this
    </Badge>
  );
}
