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
  // Where the Thumbnail is served on the API; null until the Video is ready.
  thumbnailPath: string | null;
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
  views: number;
  // Visible Comments and Replies together.
  comments: number;
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

// Deletes a Video: it disappears for everyone, the owner included. Called from the browser.
export async function deleteVideo(
  id: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) return { ok: true };

    const body = await response.json().catch(() => ({}));
    return { ok: false, message: body.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;

// Replaces a Video's Thumbnail with an image of the owner's. Checks the file
// first so an obvious mistake gets a message without sending it.
// Called from the browser.
export async function replaceThumbnail(
  id: string,
  file: File,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true; thumbnailPath: string } | { ok: false; message: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Choose an image file (PNG, JPEG or WebP)." };
  }
  if (file.size > THUMBNAIL_MAX_BYTES) {
    return { ok: false, message: "That image is over 5 MB. Choose a smaller one." };
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}/thumbnail`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.video?.thumbnailPath) {
      return { ok: true, thumbnailPath: body.video.thumbnailPath };
    }
    return { ok: false, message: body.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// Tells the API that playback of a Video ran long enough to count as a View.
// Called from the browser; the cookie lets the API skip the owner.
export async function reportView(id: string, baseUrl: string = getApiBaseUrl()): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(id)}/views`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type ChannelPage = {
  channel: { name: string };
  videos: { id: string; title: string | null; createdAt: string; thumbnailPath: string | null }[];
};

export type ChannelResult =
  | ({ ok: true } & ChannelPage)
  | { ok: false; reason: "not-found" | "unavailable" };

// For server components: loads a Channel's public page, found by account name.
export async function getChannelPage(
  name: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<ChannelResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/channels/${encodeURIComponent(name)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };

    return { ok: true, ...(await response.json()) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type ShowcaseVideo = {
  id: string;
  title: string | null;
  createdAt: string;
  channelName: string;
  thumbnailPath: string | null;
};

export type ShowcaseResult =
  | { ok: true; videos: ShowcaseVideo[]; page: number; hasMore: boolean }
  | { ok: false };

// For server components: one page of the home page's public Videos.
export async function getPublicVideos(
  page: number,
  baseUrl: string = getApiBaseUrl(),
): Promise<ShowcaseResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos?page=${page}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false };

    return { ok: true, ...(await response.json()) };
  } catch {
    return { ok: false };
  }
}

export type Comment = {
  id: string;
  parentId: string | null;
  body: string | null;
  authorName: string | null;
  isChannelOwner: boolean;
  // The signed-in person wrote it, so they can edit and delete it.
  isAuthor: boolean;
  edited: boolean;
  // A deleted Comment that still has Replies: no author and no text.
  deleted: boolean;
  createdAt: string;
  replyCount: number;
};

export const COMMENT_MAX = 1000;

export type CommentPageResult =
  | { ok: true; comments: Comment[]; hasMore: boolean }
  | { ok: false; message: string };

// One page of a Video's top-level Comments. Called from the browser.
export async function getComments(
  videoId: string,
  page: number,
  baseUrl: string = getApiBaseUrl(),
): Promise<CommentPageResult> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/videos/${encodeURIComponent(videoId)}/comments?page=${page}`,
      { credentials: "include" },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, message: body.msg ?? "Something went wrong." };
    return { ok: true, comments: body.comments, hasMore: body.hasMore };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// The Replies to a top-level Comment. Called from the browser.
export async function getReplies(
  videoId: string,
  commentId: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true; replies: Comment[] } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/videos/${encodeURIComponent(videoId)}/comments/${encodeURIComponent(commentId)}/replies`,
      { credentials: "include" },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, message: body.msg ?? "Something went wrong." };
    return { ok: true, replies: body.replies };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// Writes a Comment, or a Reply when `parentId` is given. Called from the browser.
export async function postComment(
  videoId: string,
  input: { body: string; parentId?: string },
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true; comment: Comment } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/videos/${encodeURIComponent(videoId)}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.comment) return { ok: true, comment: body.comment };
    return { ok: false, message: body.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// Changes the text of the signed-in person's own Comment. Called from the browser.
export async function editComment(
  videoId: string,
  commentId: string,
  body: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true; comment: Comment } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/videos/${encodeURIComponent(videoId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.comment) return { ok: true, comment: result.comment };
    return { ok: false, message: result.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// Deletes the signed-in person's own Comment. Called from the browser.
export async function deleteComment(
  videoId: string,
  commentId: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/videos/${encodeURIComponent(videoId)}/comments/${encodeURIComponent(commentId)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (response.ok) return { ok: true };

    const result = await response.json().catch(() => ({}));
    return { ok: false, message: result.msg ?? "Something went wrong." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
