export type ProjectConfig = {
  title: string;
  creator: string;
  targetPages: number;
  format: "landscape" | "square" | "portrait";
  style: "classic-ink" | "modern-editorial" | "alpine-storybook" | "soft-watercolor";
  complexity: number;
  sourceFidelity: number;
  additions: string;
};

export type SearchTargetKind = "person" | "animal" | "object" | "vehicle" | "symbol";

export type SearchTarget = {
  id: string;
  kind: SearchTargetKind;
  name: string;
  clue: string;
  color: string;
  scaleHint?: string;
  referenceImage?: string;
};

export type HiddenCharacter = SearchTarget;

export type CharacterPlacement =
  | {
      mode: "random";
    }
  | {
      mode: "manual";
      x: number;
      y: number;
    };

export type SourcePage = {
  pageNumber: number;
  sourceName: string;
  sourceImage: string;
};

export type TargetPlacement = {
  characterId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type DoodleShape =
  | "person"
  | "umbrella"
  | "tree"
  | "bike"
  | "star"
  | "balloon"
  | "house"
  | "flag";

export type Doodle = {
  id: string;
  shape: DoodleShape;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  opacity: number;
};

export type GeneratedVariant = {
  id: string;
  name: string;
  seed: number;
  palette: string[];
  treatment: string;
  density: number;
  sourceFidelity: number;
  additions: string;
  targets: TargetPlacement[];
  doodles: Doodle[];
  generatedImage?: string;
  generationPrompt?: string;
  model?: string;
  quality?: "low" | "medium" | "high";
  parentVariantId?: string;
  revisionPrompt?: string;
  iteration?: number;
};

export type BookPage = SourcePage & {
  variant: GeneratedVariant;
  characters: HiddenCharacter[];
};

export const defaultProject: ProjectConfig = {
  title: "My Wimmelbuch",
  creator: "Family Studio",
  targetPages: 6,
  format: "landscape",
  style: "classic-ink",
  complexity: 7,
  sourceFidelity: 8,
  additions: "street musicians, small market stands, balloons, bicycles",
};

export const styleLabels: Record<ProjectConfig["style"], string> = {
  "classic-ink": "Classic ink",
  "modern-editorial": "Modern editorial",
  "alpine-storybook": "Alpine storybook",
  "soft-watercolor": "Soft watercolor",
};

export const formatLabels: Record<ProjectConfig["format"], string> = {
  landscape: "Landscape",
  square: "Square",
  portrait: "Portrait",
};

export const targetKindLabels: Record<SearchTargetKind, string> = {
  person: "Person",
  animal: "Animal",
  object: "Object",
  vehicle: "Vehicle",
  symbol: "Symbol",
};

const palettes = [
  ["#e84d5b", "#1e988a", "#f4b63f", "#315a9d", "#f6efe5"],
  ["#ef6b35", "#2a9d8f", "#264653", "#e9c46a", "#f7f1e1"],
  ["#d9476f", "#2176ae", "#66a182", "#f6c85f", "#f5f0e8"],
  ["#ef476f", "#118ab2", "#06d6a0", "#ffd166", "#f8f7f2"],
];

const shapes: DoodleShape[] = [
  "person",
  "umbrella",
  "tree",
  "bike",
  "star",
  "balloon",
  "house",
  "flag",
];

const treatments: Record<ProjectConfig["style"], string[]> = {
  "classic-ink": ["ink-rich crowd", "crosshatched village", "storybook street"],
  "modern-editorial": ["clean editorial bustle", "poster-like town map", "bright civic scene"],
  "alpine-storybook": ["alpine festival", "mountain town fair", "cozy chalet puzzle"],
  "soft-watercolor": ["watercolor market", "soft pencil panorama", "sunny wash scene"],
};

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function estimateTargetScaleHint(target: SearchTarget) {
  if (target.scaleHint?.trim()) {
    return target.scaleHint.trim();
  }

  const normalized = `${target.name} ${target.clue}`.toLowerCase();

  if (/\b(ball|coin|key|ring|watch|phone|cup|toy|sticker|badge|flower|bottle|book|hat)\b/.test(normalized)) {
    return "small handheld object, clearly smaller than a nearby person";
  }

  if (/\b(car|truck|bus|tractor|van|bike|bicycle|scooter|boat|train|vehicle)\b/.test(normalized)) {
    return "vehicle-sized, scaled against nearby people and streets";
  }

  if (/\b(building|tower|church|house|castle|crane|monument|tree|statue)\b/.test(normalized)) {
    return "large scene element, scaled against buildings and landscape";
  }

  if (target.kind === "animal") {
    return "animal-sized, proportional to nearby people and objects";
  }

  if (target.kind === "vehicle") {
    return "vehicle-sized, scaled against nearby people and streets";
  }

  if (target.kind === "symbol") {
    return "small sign or emblem-sized mark, not a person-sized figure";
  }

  if (target.kind === "object") {
    return "object-sized, realistically smaller or larger depending on the described item";
  }

  return "person-sized, proportional to nearby people in the scene";
}

export function estimateTargetPreviewScale(target: SearchTarget) {
  const scaleHint = estimateTargetScaleHint(target).toLowerCase();

  if (/\b(tiny|sticker|coin|key|ring|handheld|small)\b/.test(scaleHint)) {
    return 0.68;
  }

  if (/\b(large|building|tower|church|house|castle|crane|monument|tree|statue)\b/.test(scaleHint)) {
    return 1.42;
  }

  if (/\b(vehicle|car|truck|bus|tractor|van|boat|train)\b/.test(scaleHint)) {
    return 1.18;
  }

  if (target.kind === "symbol" || target.kind === "object") {
    return 0.82;
  }

  if (target.kind === "animal") {
    return 0.92;
  }

  return 1;
}

export function makeSeed(...parts: Array<string | number | undefined>) {
  const input = parts.filter(Boolean).join("|");
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createRng(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWimmelbuchVariants(
  project: ProjectConfig,
  source: SourcePage,
  characters: HiddenCharacter[],
  placements: Record<string, CharacterPlacement> = {},
) {
  const complexity = clamp(project.complexity, 1, 10);
  const fidelity = clamp(project.sourceFidelity, 1, 10);
  const activeCharacters = characters.slice(0, 5);

  return Array.from({ length: 3 }, (_, variantIndex) => {
    const seed = makeSeed(
      project.title,
      project.style,
      source.sourceName,
      source.pageNumber,
      project.complexity,
      project.additions,
      variantIndex,
    );
    const rng = createRng(seed);
    const palette = palettes[(variantIndex + Math.floor(rng() * palettes.length)) % palettes.length];
    const density = Math.round(44 + complexity * 13 + variantIndex * 8);
    const treatmentList = treatments[project.style];
    const treatment = treatmentList[variantIndex % treatmentList.length];
    const targetZones = [
      { x: 18, y: 22 },
      { x: 78, y: 25 },
      { x: 27, y: 70 },
      { x: 69, y: 68 },
      { x: 52, y: 48 },
    ];

    const targets = activeCharacters.map((character, index) => {
      const placement = placements[character.id];
      const zone =
        placement?.mode === "manual"
          ? { x: placement.x, y: placement.y }
          : targetZones[(index + variantIndex) % targetZones.length];
      return {
        characterId: character.id,
        x: clamp(zone.x + (rng() - 0.5) * 18, 8, 92),
        y: clamp(zone.y + (rng() - 0.5) * 16, 10, 88),
        scale: estimateTargetPreviewScale(character) + (rng() - 0.5) * 0.16,
        rotation: Math.round((rng() - 0.5) * 28),
      };
    });

    const doodles = Array.from({ length: density }, (_, index) => ({
      id: `doodle-${variantIndex}-${index}`,
      shape: shapes[Math.floor(rng() * shapes.length)],
      x: 4 + rng() * 92,
      y: 8 + rng() * 78,
      size: 0.5 + rng() * 1.3,
      color: palette[Math.floor(rng() * (palette.length - 1))],
      rotation: Math.round((rng() - 0.5) * 45),
      opacity: 0.36 + rng() * 0.34,
    }));

    return {
      id: `variant-${source.pageNumber}-${variantIndex + 1}-${seed}`,
      name: `Version ${variantIndex + 1}`,
      seed,
      palette,
      treatment,
      density,
      sourceFidelity: fidelity,
      additions: project.additions,
      targets,
      doodles,
    } satisfies GeneratedVariant;
  });
}

export function characterInitials(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);

  if (pieces.length === 0) {
    return "?";
  }

  return pieces
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase())
    .join("");
}

export function dataUrlMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match?.[1] ?? "application/octet-stream";
}

export function dataUrlBase64(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}
