import { NextResponse } from "next/server";
import { z } from "zod";
import { createWimmelbuchVariants } from "@/lib/wimmelbuch";

const projectSchema = z.object({
  title: z.string().min(1).max(120),
  creator: z.string().max(120),
  targetPages: z.number().int().min(1).max(16),
  format: z.enum(["landscape", "square", "portrait"]),
  style: z.enum(["classic-ink", "modern-editorial", "alpine-storybook", "soft-watercolor"]),
  complexity: z.number().min(1).max(10),
  sourceFidelity: z.number().min(1).max(10),
  additions: z.string().max(1200),
});

const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  clue: z.string().max(240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  referenceImage: z.string().optional(),
});

const sourceSchema = z.object({
  pageNumber: z.number().int().min(1).max(16),
  sourceName: z.string().min(1).max(180),
  sourceImage: z.string().startsWith("data:image/"),
});

const requestSchema = z.object({
  project: projectSchema,
  source: sourceSchema,
  characters: z.array(characterSchema).min(1).max(5),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const variants = createWimmelbuchVariants(payload.project, payload.source, payload.characters);

    return NextResponse.json({
      variants,
      model: {
        provider: "local-deterministic",
        mode: "mvp",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid generation request", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not generate Wimmelbuch variants" }, { status: 500 });
  }
}
