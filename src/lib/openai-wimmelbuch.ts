import { z } from "zod";
import type { PublicAiStatus } from "@/lib/access-control";
import {
  HiddenCharacter,
  ProjectConfig,
  SearchTarget,
  SearchTargetKind,
  SourcePage,
  estimateTargetScaleHint,
  formatLabels,
  styleLabels,
  targetKindLabels,
  uid,
} from "@/lib/wimmelbuch";

export const generationQualitySchema = z.enum(["low", "medium", "high"]).default("low");
export const searchTargetKindSchema = z.enum(["person", "animal", "object", "vehicle", "symbol"]).default("person");

export const generatePageRequestSchema = z.object({
  project: z.object({
    title: z.string().min(1).max(120),
    creator: z.string().max(120),
    targetPages: z.number().int().min(1).max(20),
    format: z.enum(["landscape", "square", "portrait"]),
    style: z.enum(["classic-ink", "modern-editorial", "alpine-storybook", "soft-watercolor"]),
    complexity: z.number().min(1).max(10),
    hidingDifficulty: z.number().min(1).max(10).default(8),
    sourceFidelity: z.number().min(1).max(10),
    additions: z.string().max(1200),
    introText: z.string().max(1600).optional(),
    backCoverText: z.string().max(1600).optional(),
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
        kind: searchTargetKindSchema,
        name: z.string().min(1).max(80),
        clue: z.string().max(240),
        color: z.string().min(1).max(40),
        scaleHint: z.string().max(160).optional(),
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
  baseGeneratedImage: z.string().startsWith("data:image/").optional(),
  revisionPrompt: z.string().max(1200).optional(),
  iteration: z.number().int().min(0).max(2).default(0),
  rightsConfirmed: z.literal(true),
});

export type GeneratePageRequest = z.infer<typeof generatePageRequestSchema>;

export type GeneratePageResponse = {
  ai?: PublicAiStatus;
  warning?: string;
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
    kind: searchTargetKindSchema,
    name: z.string().min(1).max(80),
    clue: z.string().max(240),
    color: z.string().min(1).max(40),
    scaleHint: z.string().max(160).optional(),
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
    "Alpine storybook illustration, cozy Swiss town atmosphere, friendly search targets, textured hand-drawn details",
  "soft-watercolor":
    "soft watercolor and pencil picture-book illustration, luminous colors, gentle contours, richly populated scene",
};

const referenceDirectives: Record<SearchTargetKind, string> = {
  person:
    "Show exactly one full-body person, front-facing or slight three-quarter view, centered on a plain light background.",
  animal:
    "Show exactly one standalone animal, full body, centered on a plain light background. Do not add a human handler.",
  object:
    "Show exactly one standalone object, centered on a plain light background. Do not anthropomorphize it, do not add arms or legs, and do not show a person holding it.",
  vehicle:
    "Show exactly one standalone vehicle, three-quarter view, centered on a plain light background. Do not add a driver or crowd.",
  symbol:
    "Show exactly one simple standalone symbol or emblem, centered on a plain light background. Do not turn it into a mascot or person.",
};

function targetKindGuard(target: Pick<SearchTarget, "kind">) {
  if (target.kind === "person") {
    return "This target is a person; draw it as a small human figure.";
  }

  if (target.kind === "animal") {
    return "This target is an animal; draw it as an animal, not as a human in costume.";
  }

  if (target.kind === "vehicle") {
    return "This target is a vehicle; draw it as a vehicle integrated into streets, paths, or scenery.";
  }

  if (target.kind === "symbol") {
    return "This target is a symbol; draw it as a sign, emblem, sticker, flag, or small mark, not as a character.";
  }

  return "This target is an object; draw the literal object, not a person, mascot, or humanized version.";
}

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
  character: Pick<SearchTarget, "kind" | "name" | "clue" | "color" | "scaleHint">;
}) {
  const kind = character.kind ?? "person";
  const scaleHint = estimateTargetScaleHint(character as SearchTarget);

  return [
    `Create a clean approved search-target reference sheet for "${character.name}" for a premium Wimmelbuch hidden-object picture book.`,
    `Target type: ${targetKindLabels[kind]}. ${targetKindGuard({ kind })}`,
    `Target description: ${character.clue || "recurring hidden-object target"}.`,
    `Main accent color: ${character.color}.`,
    `Expected real-world scale: ${scaleHint}.`,
    `Visual style: ${styleLabels[project.style]} - ${styleDirectives[project.style]}.`,
    referenceDirectives[kind],
    "The design must be distinctive and repeatable across many pages: clear silhouette, colors, and recognizable traits.",
    "No text, labels, arrows, UI, logos, watermarks, copyrighted characters, or background scene.",
    "Keep it child-friendly, charming, and simple enough to be hidden inside a busy Wimmelbuch page at the expected real-world scale.",
  ].join("\n");
}

