export const ACCESS_COOKIE_NAME = "wimmelbuch_access";
export const AI_USAGE_COOKIE_NAME = "wimmelbuch_ai_usage";

const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const LOCAL_SIGNING_SECRET = "local-wimmelbuch-generator-test-secret";

export type PublicAiStatus = {
  aiEnabled: boolean;
  liveAiAvailable: boolean;
  sessionLimit: number;
  sessionUsed: number;
  sessionRemaining: number;
  status: "active" | "paused" | "missing-key" | "limit-reached";
};

type SignedPayload = {
  count?: number;
  iat: number;
  purpose: "access" | "usage";
  v: 1;
};

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function getSigningSecret() {
  if (process.env.WIMMELBUCH_ACCESS_SECRET) {
    return process.env.WIMMELBUCH_ACCESS_SECRET;
  }

  if (!isVercelRuntime()) {
    return LOCAL_SIGNING_SECRET;
  }

  return "";
}

export function getAccessGateConfig() {
  const accessCode = process.env.WIMMELBUCH_ACCESS_CODE;
  const accessSecret = process.env.WIMMELBUCH_ACCESS_SECRET;
  const enabled = isVercelRuntime() || Boolean(accessCode || accessSecret);

  return {
    configured: !enabled || Boolean(accessCode && accessSecret),
    enabled,
  };
}

export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: isVercelRuntime(),
  };
}

export function getUsageCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: isVercelRuntime(),
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

async function sign(value: string) {
  const secret = getSigningSecret();

  if (!secret) {
    throw new Error("WIMMELBUCH_ACCESS_SECRET is not configured.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSignedToken(payload: SignedPayload) {
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

async function readSignedToken(token: string | undefined, purpose: SignedPayload["purpose"]) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const expectedSignature = await sign(encodedPayload);

    if (!constantTimeEqual(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(base64UrlToString(encodedPayload)) as Partial<SignedPayload>;

    if (payload.v !== 1 || payload.purpose !== purpose || typeof payload.iat !== "number") {
      return null;
    }

    return payload as SignedPayload;
  } catch {
    return null;
  }
}

export async function isAccessCodeValid(passcode: string) {
  const expectedCode = process.env.WIMMELBUCH_ACCESS_CODE;

  if (!expectedCode) {
    return false;
  }

  return constantTimeEqual(passcode.trim(), expectedCode.trim());
}

export async function createAccessToken() {
  return createSignedToken({
    iat: Date.now(),
    purpose: "access",
    v: 1,
  });
}

export async function verifyAccessToken(token: string | undefined) {
  const config = getAccessGateConfig();

  if (!config.enabled) {
    return true;
  }

  if (!config.configured) {
    return false;
  }

  const payload = await readSignedToken(token, "access");

  if (!payload) {
    return false;
  }

  return Date.now() - payload.iat < ACCESS_COOKIE_MAX_AGE_SECONDS * 1000;
}

export async function readAiUsage(token: string | undefined) {
  const payload = await readSignedToken(token, "usage");

  if (!payload || typeof payload.count !== "number") {
    return 0;
  }

  return Math.max(0, Math.floor(payload.count));
}

export async function createAiUsageToken(count: number) {
  return createSignedToken({
    count: Math.max(0, Math.floor(count)),
    iat: Date.now(),
    purpose: "usage",
    v: 1,
  });
}

export function getAiSessionLimit() {
  const parsed = Number.parseInt(process.env.WIMMELBUCH_AI_SESSION_LIMIT ?? "3", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 3;
  }

  return Math.min(parsed, 25);
}

export function getPublicAiStatus(sessionUsed: number): PublicAiStatus {
  const aiEnabled = process.env.WIMMELBUCH_AI_ENABLED === "true";
  const sessionLimit = getAiSessionLimit();
  const sessionRemaining = Math.max(0, sessionLimit - sessionUsed);
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const status: PublicAiStatus["status"] = !aiEnabled
    ? "paused"
    : !hasApiKey
      ? "missing-key"
      : sessionRemaining === 0
        ? "limit-reached"
        : "active";

  return {
    aiEnabled,
    liveAiAvailable: status === "active",
    sessionLimit,
    sessionRemaining,
    sessionUsed,
    status,
  };
}
