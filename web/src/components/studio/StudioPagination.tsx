import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { lastPage, pageItems, studioHref, type StudioStatus } from "@/lib/studio-list";

const LINK =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border px-3 text-sm font-medium outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring";

// Numbered pages as links (the Studio does not scroll infinitely), so each page
// has its own address. Nothing renders for a single page.
export function StudioPagination({
  page,
  total,
  status,
}: {
  page: number;
  total: number;
  status: StudioStatus | undefined;
}) {
  const last = lastPage(total);
  if (last <= 1) return null;

  return (
    <nav aria-label="Pages" className="mt-6">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <li>
            <Link className={LINK} href={studioHref({ page: page - 1, status })} rel="prev">
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
              Previous
            </Link>
          </li>
        )}
        {pageItems(page, last).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                className={cn(LINK, item === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
                href={studioHref({ page: item, status })}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {page < last && (
          <li>
            <Link className={LINK} href={studioHref({ page: page + 1, status })} rel="next">
              Next
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
