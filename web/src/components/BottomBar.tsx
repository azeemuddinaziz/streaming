"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { bottomBarItems, isActive, isKeyboardOpen } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The bar gets out of the way of a fullscreen player and the on-screen keyboard.
function useBarHidden() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport ?? null;
    const update = () => {
      const fullscreen = document.fullscreenElement !== null;
      // Pinch-zoom shrinks the visual viewport too, so also require a focused field.
      const field = document.activeElement;
      const typing =
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        (field instanceof HTMLElement && field.isContentEditable);
      const keyboard =
        viewport !== null && typing && isKeyboardOpen(viewport.height, window.innerHeight);
      setHidden(fullscreen || keyboard);
    };
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    viewport?.addEventListener("resize", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      viewport?.removeEventListener("resize", update);
    };
  }, []);

  return hidden;
}

export function BottomBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const hidden = useBarHidden();
  if (hidden) return null;

  const items = bottomBarItems(signedIn);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="m-0 flex list-none items-end justify-around p-0">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs text-foreground no-underline hover:text-foreground",
                  active && "font-semibold",
                  item.emphasised && "-mt-3",
                )}
              >
                {item.emphasised ? (
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <NavIcon name={item.icon} className="size-6" />
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full",
                      active && "bg-secondary",
                    )}
                  >
                    <NavIcon name={item.icon} />
                  </span>
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
