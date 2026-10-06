export type ApiHealth = { healthy: boolean };

export function getApiBaseUrl() {
  return process.env.API_URL ?? "http://localhost:3000";
}

export async function checkApiHealth(
  baseUrl: string = getApiBaseUrl(),
): Promise<ApiHealth> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/`);
    return { healthy: response.ok };
  } catch {
    return { healthy: false };
  }
}
