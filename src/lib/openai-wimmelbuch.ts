import { z } from "zod";
import type { PublicAiStatus } from "@/lib/access-control";
import { HiddenCharacter, ProjectConfig, SourcePage, formatLabels, styleLabels, uid } from "@/lib/wimmelbuch";

export const generationQualitySchema = z.enum(["low", "medium", "high"]).default("medium");

export const generatePageRequestSchema = z.object({
  project: z.object({
    title: z.string().min(1).max(120),
    creator: z.string().max(120),
    targetPages: z.number().int().min(1).max(20),
    format: z.enum(["landscape", "square", "portrait"]),
    style: z.enum(["classic-ink", "modern-editorial", "alpine-storybook", "soft-watercolor"]),
    complexity: z.number().min(1).max(10),
    sourceFidelity: z.number().min(1).max(10),
    additions: z.string().max(1200),
  }),
  source: z.object({
    pageNumber: z.number().int().min(1).max(40),
    sourceName: z.string().min(1).max(240),
    sourceImage: z.string().startsWith("data:image/"),
  }),
  characters: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80),
        clue: z.string().max(240),
        color: z.string().min(1).max(40),
        referenceImage: z.string().startsWith("data:image/").optional(),
      }),
    )
    .min(1)
    .max(5),
  placements: z
    .record(
      z.string(),
      z.discriminatedUnion("mode", [
        z.object({ mode: z.literal("random") }),
        z.object({
          mode: z.literal("manual"),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
        }),
      ]),
    )
    .default({}),
  quality: generationQualitySchema,
  variantCount: z.number().int().min(1).max(3).default(1),
  rightsConfirmed: z.literal(true),
});

export type GeneratePageRequest = z.infer<typeof generatePageRequestSchema>;

export type GeneratePageResponse = {
  ai?: PublicAiStatus;
  variants: Array<{
    id: string;
    name: string;
    generatedImage: string;
    generationPrompt: string;
    model: string;
    quality: "low" | "medium" | "high";
  }>;
};

export const generateCharacterRequestSchema = z.object({
  project: generatePageRequestSchema.shape.project,
  character: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    clue: z.string().max(240),
    color: z.string().min(1).max(40),
  }),
  quality: generationQualitySchema,
});

export type GenerateCharacterResponse = {
  ai?: PublicAiStatus;
  image: string;
  prompt: string;
  model: string;
  quality: "low" | "medium" | "high";
};

const styleDirectives: Record<ProjectConfig["style"], string> = {
  "classic-ink":
    "classic European hidden-object picture-book illustration, crisp ink linework, warm hand-painted color, charming tiny scenes",
  "modern-editorial":
    "modern editorial picture-book illustration, clean shapes, sophisticated color, detailed civic bustle",
  "alpine-storybook":
    "Alpine storybook illustration, cozy Swiss town atmosphere, friendly figures, textured hand-drawn details",
  "soft-watercolor":
    "soft watercolor and pencil picture-book illustration, luminous colors, gentle contours, richly populated scene",
};

export function imageSizeForFormat(format: ProjectConfig["format"]) {
  if (format === "portrait") {
    return "1024x1536";
  }

  if (format === "square") {
    return "1024x1024";
  }

  return "1536x1024";
}

export function buildCharacterReferencePrompt({
  project,
  character,
}: {
  project: ProjectConfig;
  character: Pick<HiddenCharacter, "name" | "clue" | "color">;
}) {
  return [
    `Create a clean approved character reference sheet for "${character.name}" for a premium Wimmelbuch hidden-object picture book.`,
    `Character description: ${character.clue || "friendly recurring hidden-object character"}.`,
    `Main accent color: ${character.color}.`,
    `Visual style: ${styleLabels[project.style]} - ${styleDirectives[project.style]}.`,
    "Show exactly one full-body character, front-facing or slight three-quarter view, centered on a plain light background.",
    "The design must be distinctive and repeatable across many pages: clear outfit, silhouette, colors, and recognizable traits.",
    "No text, labels, arrows, UI, logos, watermarks, copyrighted characters, or background scene.",
    "Keep it child-friendly, charming, and simple enough to be hidden small inside a busy Wimmelbuch page.",
  ].join("\n");
}

