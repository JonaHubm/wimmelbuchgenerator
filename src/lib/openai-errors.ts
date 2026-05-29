export type OpenAiImagePayload = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

const TRANSIENT_OPENAI_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function cleanText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlErrorMessage(text: string, status: number, statusText: string) {
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const cleanedTitle = title ? cleanText(title) : "";
  const statusLabel = `${status}${statusText ? ` ${statusText}` : ""}`;

  if (cleanedTitle) {
    return `OpenAI image service returned ${cleanedTitle}. Try again with low quality or fewer reference images.`;
  }

  return `OpenAI image service returned an HTML error page (${statusLabel}) instead of JSON. Try again with low quality or fewer reference images.`;
}

function sanitizeOpenAiMessage(message: string, status = 502, statusText = "") {
  const trimmed = message.trim();

  if (trimmed.startsWith("<") || /<!doctype|<html|<title/i.test(trimmed)) {
    return htmlErrorMessage(trimmed, status, statusText);
  }

  return trimmed || `OpenAI returned ${status}${statusText ? ` ${statusText}` : ""}.`;
}

export function openAiErrorMessage(payload: OpenAiImagePayload, fallback: string) {
  const message = payload.error?.message;

  if (typeof message === "string") {
    return sanitizeOpenAiMessage(message);
  }

  return fallback;
}

export async function readOpenAiImagePayload(response: Response): Promise<OpenAiImagePayload> {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as OpenAiImagePayload;

    if (payload.error?.message) {
      return {
        ...payload,
        error: {
          ...payload.error,
          message: sanitizeOpenAiMessage(payload.error.message, response.status, response.statusText),
        },
      };
    }

    return payload;
  } catch {
    return {
      error: {
        message:
          text.trim()
            ? htmlErrorMessage(text, response.status, response.statusText)
            : `OpenAI returned ${response.status} ${response.statusText || "without JSON details"}.`,
      },
    };
  }
}

export function shouldRetryOpenAiResponse(response: Response) {
  return TRANSIENT_OPENAI_STATUSES.has(response.status);
}
