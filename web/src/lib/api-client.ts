export type ApiHealth = { healthy: boolean };

export type User = { id: string; email: string; name: string };
export type Channel = { id: string; name: string };
export type Account = { user: User; channel: Channel };

// What a form needs: either the signed-in account, or a message to show.
export type AccountResult =
  | ({ ok: true } & Account)
  | { ok: false; message: string };

export type StudioVideo = {
  id: string;
  // The filename, until the Video has a title.
  label: string;
  title: string | null;
  description: string | null;
  status: "PROCESSING" | "READY" | "FAILED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  createdAt: string;
};

const DEFAULT_TIMEOUT_MS = 3000;
const UNREACHABLE = "Could not reach the server. Try again in a moment.";

// API_URL is read on the server; NEXT_PUBLIC_API_URL is the same address as the
// browser sees it.
export function getApiBaseUrl() {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000"
  );
}

export async function checkApiHealth(
  baseUrl: string = getApiBaseUrl(),
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ApiHealth> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { healthy: response.ok };
  } catch {
    return { healthy: false };
  }
}

// "include" lets the browser store and send the API's sign-in cookie.
async function postAccountForm(
  path: string,
  input: Record<string, string>,
  baseUrl: string,
): Promise<AccountResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, message: body.msg ?? "Something went wrong." };
    }
    return { ok: true, user: body.user, channel: body.channel };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export function signUp(
  input: { name: string; email: string; password: string },
  baseUrl: string = getApiBaseUrl(),
) {
  return postAccountForm("sign-up", input, baseUrl);
}

export function signIn(
  input: { email: string; password: string },
  baseUrl: string = getApiBaseUrl(),
) {
  return postAccountForm("sign-in", input, baseUrl);
}

export async function signOut(baseUrl: string = getApiBaseUrl()) {
  await fetch(`${baseUrl}/api/v1/users/sign-out`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

// For server components: asks the API who the request's cookie belongs to.
export async function getCurrentUser(
  cookie: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<Account | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const { user, channel } = await response.json();
    return { user, channel };
  } catch {
    return null;
  }
}

export type UnfinishedUpload = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
};

// What a signed-in list needs: the items, or why there are none to show.
export type ListResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; reason: "signed-out" | "unavailable" };

// For server components: reads a list that belongs to the request's cookie.
async function getOwnList<T>(
  path: string,
  key: string,
  cookie: string,
  baseUrl: string,
): Promise<ListResult<T>> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/${path}`, {
      headers: { Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (response.status === 401) return { ok: false, reason: "signed-out" };
    if (!response.ok) return { ok: false, reason: "unavailable" };

    const body = await response.json();
    return { ok: true, items: body[key] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function getStudioVideos(cookie: string, baseUrl: string = getApiBaseUrl()) {
  return getOwnList<StudioVideo>("videos/mine", "videos", cookie, baseUrl);
}

export function getUnfinishedUploads(cookie: string, baseUrl: string = getApiBaseUrl()) {
  return getOwnList<UnfinishedUpload>("uploads/unfinished", "uploads", cookie, baseUrl);
}

// Asks the API to process a failed Video again. Called from the browser.
export async function retryVideo(
  id: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}/retry`, {
      method: "POST",
      credentials: "include",
    });
    if (response.ok) return { ok: true };

    const body = await response.json().catch(() => ({}));
    return { ok: false, message: body.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// Saves a Video's title, description and Visibility. Called from the browser.
export async function updateVideoDetails(
  id: string,
  details: {
    title: string;
    description: string;
    visibility: StudioVideo["visibility"];
  },
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (response.ok) return { ok: true };

    const body = await response.json().catch(() => ({}));
    return { ok: false, message: body.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export type WatchVideo = {
  id: string;
  title: string | null;
  description: string | null;
  status: "PROCESSING" | "READY" | "FAILED";
  channelName: string;
  createdAt: string;
  // Where the master playlist is served, on the API. Only for a ready Video.
  playlistPath?: string;
};

export type WatchResult =
  | { ok: true; video: WatchVideo }
  | { ok: false; reason: "not-found" | "unavailable" };

// For server components: loads a Video for the watch page. The cookie lets the
// owner open their own private Video; anyone else passes an empty one.
export async function getWatchVideo(
  id: string,
  cookie: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<WatchResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}/watch`, {
      headers: { Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };

    const { video } = await response.json();
    return { ok: true, video };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
