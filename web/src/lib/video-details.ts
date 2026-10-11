export type Visibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 5000;

export type Details = {
  title: string;
  description: string;
  visibility: Visibility;
  commentsEnabled: boolean;
};

export type VisibilityChoice = { allowed: true } | { allowed: false; reason: string };

// Unlisted and Public need both a title and a description (the API refuses
// otherwise). Worked out from what is typed, so the choices react as it is.
export function visibilityRule(text: Pick<Details, "title" | "description">): Record<Visibility, VisibilityChoice> {
  const missing = [
    text.title.trim() === "" ? "a title" : null,
    text.description.trim() === "" ? "a description" : null,
  ].filter((part) => part !== null);
  const choice: VisibilityChoice =
    missing.length === 0 ? { allowed: true } : { allowed: false, reason: `Add ${missing.join(" and ")} first.` };
  return { PRIVATE: { allowed: true }, UNLISTED: choice, PUBLIC: choice };
}

// Text is compared as the API stores it (trimmed), so whitespace is not a change.
export function isDirty(saved: Details, current: Details): boolean {
  return (
    saved.title.trim() !== current.title.trim() ||
    saved.description.trim() !== current.description.trim() ||
    saved.visibility !== current.visibility ||
    saved.commentsEnabled !== current.commentsEnabled
  );
}

export type DetailsField = "title" | "description" | "visibility" | "commentsEnabled";

// The API answers with one message and no field name; find the field it is about.
export function fieldForMessage(message: string): DetailsField | null {
  if (/^The title\b/i.test(message)) return "title";
  if (/^The description\b/i.test(message)) return "description";
  if (/^Visibility\b/i.test(message) || /^Add a title/i.test(message)) return "visibility";
  if (/^commentsEnabled\b/.test(message)) return "commentsEnabled";
  return null;
}

type Click = {
  href: string;
  button: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: string | null;
  download?: boolean;
};

// For the unsaved-changes guard: the path (with query and hash) a click on a
// link would leave this page for, or null when it is not an in-app navigation
// away (new tab, download, another site, the same page, an in-page anchor).
export function guardedHref(click: Click, currentUrl: string): string | null {
  if (click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return null;
  if (click.download || (click.target && click.target !== "_self")) return null;
  let to: URL;
  const here = new URL(currentUrl);
  try {
    to = new URL(click.href, here);
  } catch {
    return null;
  }
  if (to.origin !== here.origin) return null;
  if (to.pathname === here.pathname && to.search === here.search) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}
