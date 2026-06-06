function nonJsonErrorMessage(response: Response, body: string, fallback: string) {
  if (response.status === 401) {
    return "Private access expired or is missing. Open /access again and enter the passcode.";
  }

  if (response.status === 413) {
    return "The image request is too large for Vercel. Use fewer/lower-resolution references or re-upload smaller images.";
  }

  if (response.status === 504) {
    return "The generation timed out on Vercel. Try low quality or fewer references.";
  }

  if (body.trim().startsWith("<!DOCTYPE")) {
    return `${fallback} The server returned an HTML error page instead of JSON. This usually means the request was too large, timed out, or hit a deployment/auth error.`;
  }

  return `${fallback} Server returned ${response.status} ${response.statusText || "without JSON details"}.`;
}

export async function readApiResponse<T>(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(nonJsonErrorMessage(response, body, fallback));
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${fallback} The server returned invalid JSON.`);
  }
}

export function apiRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `${fallback} The request was cancelled or timed out.`;
  }

  if (error instanceof TypeError && /failed to fetch|fetch failed|networkerror/i.test(error.message)) {
    return `${fallback} The browser could not reach the server. Reload the app, check the internet connection, disable VPN/ad blockers for this site, and open the app through https://wimmelbuch.vercel.app/.`;
  }

  return error instanceof Error ? error.message : fallback;
}
