import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The two columns from lg, shared with the watch page's loading skeleton.
export const WATCH_COLUMNS_CLASS = "lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-6";

// The watch page's placement. Below lg one column in reading order: player,
// details, Suggested videos, Comments. From lg, when there are suggestions, two
// columns: the player, details and Comments on the left and the suggestions in a
// sticky right column of 400px. In theater mode (the player frame carries
// data-theater) the player spans both columns and the suggestions start beside
// the details. The DOM order is the small-screen order, so focus order matches it.
export function WatchLayout({
  player,
  details,
  suggested,
  comments,
}: {
  player: ReactNode;
  details: ReactNode;
  suggested?: ReactNode;
  comments?: ReactNode;
}) {
  const columns = suggested != null;

  return (
    <article
      className={cn(
        "grid gap-4 pb-8",
        // The last row is flexible so a suggestions column taller than the left
        // column grows the space below Comments, never a gap between rows.
        columns && cn("group/watch lg:grid-rows-[auto_auto_1fr]", WATCH_COLUMNS_CLASS),
      )}
    >
      <div
        className={cn(
          "grid min-w-0 gap-4",
          columns && "lg:col-start-1 lg:row-start-1 lg:group-has-data-theater/watch:col-span-2",
        )}
      >
        {player}
      </div>
      <div className={cn("grid min-w-0 gap-4", columns && "lg:col-start-1 lg:row-start-2")}>{details}</div>
      {columns && (
        <div
          // Sticky just under the h-14 top bar (3.5rem + 1rem), at most the
          // screen's height below it; the padding keeps the links' focus rings
          // inside the scrolling box, which would clip them.
          className={cn(
            "min-w-0",
            "lg:sticky lg:top-18 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto lg:p-1.5",
            "lg:group-has-data-theater/watch:row-span-2 lg:group-has-data-theater/watch:row-start-2",
          )}
        >
          {suggested}
        </div>
      )}
      {comments != null && (
        <div className={cn("grid min-w-0 content-start gap-4", columns && "lg:col-start-1 lg:row-start-3")}>
          {comments}
        </div>
      )}
    </article>
  );
}
