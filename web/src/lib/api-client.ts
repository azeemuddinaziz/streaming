export type ApiHealth = { healthy: boolean };

const DEFAULT_TIMEOUT_MS = 3000;

function getApiBaseUrl() {
  return process.env.API_URL ?? "http://localhost:3000";
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
