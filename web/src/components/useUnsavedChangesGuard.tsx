"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { guardedHref } from "@/lib/video-details";

const BACK = Symbol("back");

// While `dirty`, leaving the page asks first: the browser's own prompt for a
// reload, tab close or another site (`beforeunload`), and an AlertDialog for
// in-app links and the Back button. Render the returned `dialog` once.
//
// The App Router has no route-change event, so in-app links are caught on
// click (capture phase) and Back through a spare history entry: Back lands on
// it, the dialog opens, and Stay puts it back. After a save the spare entry
// stays, so one extra Back press lands on the same page.
export function useUnsavedChangesGuard(dirty: boolean): { dialog: ReactNode } {
  const router = useRouter();
  const [pending, setPending] = useState<string | typeof BACK | null>(null);
  const bypass = useRef(false);
  const spareEntry = useRef(false);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      const href = guardedHref(
        {
          href: anchor.getAttribute("href") ?? "",
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
        },
        window.location.href,
      );
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(href);
    };

    const onPopState = () => {
      if (bypass.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      setPending(BACK);
    };

    if (!spareEntry.current) {
      window.history.pushState(window.history.state, "", window.location.href);
      spareEntry.current = true;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);

  function leave() {
    bypass.current = true;
    if (pending === BACK) window.history.go(-2);
    else if (pending) router.push(pending);
    setPending(null);
  }

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>Your changes to these details have not been saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={leave}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog };
}
