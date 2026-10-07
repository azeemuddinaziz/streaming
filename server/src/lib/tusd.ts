// Where the API reaches the upload server (tusd) to remove bytes it stores.
function tusdUrl() {
  return process.env.TUSD_URL ?? "http://localhost:8080/files/";
}

// Terminates an upload in tusd, which deletes its bytes from S3 (or disk) and
// aborts any unfinished multipart transfer. Bytes that are already gone count
// as removed, so a retry after a half-finished cleanup succeeds. Only tusd's own
// answers count: a wrong address would otherwise look like success (tusd answers
// 200 "Welcome to tusd" on paths it does not serve).
export async function removeUploadBytes(tusId: string, baseUrl = tusdUrl()) {
  const response = await fetch(
    `${baseUrl.replace(/\/?$/, "/")}${encodeURIComponent(tusId)}`,
    {
      method: "DELETE",
      headers: { "Tus-Resumable": "1.0.0" },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (response.status === 204) return;
  const body = await response.text();
  if (
    (response.status === 404 || response.status === 410) &&
    body.includes("ERR_UPLOAD_NOT_FOUND")
  ) {
    return;
  }
  throw new Error(`tusd answered ${response.status} when removing upload ${tusId}.`);
}
