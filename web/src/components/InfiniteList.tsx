"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  appendPage,
  batchMessage,
  loadSnapshot,
  saveSnapshot,
  type PageOfItems,
  type PagedList,
} from "@/lib/paged-list";

// Layout effects warn during server rendering; the restore must run before paint.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Set by the browser's Back and Forward buttons (and cleared when a list takes
// it), so a list restores its pages only when the person is going back, not when
// they follow a link to it.
let poppedSinceLastList = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    poppedSinceLastList = true;
  });
}

function arrivedByHistory(): boolean {
  const popped = poppedSinceLastList;
  poppedSinceLastList = false;
  if (popped) return true;
  try {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return entry?.type === "back_forward";
  } catch {
    return false;
  }
}

export type LoadPageResult<T> = ({ ok: true } & PageOfItems<T>) | { ok: false };

type Props<T> = {
  // Names this list in sessionStorage, so each list keeps its own pages.
  listKey: string;
  // The first page, rendered on the server.
  initial: PageOfItems<T>;
  getId: (item: T) => string;
  // Guards what comes back out of sessionStorage.
  isItem: (value: unknown) => value is T;
  loadPage: (page: number) => Promise<LoadPageResult<T>>;
  // Renders one `<li>`.
  renderItem: (item: T) => React.ReactNode;
  // A few placeholder `<li>`s shown while a page loads.
  skeleton: React.ReactNode;
  noun: { singular: string; plural: string };
  label: string;
  className?: string;
};

// A list whose first page comes from the server and whose later pages load as
// its end nears (and from a visible "Load more", which is always there for
// people without IntersectionObserver or who prefer to ask).
export function InfiniteList<T>({
  listKey,
  initial,
  getId,
  isItem,
  loadPage,
  renderItem,
  skeleton,
  noun,
  label,
  className,
}: Props<T>) {
  const [list, setList] = useState<PagedList<T>>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [canObserve, setCanObserve] = useState(false);

  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const scrollY = useRef(0);
  // The restored list, and where to scroll once exactly that list has rendered.
  const pendingRestore = useRef<{ list: PagedList<T>; y: number } | null>(null);
  const listRef = useRef(list);
  listRef.current = list;

  // Back: bring back the pages loaded before leaving, then the scroll position
  // once they have rendered.
  useIsomorphicLayoutEffect(() => {
    if (!arrivedByHistory()) return;
    const snapshot = loadSnapshot(window.sessionStorage, listKey, isItem);
    if (snapshot === null) return;

    const restored = { items: snapshot.items, page: snapshot.page, hasMore: snapshot.hasMore };
    scrollY.current = snapshot.scrollY;
    pendingRestore.current = { list: restored, y: snapshot.scrollY };
    setList(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useIsomorphicLayoutEffect(() => {
    const pending = pendingRestore.current;
    if (pending === null || pending.list !== list) return;
    pendingRestore.current = null;
    window.scrollTo(0, pending.y);
  }, [list]);

  // Keep the pages and the scroll position for a later Back.
  useEffect(() => {
    const save = () =>
      saveSnapshot(window.sessionStorage, listKey, { ...listRef.current, scrollY: scrollY.current });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      scrollY.current = window.scrollY;
      clearTimeout(timer);
      timer = setTimeout(save, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      clearTimeout(timer);
      save();
    };
  }, [listKey]);

  useEffect(() => {
    saveSnapshot(window.sessionStorage, listKey, { ...list, scrollY: scrollY.current });
  }, [listKey, list]);

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);

    const result = await loadPage(listRef.current.page + 1).catch((): LoadPageResult<T> => ({ ok: false }));
    busy.current = false;
    setLoading(false);

    if (!result.ok) {
      setFailed(true);
      return;
    }
    const { list: next, added } = appendPage(listRef.current, result, getId);
    setList(next);
    setAnnouncement(batchMessage(added, noun));
  }, [loadPage, getId, noun]);

  useEffect(() => {
    setCanObserve(typeof IntersectionObserver !== "undefined");
  }, []);

  // A new observer reports the current state straight away, so a batch that
  // leaves the end still in view (or added nothing new) goes on to the next.
  useEffect(() => {
    const node = sentinel.current;
    if (!canObserve || node === null || !list.hasMore || loading || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canObserve, list, loading, failed, loadMore]);

  return (
    <div>
      <ul className={className} aria-label={label}>
        {list.items.map((item) => renderItem(item))}
        {loading && skeleton}
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div ref={sentinel} className="flex flex-col items-center gap-3 pb-8">
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            More {noun.plural} could not be loaded.{" "}
            <Button type="button" variant="link" size="sm" onClick={() => void loadMore()}>
              Retry
            </Button>
          </p>
        )}
        {list.hasMore && !failed && (
          <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading && <Spinner aria-hidden="true" />}
            Load more
          </Button>
        )}
        {!list.hasMore && list.items.length > 0 && (
          <p className="text-sm text-muted-foreground">You have reached the end.</p>
        )}
      </div>
    </div>
  );
}
