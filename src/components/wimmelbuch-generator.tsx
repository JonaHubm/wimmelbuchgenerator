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
  BookPage,
  GeneratedVariant,
  HiddenCharacter,
  ProjectConfig,
  SourcePage,
  characterInitials,
  defaultProject,
  formatLabels,
  styleLabels,
  uid,
} from "@/lib/wimmelbuch";

const characterColors = ["#ef476f", "#118ab2", "#06d6a0", "#ffd166", "#f77f00"];

type GenerationStatus = "idle" | "loading" | "ready" | "error";

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

async function compressImage(file: File) {
  const raw = await readFileAsDataUrl(file);

  if (!file.type.startsWith("image/")) {
    return raw;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = raw;
  await image.decode();

  const maxEdge = 1500;
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return raw;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
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

export function WimmelbuchGenerator() {
  const [phase, setPhase] = useState(0);
  const [project, setProject] = useState<ProjectConfig>(defaultProject);
  const [characters, setCharacters] = useState<HiddenCharacter[]>([
    {
      id: uid("character"),
      name: "Walter",
      clue: "striped scarf near a busy corner",
      color: characterColors[0],
    },
    {
      id: uid("character"),
      name: "Mila",
      clue: "yellow bag beside a tiny shop",
      color: characterColors[1],
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

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const pageNumber = bookPages.length + 1;
  const canGenerate = Boolean(source && characters.length > 0);
  const isBookComplete = bookPages.length >= project.targetPages;

  const roster = useMemo(
    () =>
      characters
        .map((character) => `${character.name}${character.clue ? `: ${character.clue}` : ""}`)
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

    const sourceImage = await compressImage(file);
    setSource({
      pageNumber,
      sourceName: file.name,
      sourceImage,
    });
    setVariants([]);
    setSelectedVariantId(null);
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

    const image = await compressImage(file);
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, referenceImage: image } : character,
      ),
    );
    event.target.value = "";
  }

  async function generateVariants() {
    if (!source || isBookComplete) {
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const payload = await fetchJson<{ variants: GeneratedVariant[] }>("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, source, characters }),
      });
      setVariants(payload.variants);
      setSelectedVariantId(payload.variants[0]?.id ?? null);
      setStatus("ready");
      setPhase(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Generation failed");
      setStatus("error");
    }
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
    setSource(null);
    setVariants([]);
    setSelectedVariantId(null);
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
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, pages: bookPages }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "PDF export failed");
      }

      const blob = await response.blob();
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
        name: `Character ${current.length + 1}`,
        clue: "hidden in the crowd",
        color: characterColors[current.length % characterColors.length],
      },
    ]);
  }

  function resetCurrentPage() {
    setSource(null);
    setVariants([]);
    setSelectedVariantId(null);
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
            </div>
          </section>

          <section className={cx("border border-black/10 bg-white p-4 shadow-sm", phase !== 0 && "hidden lg:block")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Characters</h2>
              <IconButton disabled={characters.length >= 5} onClick={addCharacter} title="Add character">
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="space-y-3">
              {characters.map((character, index) => (
                <div className="border border-black/10 bg-[#fdfbf5] p-3" key={character.id}>
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
                      title="Remove character"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                    <label
                      className="grid h-8 w-8 cursor-pointer place-items-center border border-black/10 bg-white text-neutral-700 transition hover:border-black/25"
                      title="Upload reference"
                    >
                      <ImagePlus className="h-4 w-4" />
                      <input
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => handleReferenceImage(character.id, event)}
                        type="file"
                      />
                    </label>
                  </div>
                  {character.referenceImage ? (
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-neutral-500">
                      <span className="h-2 w-2 bg-[#06d6a0]" />
                      Reference loaded
                    </div>
                  ) : null}
                  <input
                    className="sr-only"
                    readOnly
                    tabIndex={-1}
                    value={`character-${index + 1}`}
                  />
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
                disabled={!canGenerate || status === "loading" || isBookComplete}
                onClick={generateVariants}
                type="button"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate
              </button>
            </div>
          </div>

          <div className="border border-black/10 bg-white p-4 shadow-sm">
            <ScenePreview
              image={source?.sourceImage ?? bookPages.at(-1)?.sourceImage}
              label={selectedVariant ? selectedVariant.name : source ? "Source image" : "Workspace"}
              revealTargets={revealTargets}
              variant={selectedVariant}
              characters={characters}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <IconButton active={revealTargets} onClick={() => setRevealTargets((current) => !current)} title="Reveal targets">
                  <Eye className="h-4 w-4" />
                </IconButton>
                <IconButton onClick={resetCurrentPage} title="Reset current page">
                  <RefreshCcw className="h-4 w-4" />
                </IconButton>
              </div>
              <button
                className="flex h-11 items-center justify-center gap-2 border border-black bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedVariant || !source}
                onClick={addPageToBook}
                type="button"
              >
                Add page
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
          ) : null}

          <div className={cx("grid gap-3 md:grid-cols-3", phase === 0 && variants.length === 0 && "hidden lg:grid")}>
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
                      {variant.palette.slice(0, 4).map((color) => (
                        <span className="h-3 flex-1 border border-black/10" key={color} style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </button>
                ))
              : [1, 2, 3].map((item) => (
                  <div className="border border-dashed border-black/15 bg-white/70 p-3" key={item}>
                    <div className="mb-3 h-4 w-24 bg-neutral-200" />
                    <ScenePreview compact label={`Version ${item}`} />
                  </div>
                ))}
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
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {characters.map((character) => (
              <div className="border border-black/10 bg-white p-3 shadow-sm" key={character.id}>
                <div
                  className="mb-3 grid h-10 w-10 place-items-center border border-black/15 text-sm font-black"
                  style={{ backgroundColor: character.color }}
                >
                  {characterInitials(character.name)}
                </div>
                <p className="truncate text-sm font-black">{character.name}</p>
                <p className="line-clamp-2 text-xs font-semibold text-neutral-500">{character.clue}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
