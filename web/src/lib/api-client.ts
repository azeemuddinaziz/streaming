export type ApiHealth = { healthy: boolean };

export type User = { id: string; email: string; name: string };
export type Channel = { id: string; name: string };
export type Account = { user: User; channel: Channel };

// What a form needs: either the signed-in account, or a message to show.
export type AccountResult =
  | ({ ok: true } & Account)
  | { ok: false; message: string };

const DEFAULT_TIMEOUT_MS = 3000;
const UNREACHABLE = "Could not reach the server. Try again in a moment.";

// API_URL is read on the server; NEXT_PUBLIC_API_URL is the same address as the
// browser sees it.
function getApiBaseUrl() {
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
