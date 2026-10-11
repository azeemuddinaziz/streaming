// The logic behind an infinite-scroll list, kept free of React and the DOM so it
// can be tested: appending a page without duplicates, announcing a batch, and
// keeping the loaded pages (and scroll position) in sessionStorage so Back can
// return to where the person was.

export type PagedList<T> = {
  items: T[];
  // The last page loaded; the next one asked for is page + 1.
  page: number;
  hasMore: boolean;
};

// A page as it arrives from the API has the same shape.
export type PageOfItems<T> = PagedList<T>;

// Offsets shift when something is published between loads, so a later page can
// repeat an item already shown. The first copy wins and keeps its place.
export function appendPage<T>(
  list: PagedList<T>,
  incoming: PageOfItems<T>,
  getId: (item: T) => string,
): { list: PagedList<T>; added: number } {
  const seen = new Set(list.items.map(getId));
  const fresh: T[] = [];
  for (const item of incoming.items) {
    const id = getId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    fresh.push(item);
  }
  return {
    list: { items: [...list.items, ...fresh], page: incoming.page, hasMore: incoming.hasMore },
    added: fresh.length,
  };
}

// What the polite live region says after a batch.
export function batchMessage(added: number, noun: { singular: string; plural: string }): string {
  if (added === 0) return `No new ${noun.plural} loaded`;
  return `${added} more ${added === 1 ? noun.singular : noun.plural} loaded`;
}

export type Snapshot<T> = PagedList<T> & { scrollY: number };

// The part of Storage the list needs, so tests can pass a plain object.
export type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "streamsouk:list:";

export function saveSnapshot<T>(storage: SnapshotStorage, key: string, snapshot: Snapshot<T>): void {
  try {
    storage.setItem(PREFIX + key, JSON.stringify(snapshot));
  } catch {
    // Storage can be full or blocked; Back then simply starts at the top.
  }
}

// Only a snapshot of the right shape comes back; anything else is dropped.
export function loadSnapshot<T>(
  storage: SnapshotStorage,
  key: string,
  isItem: (value: unknown) => value is T,
): Snapshot<T> | null {
  try {
    const raw = storage.getItem(PREFIX + key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;

    const { items, page, hasMore, scrollY } = value as Record<string, unknown>;
    if (!Array.isArray(items) || !items.every(isItem)) return null;
    if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1) return null;
    if (typeof hasMore !== "boolean") return null;
    if (typeof scrollY !== "number" || !Number.isFinite(scrollY) || scrollY < 0) return null;

    return { items, page, hasMore, scrollY };
  } catch {
    return null;
  }
}

// How long after a Back/Forward the next list to mount still counts as arriving
// by it: long enough for the page to be fetched, short enough that a later link
// click is not mistaken for it.
export const HISTORY_WINDOW_MS = 5000;

// Whether a list that is mounting should bring back its saved pages: only when
// the person got here by Back/Forward. `poppedAt` is when the last popstate
// fired (null if none); `loadedByHistory` is the document's own navigation type
// being back_forward, which only describes the first list shown after the load.
export function arrivedByHistory(input: {
  poppedAt: number | null;
  now: number;
  loadedByHistory: boolean;
  firstListOfDocument: boolean;
}): boolean {
  const { poppedAt, now, loadedByHistory, firstListOfDocument } = input;
  if (poppedAt !== null && now - poppedAt <= HISTORY_WINDOW_MS) return true;
  return loadedByHistory && firstListOfDocument;
}
