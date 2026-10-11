"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/utils";
import { isActive, sidebarItems } from "@/lib/nav";
import { signInHref } from "@/lib/return-address";

// The destinations, in the in-flow sidebar and in the overlay. The active one
// carries aria-current and is also bold with a bar, so colour is not the only cue.
export function SidebarNav({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="grid gap-1">
      {sidebarItems(signedIn).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm text-foreground no-underline hover:bg-accent hover:text-foreground",
              active ? "border-primary bg-secondary font-semibold" : "border-transparent",
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
      {!signedIn && (
        <Link
          href={signInHref("/subscriptions")}
          onClick={onNavigate}
          className="mt-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          Sign in to see your subscriptions
        </Link>
      )}
    </nav>
  );
}
