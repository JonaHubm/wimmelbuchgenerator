import {
  GeneratePageResponse,
  buildWimmelbuchPrompt,
  generatePageRequestSchema,
  imageSizeForFormat,
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
import { dataUrlBase64, dataUrlMimeType } from "@/lib/wimmelbuch";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_IMAGE_MODEL = "gpt-image-2";

type OpenAiImagePayload = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

function dataUrlToBlob(dataUrl: string) {
  const bytes = Buffer.from(dataUrlBase64(dataUrl), "base64");
  return new Blob([bytes], { type: dataUrlMimeType(dataUrl) });
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

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

  return "OpenAI image generation failed.";
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

  const parsed = generatePageRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid generation request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    project,
    source,
    characters,
    placements,
    quality,
    variantCount,
    baseGeneratedImage,
    revisionPrompt,
    iteration,
  } = parsed.data;
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

  if (variantCount > aiStatus.sessionRemaining) {
    return NextResponse.json(
      { ai: aiStatus, error: "This browser session has reached the live AI generation limit." },
      { status: 429 },
    );
  }

  const size = imageSizeForFormat(project.format);
  const variants: GeneratePageResponse["variants"] = [];

  for (let index = 0; index < variantCount; index += 1) {
    const prompt = buildWimmelbuchPrompt({
      project,
      source,
      characters,
      placements,
      variantIndex: index,
      baseGeneratedImage,
      revisionPrompt,
      iteration,
    });
    const form = new FormData();
    const sourceMimeType = dataUrlMimeType(source.sourceImage);

    form.append("model", OPENAI_IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("quality", quality);
    form.append("size", size);
    form.append("output_format", "jpeg");
    form.append("output_compression", quality === "high" ? "88" : quality === "medium" ? "82" : "76");
    if (baseGeneratedImage) {
      const baseMimeType = dataUrlMimeType(baseGeneratedImage);
      form.append(
        "image[]",
        dataUrlToBlob(baseGeneratedImage),
        `revision-base-${source.pageNumber}.${extensionForMimeType(baseMimeType)}`,
      );
    }
    form.append(
      "image[]",
      dataUrlToBlob(source.sourceImage),
      `${baseGeneratedImage ? "source-reference" : "source-page"}-${source.pageNumber}.${extensionForMimeType(sourceMimeType)}`,
    );

    characters.slice(0, 5).forEach((character, characterIndex) => {
      if (!character.referenceImage) {
        return;
      }

      const mimeType = dataUrlMimeType(character.referenceImage);
      form.append(
        "image[]",
        dataUrlToBlob(character.referenceImage),
        `reference-${characterIndex + 1}.${extensionForMimeType(mimeType)}`,
      );
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
    const payload = await readOpenAiJson(response);

    if (!response.ok) {
      return NextResponse.json({ ai: aiStatus, error: errorMessage(payload) }, { status: response.status });
    }

    const imageBase64 = payload?.data?.[0]?.b64_json;

    if (typeof imageBase64 !== "string") {
      return NextResponse.json({ ai: aiStatus, error: "OpenAI did not return image data." }, { status: 502 });
    }

    variants.push({
      id: `openai-page-${source.pageNumber}-${index + 1}-${Date.now()}`,
      name: `OpenAI version ${index + 1}`,
      generatedImage: `data:image/jpeg;base64,${imageBase64}`,
      generationPrompt: prompt,
      model: OPENAI_IMAGE_MODEL,
      quality,
    });
  }

  const nextSessionUsed = sessionUsed + variantCount;
  const response = NextResponse.json(
    { ai: getPublicAiStatus(nextSessionUsed), variants } satisfies GeneratePageResponse,
  );
  response.cookies.set(AI_USAGE_COOKIE_NAME, await createAiUsageToken(nextSessionUsed), getUsageCookieOptions());

  return response;
}
