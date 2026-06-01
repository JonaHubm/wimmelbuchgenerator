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
import { openAiErrorMessage, readOpenAiImagePayload, shouldRetryOpenAiResponse } from "@/lib/openai-errors";
import { dataUrlBase64, dataUrlMimeType } from "@/lib/wimmelbuch";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_PAGE_ERROR = "OpenAI image generation failed.";

type PageVariantResult =
  | { ok: true; variant: GeneratePageResponse["variants"][number] }
  | { ok: false; status: number; error: string };

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

  async function generateVariant(index: number): Promise<PageVariantResult> {
    try {
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

      let response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      if (!response.ok && shouldRetryOpenAiResponse(response)) {
        response = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
        });
      }

      const payload = await readOpenAiImagePayload(response);

      if (!response.ok) {
        return { ok: false, status: response.status, error: openAiErrorMessage(payload, OPENAI_PAGE_ERROR) };
      }

      const imageBase64 = payload?.data?.[0]?.b64_json;

      if (typeof imageBase64 !== "string") {
        return { ok: false, status: 502, error: "OpenAI did not return image data." };
      }

      return {
        ok: true,
        variant: {
          id: `openai-page-${source.pageNumber}-${index + 1}-${Date.now()}`,
          name: `OpenAI version ${index + 1}`,
          generatedImage: `data:image/jpeg;base64,${imageBase64}`,
          generationPrompt: prompt,
          model: OPENAI_IMAGE_MODEL,
          quality,
        },
      };
    } catch {
      return { ok: false, status: 502, error: OPENAI_PAGE_ERROR };
    }
  }

  const results: PageVariantResult[] = [];
  let nextVariantIndex = 0;
  const workerCount = Math.min(2, variantCount);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextVariantIndex;
        nextVariantIndex += 1;

        if (index >= variantCount) {
          return;
        }

        results[index] = await generateVariant(index);
      }
    }),
  );

  const variants = results.flatMap((result) => (result.ok ? [result.variant] : []));
  const failures = results.filter((result): result is Extract<PageVariantResult, { ok: false }> => !result.ok);

  if (variants.length === 0) {
    const firstFailure = failures[0];
    return NextResponse.json(
      { ai: aiStatus, error: firstFailure?.error ?? OPENAI_PAGE_ERROR },
      { status: firstFailure?.status ?? 502 },
    );
  }

  const nextSessionUsed = sessionUsed + variants.length;
  const warning =
    failures.length > 0
      ? `${failures.length} of ${variantCount} OpenAI variants failed. Showing ${variants.length} successful ${variants.length === 1 ? "variant" : "variants"}. ${failures[0].error}`
      : undefined;
  const response = NextResponse.json(
    { ai: getPublicAiStatus(nextSessionUsed), variants, warning } satisfies GeneratePageResponse,
  );
  response.cookies.set(AI_USAGE_COOKIE_NAME, await createAiUsageToken(nextSessionUsed), getUsageCookieOptions());

  return response;
}
