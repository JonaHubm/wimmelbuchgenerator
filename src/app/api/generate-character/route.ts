import {
  GenerateCharacterResponse,
  buildCharacterReferencePrompt,
  generateCharacterRequestSchema,
} from "@/lib/openai-wimmelbuch";
import {
  ACCESS_COOKIE_NAME,
  AI_USAGE_COOKIE_NAME,
  createAiUsageToken,
  getPublicAiStatus,
  getUsageCookieOptions,
  readAiUsage,
  verifyAccessToken,
} from "@/lib/access-control";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_IMAGE_MODEL = "gpt-image-2";

type OpenAiImagePayload = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

function errorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "OpenAI target reference generation failed.";
}

async function readOpenAiJson(response: Response): Promise<OpenAiImagePayload> {
  const text = await response.text();

  try {
    return JSON.parse(text) as OpenAiImagePayload;
  } catch {
    return {
      error: {
        message:
          text.trim().slice(0, 500) ||
          `OpenAI returned ${response.status} ${response.statusText || "without JSON details"}.`,
      },
    };
  }
}

export async function POST(request: NextRequest) {
  const hasAccess = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (!hasAccess) {
    return NextResponse.json({ error: "Private test access is required." }, { status: 401 });
  }

  const parsed = generateCharacterRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid character generation request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const sessionUsed = await readAiUsage(request.cookies.get(AI_USAGE_COOKIE_NAME)?.value);
  const aiStatus = getPublicAiStatus(sessionUsed);

  if (!aiStatus.aiEnabled) {
    return NextResponse.json({ ai: aiStatus, error: "Live AI is paused by the owner." }, { status: 503 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ai: aiStatus, error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  if (aiStatus.sessionRemaining < 1) {
    return NextResponse.json(
      { ai: aiStatus, error: "This browser session has reached the live AI generation limit." },
      { status: 429 },
    );
  }

  const { project, character, quality } = parsed.data;
  const prompt = buildCharacterReferencePrompt({ project, character });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      quality,
      size: "1024x1024",
      output_format: "png",
    }),
  });
  const payload = await readOpenAiJson(response);

  if (!response.ok) {
    return NextResponse.json({ ai: aiStatus, error: errorMessage(payload) }, { status: response.status });
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;

  if (typeof imageBase64 !== "string") {
    return NextResponse.json(
      { ai: aiStatus, error: "OpenAI did not return character image data." },
      { status: 502 },
    );
  }

  const nextSessionUsed = sessionUsed + 1;
  const apiResponse = NextResponse.json({
    ai: getPublicAiStatus(nextSessionUsed),
    image: `data:image/png;base64,${imageBase64}`,
    model: OPENAI_IMAGE_MODEL,
    prompt,
    quality,
  } satisfies GenerateCharacterResponse);
  apiResponse.cookies.set(AI_USAGE_COOKIE_NAME, await createAiUsageToken(nextSessionUsed), getUsageCookieOptions());

  return apiResponse;
}
