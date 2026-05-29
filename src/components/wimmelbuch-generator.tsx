"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Eye,
  FileImage,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { BookPageThumb, ScenePreview } from "@/components/scene-preview";
import {
  GenerateCharacterResponse,
  GeneratePageResponse,
  createRealGeneratedVariant,
} from "@/lib/openai-wimmelbuch";
import type { PublicAiStatus } from "@/lib/access-control";
import { createBookPdf } from "@/lib/pdf-export";
import {
  BookPage,
  CharacterPlacement,
  GeneratedVariant,
  HiddenCharacter,
  ProjectConfig,
  SearchTargetKind,
  SourcePage,
  characterInitials,
  createWimmelbuchVariants,
  defaultProject,
  formatLabels,
  styleLabels,
  targetKindLabels,
  uid,
} from "@/lib/wimmelbuch";

const characterColors = ["#ef476f", "#118ab2", "#06d6a0", "#ffd166", "#f77f00"];
const SOURCE_IMAGE_COMPRESSION = { maxEdge: 1280, quality: 0.76 };
const REFERENCE_IMAGE_COMPRESSION = { maxEdge: 720, quality: 0.72 };
const REVISION_IMAGE_COMPRESSION = { maxEdge: 1280, quality: 0.76 };
const OPENAI_VARIANT_COUNT = 3;
const MAX_GENERATION_PAYLOAD_BYTES = 3_800_000;