export function buildWimmelbuchPrompt({
  project,
  source,
  characters,
  placements,
  variantIndex,
  baseGeneratedImage,
  revisionPrompt,
  iteration,
}: {
  project: ProjectConfig;
  source: SourcePage;
  characters: HiddenCharacter[];
  placements?: Record<string, { mode: "random" } | { mode: "manual"; x: number; y: number }>;
  variantIndex: number;
  baseGeneratedImage?: string;
  revisionPrompt?: string;
  iteration?: number;
}) {
  const activeCharacters = characters.slice(0, 5);
  const roster = activeCharacters
    .map((character, index) => {
      const clue = character.clue ? ` Clue: ${character.clue}.` : "";
      const kind = character.kind ?? "person";
      const scaleHint = estimateTargetScaleHint(character);
      const reference =
        character.referenceImage
          ? ` A reference image for this target is provided after the main scene image(s). Use it only as an identity guide for shape, colors, silhouette, and recognizable traits. Do not paste, crop, enlarge, frame, or copy the reference image as a foreground cutout. Redraw the target inside the scene.`
          : " No reference image is provided, so establish a distinctive, repeatable design from the description.";
      const characterPlacement = placements?.[character.id];
      const placement =
        characterPlacement?.mode === "manual"
          ? ` For this page only, this target MUST be hidden near the user-selected point: ${Math.round(characterPlacement.x)}% from the left and ${Math.round(characterPlacement.y)}% from the top of the image. Use that point as the main hiding zone, but tuck the target behind, inside, between, or partly covered by existing scene elements such as flowers, people, windows, vehicles, signs, furniture, trees, or architecture. Integrate it naturally at the correct perspective and scene depth, and do not move it to a different quadrant. Do not put it on an edge, centered foreground, or as a large cropped portrait.`
          : " For this page, choose a natural random hiding place that differs from the other targets and uses partial cover from nearby scene elements.";
      return `${index + 1}. ${character.name}, type ${targetKindLabels[kind]}, accent color ${character.color}. ${targetKindGuard({ kind })} Expected scale: ${scaleHint}.${clue}${reference}${placement}`;
    })
    .join("\n");
  const mandatoryChecklist = activeCharacters
    .map(
      (character, index) =>
        `${index + 1}. ${character.name}: include exactly one hidden ${targetKindLabels[character.kind ?? "person"].toLowerCase()} target, using accent color ${character.color}, at plausible scale: ${estimateTargetScaleHint(character)}, partially covered or camouflaged according to search difficulty.`,
    )
    .join("\n");
  const density =
    project.complexity >= 8
      ? "very dense"
      : project.complexity >= 5
        ? "dense"
        : "moderately dense";
  const hidingDifficulty = project.hidingDifficulty ?? 8;
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
    hidingDifficulty >= 8
      ? "Search difficulty: hard. Draw each recurring search target as a small integrated scene detail at plausible real-world scale, partly hidden behind or inside other objects, camouflaged by nearby colors, and placed in visually busy areas. It should be findable only after careful looking, not obvious at first glance."
      : hidingDifficulty >= 5
        ? "Search difficulty: medium. Draw each recurring search target at plausible real-world scale, blended into the crowd or setting and partly overlapped by nearby details, but still reasonably findable."
        : "Search difficulty: easy. Draw each recurring search target clearly enough to find, while still integrated into the scene at plausible scale.";
  const visibilityGuard =
    hidingDifficulty >= 7
      ? "Important hiding rule: no mandatory target may become the central foreground subject, the largest or brightest figure, a clean full-body front-facing hero pose, or a pasted reference cutout. For striking people or colorful outfits, keep recognizable traits such as hat, color, silhouette, or accessory visible, but hide part of the body behind scenery or crowd detail."
      : "Keep mandatory targets integrated into the scene instead of isolated as foreground cutouts.";

  const opening = baseGeneratedImage
    ? `Revise the uploaded generated Wimmelbuch page for "${source.sourceName}" and keep it as the main base image.`
    : `Create one polished Wimmelbuch hidden-object book page from the uploaded source photo "${source.sourceName}".`;

  return [
    opening,
    baseGeneratedImage
      ? "The first uploaded image is the current generated page to revise. The original source photo is provided after it only as place-reference context. Preserve the chosen composition unless the revision explicitly asks to change it."
      : "",
    revisionPrompt ? `User revision request for iteration ${(iteration ?? 0) + 1}: ${revisionPrompt}.` : "",
    fidelity,
    `Visual style: ${styleLabels[project.style]} - ${styleDirectives[project.style]}.`,
    `Book format: ${formatLabels[project.format]}. Page ${source.pageNumber} of "${project.title}".`,
    `Complexity setting: ${project.complexity}/10 (${density}). ${crowdInstruction}`,
    `Search difficulty setting: ${hidingDifficulty}/10. ${hidingInstruction}`,
    `Source fidelity setting: ${project.sourceFidelity}/10. ${fidelity}`,
    "The complexity, search difficulty, and source fidelity settings are important generation controls; make the visual result noticeably reflect them.",
    "Make the scene child-friendly, PEGI 3, playful, and suitable for a premium printed picture book.",
    visibilityGuard,
    "Transform the place into a lively illustrated panorama with many small narrative micro-scenes, families, pedestrians, tiny jokes, vendors, bicycles, animals, signs without legible brand names, and environmental detail.",
    "Do not add copyrighted characters, recognizable third-party mascots, protected logos, watermarks, or readable real brand text.",
    "Do not write character names anywhere in the image. No name tags, no labels, no captions, no text on clothing or hats.",
    "Avoid photorealism. The result should be a coherent illustrated Wimmelbuch page, not a collage and not a UI mockup.",
    `Mandatory hidden targets: include all ${activeCharacters.length} listed recurring search targets in the final image. Do not omit any configured target, even if the page is crowded.`,
    "Place the following recurring search targets naturally in the image, proportional to the real scene, and findable only by looking. Do not make small objects person-sized. Do not shrink large vehicles or landmarks into toy scale unless the user explicitly says they are toys. No labels, arrows, red circles, colored rings, target outlines, magnifier marks, frames, foreground portraits, or obvious display poses:",
    roster,
    "Mandatory inclusion checklist for the final image:",
    mandatoryChecklist,
    "Each checklist target must appear in a separate hiding zone. If the scene becomes too crowded, reduce unrelated background crowd detail rather than omitting one of these required targets.",
    "Before finalizing the image, verify that every checklist target is present exactly once, visually distinguishable after careful search, not immediately dominant, and scaled plausibly against nearby people, vehicles, furniture, buildings, or landscape elements.",
    "Consistency is important across pages: use the same colors, proportions, and recognizable visual traits whenever a recurring target appears.",
    "If multiple reference images are attached, they correspond to the listed targets in order after the main scene image(s). Treat those references as style/identity constraints only; the final page must be a single integrated scene.",
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
  parentVariantId,
  revisionPrompt,
  iteration = 0,
}: {
  image: string;
  prompt: string;
  project: ProjectConfig;
  source: SourcePage;
  quality: "low" | "medium" | "high";
  model: string;
  index: number;
  parentVariantId?: string;
  revisionPrompt?: string;
  iteration?: number;
}) {
  return {
    id: uid(`openai-page-${source.pageNumber}`),
    name: iteration > 0 ? `Revision ${iteration}.${index + 1}` : `OpenAI version ${index + 1}`,
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
    parentVariantId,
    revisionPrompt,
    iteration,
  };
}
