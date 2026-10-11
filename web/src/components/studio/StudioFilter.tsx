import Link from "next/link";
import { cn } from "@/lib/utils";
import { studioHref, type StudioStatus } from "@/lib/studio-list";

const OPTIONS: { label: string; status: StudioStatus | undefined }[] = [
  { label: "All", status: undefined },
  { label: "Processing", status: "PROCESSING" },
  { label: "Ready", status: "READY" },
  { label: "Failed", status: "FAILED" },
];

// The status filter. Plain links, so the choice is the address: it survives a
// refresh and Back, and works before any script runs. Choosing one starts at page 1.
export function StudioFilter({ status }: { status: StudioStatus | undefined }) {
  return (
    <nav aria-label="Filter by status">
      <ul className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const current = option.status === status;
          return (
            <li key={option.label}>
              <Link
                href={studioHref({ page: 1, status: option.status })}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-secondary",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
