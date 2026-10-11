import { AlertTriangleIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// What the Channel page shows instead of the Channel: an unknown name, or the API
// not answering. Each has its own icon and heading, so none rests on color alone.
export function ChannelNotice({ kind, name }: { kind: "not-found" | "unavailable"; name: string }) {
  const notFound = kind === "not-found";
  const Icon = notFound ? SearchXIcon : AlertTriangleIcon;

  return (
    <div
      role={notFound ? "status" : "alert"}
      data-kind={kind}
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center"
    >
      <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <h1 className="font-sans text-xl font-semibold">{notFound ? "Channel not found" : "Could not load this channel"}</h1>
      <p className="text-sm text-muted-foreground">
        {notFound ? "No one has this account name." : "Try again in a moment."}
      </p>
      <Button asChild variant="outline">
        {notFound ? <Link href="/">Back to StreamSouk</Link> : // A full load, so the API is asked again rather than a cached client route reused.
          <a href={`/channels/${encodeURIComponent(name)}`}>Try again</a>}
      </Button>
    </div>
  );
}
