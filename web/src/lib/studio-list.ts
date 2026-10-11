// The Studio list's address: the status filter and the page number live in the
// URL, so a refresh and Back keep them. Pure, so it is tested without a page.

export const STUDIO_PAGE_SIZE = 24;

export type StudioStatus = "PROCESSING" | "READY" | "FAILED";

export type StudioQuery = { page: number; status: StudioStatus | undefined };

type Param = string | string[] | undefined;

const STATUSES: readonly StudioStatus[] = ["PROCESSING", "READY", "FAILED"];

// Anything that is not a whole page number from 1, or a known status, is the default.
export function parseStudioQuery(params: { page?: Param; status?: Param }): StudioQuery {
  const rawPage = typeof params.page === "string" ? Number(params.page) : NaN;
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawStatus = typeof params.status === "string" ? params.status.toUpperCase() : "";
  return { page, status: STATUSES.find((status) => status === rawStatus) };
}

export function studioHref({ page, status }: StudioQuery) {
  const query = new URLSearchParams();
  if (status) query.set("status", status.toLowerCase());
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/studio?${text}` : "/studio";
}

export function lastPage(total: number) {
  return Math.max(1, Math.ceil(total / STUDIO_PAGE_SIZE));
}

// The numbered links to show: the first and last page and the current one with
// its neighbours, "gap" where pages are left out.
export function pageItems(page: number, last: number): (number | "gap")[] {
  const wanted = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  wanted.forEach((n, i) => {
    if (i > 0 && n - wanted[i - 1]! > 1) items.push("gap");
    items.push(n);
  });
  return items;
}
