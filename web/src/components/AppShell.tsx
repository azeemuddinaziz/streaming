"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { BottomBar } from "@/components/BottomBar";
import { SidebarNav } from "@/components/SidebarNav";
import { Button } from "@/components/ui/button";
import { isWatchPath, sidebarCookie } from "@/lib/nav";

// Top bar, sidebar and bottom bar around the page. The collapsed state comes from
// a cookie, so the server render already has it and nothing flashes. On the watch
// page the sidebar is always an overlay so the player gets the width.
export function AppShell({
  accountName,
  initialCollapsed,
  children,
}: {
  accountName: string | null;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const signedIn = accountName !== null;
  const watching = isWatchPath(pathname);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Following a link from the overlay, or the browser's Back, closes it.
  useEffect(() => {
    setOverlayOpen(false);
  }, [pathname]);

  function onHamburger() {
    if (watching) {
      setOverlayOpen(true);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookie(next);
  }

  const sidebarShown = !watching && !collapsed;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={watching ? "Open navigation" : sidebarShown ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={watching ? overlayOpen : sidebarShown}
          onClick={onHamburger}
        >
          <Menu aria-hidden="true" />
        </Button>
        <Link href="/" className="font-serif text-2xl text-foreground no-underline hover:text-foreground">
          StreamSouk
        </Link>
        {/* Room for a future search field. */}
        <div className="flex-1" />
        {signedIn ? (
          <>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/upload">
                <Upload aria-hidden="true" />
                Upload
              </Link>
            </Button>
            <AccountMenu name={accountName} />
          </>
        ) : (
          <>
            {/* On phones the bottom bar carries Sign in. */}
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </>
        )}
      </header>

      <div className="flex flex-1">
        {sidebarShown && (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-card p-3 md:block">
            <SidebarNav signedIn={signedIn} />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">{children}</div>
      </div>

      <BottomBar signedIn={signedIn} />

      <DialogPrimitive.Root open={overlayOpen} onOpenChange={setOverlayOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card p-3 data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <p className="mb-3 px-3 font-serif text-2xl">StreamSouk</p>
            <SidebarNav signedIn={signedIn} onNavigate={() => setOverlayOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
