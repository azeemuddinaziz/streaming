import { describe, expect, it } from "vitest";
import {
  appendPage,
  batchMessage,
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  type SnapshotStorage,
} from "./paged-list";

type Item = { id: string };
const item = (id: string): Item => ({ id });
const getId = (i: Item) => i.id;
const isItem = (v: unknown): v is Item =>
  typeof v === "object" && v !== null && typeof (v as Item).id === "string";

function memoryStorage(initial: Record<string, string> = {}): SnapshotStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe("appendPage", () => {
  it("appends a page and moves the page number and hasMore on", () => {
    const { list, added } = appendPage(
      { items: [item("a")], page: 1, hasMore: true },
      { items: [item("b"), item("c")], page: 2, hasMore: false },
      getId,
    );
    expect(list).toEqual({ items: [item("a"), item("b"), item("c")], page: 2, hasMore: false });
    expect(added).toBe(2);
  });

  it("drops an item already shown, keeping its first position", () => {
    const { list, added } = appendPage(
      { items: [item("a"), item("b")], page: 1, hasMore: true },
      { items: [item("b"), item("c")], page: 2, hasMore: true },
      getId,
    );
    expect(list.items.map(getId)).toEqual(["a", "b", "c"]);
    expect(added).toBe(1);
  });

  it("drops a repeat inside the incoming page itself", () => {
    const { list } = appendPage(
      { items: [], page: 1, hasMore: true },
      { items: [item("a"), item("a")], page: 2, hasMore: true },
      getId,
    );
    expect(list.items).toHaveLength(1);
  });

  it("does not change the list it was given", () => {
    const before = { items: [item("a")], page: 1, hasMore: true };
    appendPage(before, { items: [item("b")], page: 2, hasMore: false }, getId);
    expect(before.items).toHaveLength(1);
  });
});

describe("batchMessage", () => {
  const noun = { singular: "video", plural: "videos" };

  it("announces the count", () => {
    expect(batchMessage(24, noun)).toBe("24 more videos loaded");
  });
  it("uses the singular for one", () => {
    expect(batchMessage(1, noun)).toBe("1 more video loaded");
  });
  it("says so when everything was a repeat", () => {
    expect(batchMessage(0, noun)).toBe("No new videos loaded");
  });
});

describe("snapshots", () => {
  it("round-trips a list and its scroll position", () => {
    const storage = memoryStorage();
    saveSnapshot(storage, "home", { items: [item("a")], page: 3, hasMore: true, scrollY: 1200 });
    expect(loadSnapshot(storage, "home", isItem)).toEqual({
      items: [item("a")],
      page: 3,
      hasMore: true,
      scrollY: 1200,
    });
  });

  it("keeps lists apart by key", () => {
    const storage = memoryStorage();
    saveSnapshot(storage, "home", { items: [item("a")], page: 1, hasMore: false, scrollY: 0 });
    expect(loadSnapshot(storage, "channel:x", isItem)).toBeNull();
  });

  it("returns null when nothing was saved", () => {
    expect(loadSnapshot(memoryStorage(), "home", isItem)).toBeNull();
  });

  it("ignores text that is not JSON", () => {
    const storage = memoryStorage({ "streamsouk:list:home": "{oops" });
    expect(loadSnapshot(storage, "home", isItem)).toBeNull();
  });

  it("ignores a snapshot of the wrong shape", () => {
    const bad = [
      { items: "no", page: 1, hasMore: true, scrollY: 0 },
      { items: [{ nope: 1 }], page: 1, hasMore: true, scrollY: 0 },
      { items: [], page: 0, hasMore: true, scrollY: 0 },
      { items: [], page: 1, hasMore: "yes", scrollY: 0 },
      { items: [], page: 1, hasMore: true, scrollY: -5 },
    ];
    for (const value of bad) {
      const storage = memoryStorage({ "streamsouk:list:home": JSON.stringify(value) });
      expect(loadSnapshot(storage, "home", isItem)).toBeNull();
    }
  });

  it("survives a storage that throws", () => {
    const broken: SnapshotStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveSnapshot(broken, "home", { items: [], page: 1, hasMore: false, scrollY: 0 })).not.toThrow();
    expect(loadSnapshot(broken, "home", isItem)).toBeNull();
    expect(() => clearSnapshot(broken, "home")).not.toThrow();
  });

  it("clears a snapshot", () => {
    const storage = memoryStorage();
    saveSnapshot(storage, "home", { items: [], page: 1, hasMore: false, scrollY: 0 });
    clearSnapshot(storage, "home");
    expect(loadSnapshot(storage, "home", isItem)).toBeNull();
  });
});
