import { useState } from "react";
import type { Comment } from "@/lib/api-client";

type Page =
  | { ok: true; comments: Comment[]; hasMore: boolean; total?: number }
  | { ok: false; message: string };

// A list of Comments read page by page: which page it is on, whether there is
// another, and the loading and error states of the fetch. Pages are merged
// without duplicates, since a Comment written meanwhile shifts later pages.
export function usePagedComments(fetchPage: (page: number) => Promise<Page>) {
  const [items, setItems] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  // `replace` starts over from the given page (a refresh); otherwise the page is appended.
  async function load(next = page + 1, replace = false) {
    setLoading(true);
    setError(undefined);
    const result = await fetchPage(next);
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setItems((current) => {
      const base = replace ? [] : current;
      const seen = new Set(base.map((comment) => comment.id));
      return [...base, ...result.comments.filter((comment) => !seen.has(comment.id))];
    });
    setPage(next);
    setHasMore(result.hasMore);
    if (result.total !== undefined) setTotal(result.total);
    setLoaded(true);
  }

  return { items, setItems, hasMore, total, setTotal, loading, error, loaded, load };
}