type GenerationStatus = "idle" | "loading" | "ready" | "error";
type GeneratorMode = "openai" | "mock";
type GenerationQuality = "low" | "medium" | "high";
type ImageCompressionOptions = {
  maxEdge: number;
  quality: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function compressDataUrl(dataUrl: string, options: ImageCompressionOptions) {
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();

  const maxEdge = options.maxEdge;
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", options.quality);
}

async function compressImage(file: File, options: ImageCompressionOptions) {
  const raw = await readFileAsDataUrl(file);

  if (!file.type.startsWith("image/")) {
    return raw;
  }

  return compressDataUrl(raw, options);
}

function jsonPayloadBytes(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

async function readApiResponse<T>(response: Response, fallback: string) {
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={cx(
        "grid h-10 w-10 place-items-center border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-black bg-black text-white hover:bg-black"
          : "border-black/10 bg-white text-neutral-800 hover:border-black/25 hover:bg-neutral-50",
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function SegmentedPhase({
  phase,
  setPhase,
  canGenerate,
  hasBook,
}: {
  phase: number;
  setPhase: (phase: number) => void;
  canGenerate: boolean;
  hasBook: boolean;
}) {
  const phases = [
    { id: 0, label: "Configure", disabled: false },
    { id: 1, label: "Generate", disabled: !canGenerate },
    { id: 2, label: "Book", disabled: !hasBook },
  ];

  return (
    <div className="grid grid-cols-3 border border-black/10 bg-white p-1 shadow-sm">
      {phases.map((item) => (
        <button
          className={cx(
            "h-10 text-sm font-semibold text-neutral-600 transition disabled:cursor-not-allowed disabled:text-neutral-300",
            phase === item.id && "bg-black text-white",
          )}
          disabled={item.disabled}
          key={item.id}
          onClick={() => setPhase(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function WimmelbuchGenerator({ initialAiStatus }: { initialAiStatus: PublicAiStatus }) {
  const [phase, setPhase] = useState(0);
  const [project, setProject] = useState<ProjectConfig>(defaultProject);
  const [characters, setCharacters] = useState<HiddenCharacter[]>([
    {
      id: uid("character"),
      kind: "person",
      name: "Walter",
      clue: "striped scarf near a busy corner",
      color: characterColors[0],
      scaleHint: "person-sized",
    },
    {
      id: uid("character"),
      kind: "object",
      name: "Yellow bag",
      clue: "yellow bag beside a tiny shop",
      color: characterColors[1],
      scaleHint: "handheld bag-sized object",
    },
  ]);
  const [source, setSource] = useState<SourcePage | null>(null);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [bookPages, setBookPages] = useState<BookPage[]>([]);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState("");
  const [revealTargets, setRevealTargets] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>("mock");
  const [generationQuality, setGenerationQuality] = useState<GenerationQuality>("medium");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [selectedPlacementCharacterId, setSelectedPlacementCharacterId] = useState<string | null>(null);
  const [pagePlacements, setPagePlacements] = useState<Record<string, CharacterPlacement>>({});
  const [characterStatus, setCharacterStatus] = useState<Record<string, GenerationStatus>>({});
  const [aiStatus, setAiStatus] = useState<PublicAiStatus>(initialAiStatus);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [coverVariantId, setCoverVariantId] = useState<string | null>(null);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const pageNumber = bookPages.length + 1;
  const canGenerate = Boolean(source && characters.length > 0);
  const isBookComplete = bookPages.length >= project.targetPages;
  const canUseLiveAi = aiStatus.liveAiAvailable;
  const liveAiLabel =
    aiStatus.status === "active"
      ? "active"
      : aiStatus.status === "limit-reached"
        ? "limit reached"
        : aiStatus.status === "missing-key"
          ? "missing key"
          : "paused";
  const liveAiDetail = `${aiStatus.sessionRemaining}/${aiStatus.sessionLimit} live generations remaining`;

  const roster = useMemo(
    () =>
      characters
        .map((character) => {
          const kind = targetKindLabels[character.kind ?? "person"];
          return `${character.name} (${kind})${character.clue ? `: ${character.clue}` : ""}`;
        })
        .join(" / "),
    [characters],
  );


  function updateProject<T extends keyof ProjectConfig>(key: T, value: ProjectConfig[T]) {
    setProject((current) => ({ ...current, [key]: value }));
  }

  async function handleSourceImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const sourceImage = await compressImage(file, SOURCE_IMAGE_COMPRESSION);
    setSource({
      pageNumber,
      sourceName: file.name,
      sourceImage,
    });
    setVariants([]);
    setSelectedVariantId(null);
    setPagePlacements({});
    setSelectedPlacementCharacterId(null);
    setRevisionPrompt("");
    setStatus("idle");
    setError("");
    setPhase(1);
    event.target.value = "";
  }

  async function handleReferenceImage(characterId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const image = await compressImage(file, REFERENCE_IMAGE_COMPRESSION);
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, referenceImage: image } : character,
      ),
    );
    setCharacterStatus((current) => ({ ...current, [characterId]: "ready" }));
    event.target.value = "";
  }

  async function generateCharacterReference(character: HiddenCharacter) {
    if (generatorMode === "openai" && !canUseLiveAi) {
      setError("Live AI is paused, missing configuration, or the session limit is reached. Mock mode remains available.");
      return;
    }

    if (generatorMode === "openai" && !rightsConfirmed) {
      setError("Please confirm that you have the rights to use uploaded images before generating references.");
      return;
    }

    setError("");
    setCharacterStatus((current) => ({ ...current, [character.id]: "loading" }));

    try {
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project,
          character: {
            id: character.id,
            kind: character.kind ?? "person",
            name: character.name,
            clue: character.clue,
            color: character.color,
            scaleHint: character.scaleHint,
          },
          quality: generationQuality,
        }),
      });
      const payload = await readApiResponse<Partial<GenerateCharacterResponse> & {
        ai?: PublicAiStatus;
        error?: string;
      }>(response, "OpenAI target reference generation failed.");

      if (!response.ok) {
        if (payload?.ai) {
          setAiStatus(payload.ai as PublicAiStatus);
        }

        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "OpenAI target reference generation failed. Upload a reference image instead.",
        );
      }

      const characterPayload = payload as GenerateCharacterResponse;

      if (characterPayload.ai) {
        setAiStatus(characterPayload.ai);
      }

      const referenceImage = await compressDataUrl(characterPayload.image, REFERENCE_IMAGE_COMPRESSION);

      setCharacters((current) =>
        current.map((item) =>
          item.id === character.id
            ? { ...item, referenceImage }
            : item,
        ),
      );
      setCharacterStatus((current) => ({ ...current, [character.id]: "ready" }));
    } catch (characterError) {
      setError(characterError instanceof Error ? characterError.message : "Target reference generation failed");
      setCharacterStatus((current) => ({ ...current, [character.id]: "error" }));
    }
  }

  async function requestPageVariants({
    baseGeneratedImage,
    nextRevisionPrompt,
    iteration = 0,
    parentVariantId,
  }: {
    baseGeneratedImage?: string;
    nextRevisionPrompt?: string;
    iteration?: number;
    parentVariantId?: string;
  } = {}) {
    if (!source || isBookComplete) {
      return;
    }

    if (generatorMode === "openai" && !canUseLiveAi) {
      setError("Live AI is paused, missing configuration, or the session limit is reached. Mock mode remains available.");
      setStatus("error");
      return;
    }

    if (generatorMode === "openai" && !rightsConfirmed) {
      setError("Please confirm that you have the rights to use the uploaded source and reference images.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      let nextVariants: GeneratedVariant[];

      if (generatorMode === "openai") {
        if (aiStatus.sessionRemaining < OPENAI_VARIANT_COUNT) {
          throw new Error(
            `Generating ${OPENAI_VARIANT_COUNT} variants requires ${OPENAI_VARIANT_COUNT} live generations. This browser has ${aiStatus.sessionRemaining} remaining.`,
          );
        }

        const requestPayload = {
          project,
          source,
          characters,
          placements: pagePlacements,
          quality: generationQuality,
          variantCount: OPENAI_VARIANT_COUNT,
          baseGeneratedImage,
          revisionPrompt: nextRevisionPrompt,
          iteration,
          rightsConfirmed,
        };
        const requestBytes = jsonPayloadBytes(requestPayload);

        if (requestBytes > MAX_GENERATION_PAYLOAD_BYTES) {
          throw new Error(
            `This generation request is ${formatBytes(requestBytes)}, which is too large for reliable Vercel execution. Re-upload smaller reference images, remove one reference, or use Mock mode.`,
          );
        }

        const response = await fetch("/api/generate-page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });
        const payload = await readApiResponse<Partial<GeneratePageResponse> & {
          ai?: PublicAiStatus;
          error?: string;
        }>(response, "OpenAI page generation failed.");

        if (!response.ok) {
          if (payload?.ai) {
            setAiStatus(payload.ai as PublicAiStatus);
          }

          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "OpenAI generation failed. Use Mock mode if the backend is not configured.",
          );
        }

        const pagePayload = payload as GeneratePageResponse;

        if (pagePayload.ai) {
          setAiStatus(pagePayload.ai);
        }

        nextVariants = pagePayload.variants.map((variant, index) =>
          createRealGeneratedVariant({
            image: variant.generatedImage,
            prompt: variant.generationPrompt,
            project,
            source,
            quality: variant.quality,
            model: variant.model,
            index,
            parentVariantId,
            revisionPrompt: nextRevisionPrompt,
            iteration,
          }),
        );
      } else {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        nextVariants = createWimmelbuchVariants(project, source, characters, pagePlacements).map((variant, index) =>
          nextRevisionPrompt
            ? {
                ...variant,
                id: uid(`mock-revision-${source.pageNumber}`),
                name: `Revision ${iteration}.${index + 1}`,
                parentVariantId,
                revisionPrompt: nextRevisionPrompt,
                iteration,
              }
            : variant,
        );
      }

      setVariants(nextVariants);
      setSelectedVariantId(nextVariants[0]?.id ?? null);
      setRevisionPrompt("");
      setStatus("ready");
      setPhase(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Generation failed");
      setStatus("error");
    }
  }

  async function generateVariants() {
    await requestPageVariants();
  }

  async function reviseSelectedVariant() {
    if (!source || !selectedVariant) {
      return;
    }

    const nextRevisionPrompt = revisionPrompt.trim();

    if (!nextRevisionPrompt) {
      setError("Add a short revision instruction before revising the selected version.");
      return;
    }

    const iteration = (selectedVariant.iteration ?? 0) + 1;

    if (iteration > 2) {
      setError("This MVP allows up to 2 revision rounds per page.");
      return;
    }

    let baseGeneratedImage = selectedVariant.generatedImage;

    if (generatorMode === "openai") {
      if (!baseGeneratedImage) {
        setError("Select a generated OpenAI version before revising.");
        return;
      }

      baseGeneratedImage = await compressDataUrl(baseGeneratedImage, REVISION_IMAGE_COMPRESSION);
    }

    await requestPageVariants({
      baseGeneratedImage,
      nextRevisionPrompt,
      iteration,
      parentVariantId: selectedVariant.id,
    });
  }

  function addPageToBook() {
    if (!source || !selectedVariant) {
      return;
    }

    setBookPages((current) => [
      ...current,
      {
        ...source,
        variant: selectedVariant,
        characters,
      },
    ]);
    setCoverVariantId((current) => current ?? selectedVariant.id);
    setSource(null);
    setVariants([]);
    setSelectedVariantId(null);
    setPagePlacements({});
    setSelectedPlacementCharacterId(null);
    setRevisionPrompt("");
    setStatus("idle");
    setPhase(2);
  }

  async function exportPdf() {
    if (bookPages.length === 0) {
      return;
    }

    setIsExporting(true);
    setError("");

    try {
      const bytes = await createBookPdf(project, bookPages, { coverVariantId });
      const pdfBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(pdfBuffer).set(bytes);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "wimmelbuch"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PDF export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function addCharacter() {
    if (characters.length >= 5) {
      return;
    }

    setCharacters((current) => [
      ...current,
      {
        id: uid("character"),
        kind: "object",
        name: `Search target ${current.length + 1}`,
        clue: "hidden in the scene",
        color: characterColors[current.length % characterColors.length],
        scaleHint: "",
      },
    ]);
  }

  function setCharacterPlacement(characterId: string, placement: CharacterPlacement) {
    setPagePlacements((current) => {
      if (placement.mode === "random") {
        const next = { ...current };
        delete next[characterId];
        return next;
      }

      return { ...current, [characterId]: placement };
    });
  }

  function pickManualPlacement(x: number, y: number) {
    if (!selectedPlacementCharacterId) {
      return;
    }

    setCharacterPlacement(selectedPlacementCharacterId, { mode: "manual", x, y });
    setSelectedPlacementCharacterId(null);
  }

  function resetCurrentPage() {
    setSource(null);
    setVariants([]);
    setSelectedVariantId(null);
    setPagePlacements({});
    setSelectedPlacementCharacterId(null);
    setRevisionPrompt("");
    setStatus("idle");
    setError("");
    setPhase(0);
  }

  return (
    <main className="min-h-screen bg-[#f6f4ee] text-neutral-950">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center bg-black text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal sm:text-3xl">Wimmelbuch Generator</h1>
              <p className="text-sm font-medium text-neutral-500">{project.title}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:items-center">
            <div className="border border-black/10 bg-[#fdfbf5] px-4 py-2">
              <p className="font-mono text-lg font-black">{pageNumber}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Next page</p>
            </div>
            <div className="border border-black/10 bg-[#fdfbf5] px-4 py-2">
              <p className="font-mono text-lg font-black">{bookPages.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">In book</p>
            </div>
            <div className="border border-black/10 bg-[#fdfbf5] px-4 py-2">
              <p className="font-mono text-lg font-black">{project.targetPages}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Target</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)_330px] lg:px-8">
        <aside className="space-y-4">
          <SegmentedPhase canGenerate={canGenerate} hasBook={bookPages.length > 0} phase={phase} setPhase={setPhase} />

          <section className={cx("border border-black/10 bg-white p-4 shadow-sm", phase !== 0 && "hidden lg:block")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Project</h2>
              <Sparkles className="h-5 w-5 text-[#ef476f]" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Book title</FieldLabel>
                <input
                  className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                  onChange={(event) => updateProject("title", event.target.value)}
                  value={project.title}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Creator</FieldLabel>
                <input
                  className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                  onChange={(event) => updateProject("creator", event.target.value)}
                  value={project.creator}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Pages</FieldLabel>
                  <input
                    className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                    max={16}
                    min={1}
                    onChange={(event) => updateProject("targetPages", Number(event.target.value))}
                    type="number"
                    value={project.targetPages}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Format</FieldLabel>
                  <select
                    className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                    onChange={(event) => updateProject("format", event.target.value as ProjectConfig["format"])}
                    value={project.format}
                  >
                    {Object.entries(formatLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Style</FieldLabel>
                <select
                  className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                  onChange={(event) => updateProject("style", event.target.value as ProjectConfig["style"])}
                  value={project.style}
                >
                  {Object.entries(styleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Complexity</FieldLabel>
                  <span className="font-mono text-xs font-black">{project.complexity}/10</span>
                </div>
                <input
                  className="w-full accent-black"
                  max={10}
                  min={1}
                  onChange={(event) => updateProject("complexity", Number(event.target.value))}
                  type="range"
                  value={project.complexity}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Source fidelity</FieldLabel>
                  <span className="font-mono text-xs font-black">{project.sourceFidelity}/10</span>
                </div>
                <input
                  className="w-full accent-black"
                  max={10}
                  min={1}
                  onChange={(event) => updateProject("sourceFidelity", Number(event.target.value))}
                  type="range"
                  value={project.sourceFidelity}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Additions</FieldLabel>
                <textarea
                  className="min-h-24 w-full resize-none border border-black/10 bg-[#fdfbf5] p-3 text-sm font-medium outline-none transition focus:border-black"
                  onChange={(event) => updateProject("additions", event.target.value)}
                  value={project.additions}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Generator</FieldLabel>
                <div className="grid grid-cols-2 border border-black/10 bg-[#fdfbf5] p-1">
                  {(["openai", "mock"] as GeneratorMode[]).map((mode) => (
                    <button
                      className={cx(
                        "h-9 text-sm font-black capitalize text-neutral-600 transition disabled:cursor-not-allowed disabled:opacity-35",
                        generatorMode === mode && "bg-black text-white",
                      )}
                      disabled={mode === "openai" && !canUseLiveAi}
                      key={mode}
                      onClick={() => {
                        setGeneratorMode(mode);
                        setError("");
                      }}
                      type="button"
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="border border-black/10 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Live AI</span>
                    <span
                      className={cx(
                        "text-xs font-black uppercase tracking-[0.12em]",
                        canUseLiveAi ? "text-[#118ab2]" : "text-neutral-500",
                      )}
                    >
                      {liveAiLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">{liveAiDetail}</p>
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Quality</FieldLabel>
                <select
                  className="h-11 w-full border border-black/10 bg-[#fdfbf5] px-3 text-sm font-semibold outline-none transition focus:border-black"
                  disabled={generatorMode === "mock" || !canUseLiveAi}
                  onChange={(event) => setGenerationQuality(event.target.value as GenerationQuality)}
                  value={generationQuality}
                >
                  <option value="low">Low preview</option>
                  <option value="medium">Medium showcase</option>
                  <option value="high">High print test</option>
                </select>
              </div>
              <label className="flex items-start gap-3 border border-black/10 bg-[#fdfbf5] p-3 text-xs font-semibold leading-5 text-neutral-600">
                <input
                  checked={rightsConfirmed}
                  className="mt-1 accent-black"
                  onChange={(event) => setRightsConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I confirm that I have the rights to use all uploaded source and reference images for this
                  generation.
                </span>
              </label>
            </div>
          </section>

          <section className={cx("border border-black/10 bg-white p-4 shadow-sm", phase !== 0 && "hidden lg:block")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Search targets</h2>
                <p className="text-xs font-bold text-neutral-500">Define each recurring person, animal, or item once.</p>
              </div>
              <IconButton disabled={characters.length >= 5} onClick={addCharacter} title="Add search target">
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="space-y-3">
              {characters.map((character, index) => (
                <div className="border border-black/10 bg-[#fdfbf5] p-3" key={character.id}>
                  {(() => {
                    const placement = pagePlacements[character.id];
                    const status = characterStatus[character.id] ?? "idle";

                    return (
                      <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="grid h-8 w-8 place-items-center border border-black/15 text-xs font-black"
                        style={{ backgroundColor: character.color }}
                      >
                        {characterInitials(character.name)}
                      </span>
                      <input
                        className="h-9 min-w-0 flex-1 border border-transparent bg-white px-2 text-sm font-bold outline-none transition focus:border-black/20"
                        onChange={(event) =>
                          setCharacters((current) =>
                            current.map((item) =>
                              item.id === character.id ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        value={character.name}
                      />
                    </div>
                    <button
                      className="grid h-8 w-8 place-items-center border border-black/10 bg-white text-neutral-500 transition hover:text-red-600 disabled:opacity-30"
                      disabled={characters.length === 1}
                      onClick={() =>
                        setCharacters((current) => current.filter((item) => item.id !== character.id))
                      }
                      title="Remove search target"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <FieldLabel>Type</FieldLabel>
                      <select
                        className="h-9 w-full border border-black/10 bg-white px-2 text-xs font-bold outline-none transition focus:border-black/20"
                        onChange={(event) =>
                          setCharacters((current) =>
                            current.map((item) =>
                              item.id === character.id
                                ? { ...item, kind: event.target.value as SearchTargetKind }
                                : item,
                            ),
                          )
                        }
                        value={character.kind ?? "person"}
                      >
                        {Object.entries(targetKindLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Scale hint</FieldLabel>
                      <input
                        className="h-9 w-full border border-black/10 bg-white px-2 text-xs font-bold outline-none transition focus:border-black/20"
                        onChange={(event) =>
                          setCharacters((current) =>
                            current.map((item) =>
                              item.id === character.id ? { ...item, scaleHint: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="hand-sized, car-sized..."
                        value={character.scaleHint ?? ""}
                      />
                    </div>
                  </div>
                  <textarea
                    className="mb-3 min-h-16 w-full resize-none border border-black/10 bg-white p-2 text-sm outline-none transition focus:border-black/20"
                    onChange={(event) =>
                      setCharacters((current) =>
                        current.map((item) =>
                          item.id === character.id ? { ...item, clue: event.target.value } : item,
                        ),
                      )
                    }
                    value={character.clue}
                  />
                  <div className="mb-3 grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="flex aspect-square items-center justify-center overflow-hidden border border-black/10 bg-white">
                      {character.referenceImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`${character.name} reference`}
                          className="h-full w-full object-cover"
                          src={character.referenceImage}
                        />
                      ) : (
                        <span
                          className="grid h-12 w-12 place-items-center border border-black/15 text-sm font-black"
                          style={{ backgroundColor: character.color }}
                        >
                          {characterInitials(character.name)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Approved look</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex h-9 cursor-pointer items-center justify-center gap-2 border border-black/10 bg-white px-2 text-xs font-black text-neutral-700 transition hover:border-black/25">
                          <ImagePlus className="h-4 w-4" />
                          Upload
                          <input
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) => handleReferenceImage(character.id, event)}
                            type="file"
                          />
                        </label>
                        <button
                          className="flex h-9 items-center justify-center gap-2 border border-black/10 bg-white px-2 text-xs font-black text-neutral-700 transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={status === "loading" || generatorMode === "mock" || !canUseLiveAi}
                          onClick={() => generateCharacterReference(character)}
                          type="button"
                        >
                          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Generate
                        </button>
                      </div>
                      <p className="text-xs font-semibold text-neutral-500">
                        {character.referenceImage
                          ? "This reference is reused on every page for consistency."
                          : "Upload or generate a stable target reference before making many pages."}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 space-y-2">
                    <FieldLabel>Page placement</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={cx(
                          "h-9 border px-2 text-xs font-black transition",
                          placement?.mode !== "manual"
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-white text-neutral-700 hover:border-black/25",
                        )}
                        onClick={() => {
                          setCharacterPlacement(character.id, { mode: "random" });
                          if (selectedPlacementCharacterId === character.id) {
                            setSelectedPlacementCharacterId(null);
                          }
                        }}
                        type="button"
                      >
                        Random
                      </button>
                      <button
                        className={cx(
                          "h-9 border px-2 text-xs font-black transition",
                          selectedPlacementCharacterId === character.id
                            ? "border-black bg-[#ffd166] text-black"
                            : placement?.mode === "manual"
                              ? "border-black bg-black text-white"
                              : "border-black/10 bg-white text-neutral-700 hover:border-black/25",
                        )}
                        onClick={() => setSelectedPlacementCharacterId(character.id)}
                        type="button"
                      >
                        {placement?.mode === "manual" ? "Change" : "Pick"}
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-neutral-500">
                      {selectedPlacementCharacterId === character.id
                        ? "Click the source image."
                        : placement?.mode === "manual"
                          ? `Manual point for this page: ${Math.round(placement.x)}%, ${Math.round(placement.y)}%.`
                          : "OpenAI chooses a hiding place and plausible scale."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {characterColors.map((color) => (
                        <button
                          aria-label={`Use ${color}`}
                          className={cx(
                            "h-6 w-6 border border-black/15",
                            character.color === color && "ring-2 ring-black ring-offset-2",
                          )}
                          key={color}
                          onClick={() =>
                            setCharacters((current) =>
                              current.map((item) =>
                                item.id === character.id ? { ...item, color } : item,
                              ),
                            )
                          }
                          style={{ backgroundColor: color }}
                          type="button"
                        />
                      ))}
                    </div>
                    {character.referenceImage ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                        <span className="h-2 w-2 bg-[#06d6a0]" />
                        Reference ready
                      </div>
                    ) : null}
                  </div>
                  <input
                    className="sr-only"
                    readOnly
                    tabIndex={-1}
                    value={`character-${index + 1}`}
                  />
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-4 border border-black/10 bg-white p-4 shadow-sm lg:grid-cols-[1fr_190px]">
            <div className="flex min-w-0 flex-col justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                  Page {pageNumber} source
                </p>
                <h2 className="truncate text-xl font-black">{source?.sourceName ?? "No image selected"}</h2>
              </div>
              <p className="truncate text-sm font-semibold text-neutral-500">{roster}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={cx(
                  "flex h-12 cursor-pointer items-center justify-center gap-2 border border-black bg-black px-3 text-sm font-black text-white transition hover:bg-neutral-800",
                  isBookComplete && "pointer-events-none opacity-40",
                )}
              >
                <FileImage className="h-4 w-4" />
                Upload
                <input
                  accept="image/*"
                  className="sr-only"
                  disabled={isBookComplete}
                  onChange={handleSourceImage}
                  type="file"
                />
              </label>
              <button
                className="flex h-12 items-center justify-center gap-2 border border-black/10 bg-[#ffd166] px-3 text-sm font-black text-black transition hover:bg-[#f6c550] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  !canGenerate ||
                  status === "loading" ||
                  isBookComplete ||
                  (generatorMode === "openai" && !canUseLiveAi) ||
                  (generatorMode === "openai" && !rightsConfirmed)
                }
                onClick={generateVariants}
                type="button"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate 3
              </button>
            </div>
          </div>

          <div className="border border-black/10 bg-white p-4 shadow-sm">
            <ScenePreview
              image={source?.sourceImage}
              label={selectedVariant ? selectedVariant.name : source ? "Source image" : "Workspace"}
              activePlacementCharacterId={selectedPlacementCharacterId}
              onPickPlacement={source && !selectedVariant ? pickManualPlacement : undefined}
              placements={source && !selectedVariant ? pagePlacements : {}}
              revealTargets={revealTargets}
              variant={selectedVariant}
              characters={characters}
            />
            {source && !selectedVariant && selectedPlacementCharacterId ? (
              <p className="mt-3 border border-black/10 bg-[#fdfbf5] px-3 py-2 text-sm font-semibold text-neutral-600">
                Click the source image to choose where this search target should be hidden.
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {selectedVariant && !selectedVariant.generatedImage ? (
                  <IconButton active={revealTargets} onClick={() => setRevealTargets((current) => !current)} title="Reveal targets">
                    <Eye className="h-4 w-4" />
                  </IconButton>
                ) : null}
                {source || variants.length > 0 ? (
                  <button
                    className="flex h-10 items-center justify-center gap-2 border border-black/10 bg-white px-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-black/25 hover:bg-neutral-50"
                    onClick={resetCurrentPage}
                    type="button"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Clear page
                  </button>
                ) : null}
              </div>
              <button
                className="flex h-11 items-center justify-center gap-2 border border-black bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedVariant || !source}
                onClick={addPageToBook}
                type="button"
              >
                Use this page
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {selectedVariant ? (
              <div className="mt-3 grid gap-2 border border-black/10 bg-[#fdfbf5] p-3">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Revise selected version</FieldLabel>
                  <span className="text-xs font-bold text-neutral-500">
                    {(selectedVariant.iteration ?? 0)}/2 revisions used
                  </span>
                </div>
                <textarea
                  className="min-h-20 w-full resize-none border border-black/10 bg-white p-3 text-sm font-medium outline-none transition focus:border-black/20"
                  onChange={(event) => setRevisionPrompt(event.target.value)}
                  placeholder="Example: make the football smaller, keep the church closer to the source photo, add more children near the fountain."
                  value={revisionPrompt}
                />
                <button
                  className="flex h-10 items-center justify-center gap-2 border border-black/10 bg-white px-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-black/25 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={status === "loading" || (selectedVariant.iteration ?? 0) >= 2}
                  onClick={reviseSelectedVariant}
                  type="button"
                >
                  {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Revise into 3 variants
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
          ) : null}

          <div
            className={cx(
              "grid gap-3",
              variants.length > 0 && "md:grid-cols-3",
              phase === 0 && variants.length === 0 && "hidden lg:grid",
            )}
          >
            {variants.length > 0
              ? variants.map((variant) => (
                  <button
                    className={cx(
                      "border border-black/10 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black/25",
                      selectedVariantId === variant.id && "border-black ring-2 ring-black",
                    )}
                    key={variant.id}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setPhase(1);
                    }}
                    type="button"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-black">{variant.name}</span>
                      {selectedVariantId === variant.id ? <Check className="h-4 w-4" /> : null}
                    </div>
                    <ScenePreview
                      compact
                      image={source?.sourceImage}
                      label={variant.treatment}
                      revealTargets={false}
                      variant={variant}
                      characters={characters}
                    />
                    <div className="mt-3 flex gap-1">
                      {variant.generatedImage ? (
                        <span className="truncate text-xs font-bold text-neutral-500">
                          {variant.model} / {variant.quality}
                        </span>
                      ) : (
                        variant.palette.slice(0, 4).map((color) => (
                          <span className="h-3 flex-1 border border-black/10" key={color} style={{ backgroundColor: color }} />
                        ))
                      )}
                    </div>
                  </button>
                ))
              : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Book</h2>
                <p className="text-sm font-semibold text-neutral-500">
                  {bookPages.length}/{project.targetPages} pages
                </p>
              </div>
              <button
                className="grid h-10 w-10 place-items-center border border-black bg-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={bookPages.length === 0 || isExporting}
                onClick={exportPdf}
                title="Export PDF"
                type="button"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </button>
            </div>

            <div className="space-y-3">
              {bookPages.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#fdfbf5] p-4">
                  <BookOpen className="mb-8 h-8 w-8 text-neutral-400" />
                  <p className="text-sm font-bold text-neutral-500">Pages appear here after selection.</p>
                </div>
              ) : (
                bookPages.map((page) => (
                  <div className="border border-black/10 bg-[#fdfbf5] p-2" key={`${page.pageNumber}-${page.variant.id}`}>
                    <BookPageThumb page={page} />
                    <div className="mt-2 flex items-center justify-between text-xs font-bold">
                      <span>Page {page.pageNumber}</span>
                      <span>{page.variant.name}</span>
                    </div>
                    <button
                      className={cx(
                        "mt-2 h-8 w-full border px-2 text-xs font-black transition",
                        coverVariantId === page.variant.id
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white text-neutral-700 hover:border-black/25",
                      )}
                      onClick={() => setCoverVariantId(page.variant.id)}
                      type="button"
                    >
                      {coverVariantId === page.variant.id ? "Cover selected" : "Use as cover"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {characters.map((character) => (
              <div className="border border-black/10 bg-white p-3 shadow-sm" key={character.id}>
                {character.referenceImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${character.name} reference`}
                    className="mb-3 h-14 w-14 border border-black/15 object-cover"
                    src={character.referenceImage}
                  />
                ) : (
                  <div
                    className="mb-3 grid h-10 w-10 place-items-center border border-black/15 text-sm font-black"
                    style={{ backgroundColor: character.color }}
                  >
                    {characterInitials(character.name)}
                  </div>
                )}
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  {targetKindLabels[character.kind ?? "person"]}
                </p>
                <p className="truncate text-sm font-black">{character.name}</p>
                <p className="line-clamp-2 text-xs font-semibold text-neutral-500">{character.clue}</p>
                {character.scaleHint ? (
                  <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-neutral-400">
                    {character.scaleHint}
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