export function buildWimmelbuchPrompt({
  project,
  source,
  characters,
  placements,
  variantIndex,
}: {
  project: ProjectConfig;
  source: SourcePage;
  characters: HiddenCharacter[];
  placements?: Record<string, { mode: "random" } | { mode: "manual"; x: number; y: number }>;
  variantIndex: number;
}) {
  const activeCharacters = characters.slice(0, 5);
  const roster = activeCharacters
    .map((character, index) => {
      const clue = character.clue ? ` Clue: ${character.clue}.` : "";
      const reference =
        character.referenceImage
          ? ` A reference image for this character is provided after the source photo. Use it only as an identity guide for costume, colors, silhouette, and facial/hair traits. Do not paste, crop, enlarge, frame, or copy the reference image as a foreground cutout. Redraw the character inside the scene.`
          : " No reference image is provided, so establish a distinctive, repeatable design from the description.";
      const characterPlacement = placements?.[character.id];
      const placement =
        characterPlacement?.mode === "manual"
          ? ` For this page only, this figure MUST be hidden near the user-selected point: ${Math.round(characterPlacement.x)}% from the left and ${Math.round(characterPlacement.y)}% from the top of the image. Use that point as the main hiding zone, integrate the figure naturally at the correct perspective and scene depth, and do not move it to a different quadrant. Do not put the figure on an edge or as a large cropped foreground portrait.`
          : " For this page, choose a natural random hiding place that differs from the other figures.";
      return `${index + 1}. ${character.name}, accent color ${character.color}.${clue}${reference}${placement}`;
    })
    .join("\n");
  const mandatoryChecklist = activeCharacters
    .map(
      (character, index) =>
        `${index + 1}. ${character.name}: include exactly one small hidden version of this figure, using accent color ${character.color}.`,
    )
    .join("\n");
  const density =
    project.complexity >= 8
      ? "very dense"
      : project.complexity >= 5
        ? "dense"
        : "moderately dense";
  const fidelity =
      project.sourceFidelity >= 8
      ? "Preserve the uploaded place photo's architecture, perspective, recognizable landmarks, facade geometry, and spatial layout closely. The result should clearly be this same place transformed into illustration."
      : project.sourceFidelity >= 5
        ? "Use the uploaded photo as the clear basis while allowing illustrative simplification, crowd additions, and modest staging changes."
        : "Use the uploaded photo as loose inspiration for setting and mood; larger creative changes are acceptable.";
  const crowdInstruction =
    project.complexity >= 8
      ? "Fill the page with a high-density Wimmelbuch crowd: many tiny people, micro-stories, props, animals, stalls, windows, background jokes, and layered details across foreground, middle ground, and background."
      : project.complexity >= 5
        ? "Add a medium-density Wimmelbuch scene with several small groups, props, and discoverable side stories while keeping the composition readable."
        : "Keep the scene relatively calm and sparse, with fewer figures and fewer visual distractions.";
  const hidingInstruction =
    project.complexity >= 8
      ? "Search figure difficulty: hard. Draw each recurring search figure very small, proportional to nearby people, partially occluded or camouflaged by similar colors, and integrated into busy areas. They should be findable only after careful looking, not obvious at first glance."
      : project.complexity >= 5
        ? "Search figure difficulty: medium. Draw each recurring search figure small and proportional to nearby people, blended into the crowd or setting, but still reasonably findable."
        : "Search figure difficulty: easy. Draw each recurring search figure small but a little clearer than the crowd, while still integrated into the scene.";

  return [
    `Create one polished Wimmelbuch hidden-object book page from the uploaded source photo "${source.sourceName}".`,
    fidelity,
    `Visual style: ${styleLabels[project.style]} - ${styleDirectives[project.style]}.`,
    `Book format: ${formatLabels[project.format]}. Page ${source.pageNumber} of "${project.title}".`,
    `Complexity setting: ${project.complexity}/10 (${density}). ${crowdInstruction}`,
    `Source fidelity setting: ${project.sourceFidelity}/10. ${fidelity}`,
    "The complexity and source fidelity settings are important generation controls; make the visual result noticeably reflect them.",
    "Make the scene child-friendly, PEGI 3, playful, and suitable for a premium printed picture book.",
    hidingInstruction,
    "Transform the place into a lively illustrated panorama with many small narrative micro-scenes, families, pedestrians, tiny jokes, vendors, bicycles, animals, signs without legible brand names, and environmental detail.",
    "Do not add copyrighted characters, recognizable third-party mascots, protected logos, watermarks, or readable real brand text.",
    "Do not write character names anywhere in the image. No name tags, no labels, no captions, no text on clothing or hats.",
    "Avoid photorealism. The result should be a coherent illustrated Wimmelbuch page, not a collage and not a UI mockup.",
    `Mandatory hidden figures: include all ${activeCharacters.length} listed recurring search figures in the final image. Do not omit any configured figure, even if the page is crowded.`,
    "Place the following recurring search figures/objects naturally in the image, small, proportional to the scene, and findable only by looking. Do not make them larger than surrounding people unless perspective demands it. No labels, arrows, circles, frames, or foreground portraits:",
    roster,
    "Mandatory inclusion checklist for the final image:",
    mandatoryChecklist,
    "Each checklist figure must appear in a separate hiding zone. If the scene becomes too crowded, reduce unrelated background crowd detail rather than omitting one of these required figures.",
    "Before finalizing the image, verify that every checklist figure is present exactly once and visually distinguishable by its color, outfit, silhouette, or clue.",
    "Character consistency is important across pages: use the same outfit, colors, proportions, and recognizable visual traits whenever a recurring figure appears.",
    "If multiple reference images are attached, they correspond to the listed characters in order after the source photo. Treat those references as style/identity constraints only; the final page must be a single integrated scene.",
    project.additions ? `Additional motifs to include: ${project.additions}.` : "",
    `Variant direction ${variantIndex + 1}: ${["balanced composition", "more humorous side stories", "richer seasonal atmosphere"][variantIndex] ?? "balanced composition"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createRealGeneratedVariant({
  image,
  prompt,
  project,
  source,
  quality,
  model,
  index,
}: {
  image: string;
  prompt: string;
  project: ProjectConfig;
  source: SourcePage;
  quality: "low" | "medium" | "high";
  model: string;
  index: number;
}) {
  return {
    id: uid(`openai-page-${source.pageNumber}`),
    name: `OpenAI version ${index + 1}`,
    seed: Date.now() + index,
    palette: ["#ef476f", "#118ab2", "#06d6a0", "#ffd166", "#f8f7f2"],
    treatment: styleLabels[project.style],
    density: Math.round(44 + project.complexity * 13 + index * 8),
    sourceFidelity: project.sourceFidelity,
    additions: project.additions,
    targets: [],
    doodles: [],
    generatedImage: image,
    generationPrompt: prompt,
    model,
    quality,
  };
}
