"use client";

import type { BookPage, GeneratedVariant, HiddenCharacter } from "@/lib/wimmelbuch";
import { characterInitials } from "@/lib/wimmelbuch";

type ScenePreviewProps = {
  image?: string;
  variant?: GeneratedVariant;
  characters?: HiddenCharacter[];
  compact?: boolean;
  revealTargets?: boolean;
  label?: string;
};

const emptyGrid = Array.from({ length: 80 }, (_, index) => index);

function DoodleMark({
  shape,
  color,
  compact,
}: {
  shape: string;
  color: string;
  compact?: boolean;
}) {
  const strokeWidth = compact ? 3 : 2;

  if (shape === "person") {
    return (
      <>
        <circle cx="12" cy="7" r="3.5" fill={color} />
        <path
          d="M12 11 L12 21 M6.5 15 H17.5 M8 24 L12 20 L16 24"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </>
    );
  }

  if (shape === "umbrella") {
    return (
      <>
        <path d="M4 13 Q12 3 20 13 Z" fill={color} />
        <path
          d="M12 13 V23 Q12 26 15 24"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </>
    );
  }

  if (shape === "tree") {
    return (
      <>
        <path d="M12 3 L21 17 H3 Z" fill={color} />
        <path d="M12 16 V25" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth + 1} />
      </>
    );
  }

  if (shape === "bike") {
    return (
      <>
        <circle cx="7" cy="18" r="4" fill="none" stroke={color} strokeWidth={strokeWidth} />
        <circle cx="18" cy="18" r="4" fill="none" stroke={color} strokeWidth={strokeWidth} />
        <path
          d="M7 18 L11 11 L14 18 L18 18 M11 11 H16"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </>
    );
  }

  if (shape === "balloon") {
    return (
      <>
        <ellipse cx="12" cy="9" rx="6" ry="7" fill={color} />
        <path d="M12 16 Q10 20 13 24" fill="none" stroke={color} strokeLinecap="round" strokeWidth="2" />
      </>
    );
  }

  if (shape === "house") {
    return (
      <>
        <path d="M4 12 L12 5 L20 12" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
        <path d="M7 12 H17 V23 H7 Z" fill={color} />
      </>
    );
  }

  if (shape === "flag") {
    return (
      <>
        <path d="M7 4 V24" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth + 1} />
        <path d="M8 5 H20 L17 11 L20 17 H8 Z" fill={color} />
      </>
    );
  }

  return (
    <path
      d="M12 2 L15 9 L23 9.5 L17 14.5 L19 22 L12 18 L5 22 L7 14.5 L1 9.5 L9 9 Z"
      fill={color}
    />
  );
}

export function ScenePreview({
  image,
  variant,
  characters = [],
  compact = false,
  revealTargets = false,
  label,
}: ScenePreviewProps) {
  const overlayOpacity = variant ? Math.max(0.24, 0.86 - variant.sourceFidelity * 0.055) : 0;
  const aspectClass = compact ? "aspect-[4/3]" : "aspect-[16/10]";

  return (
    <div className={`relative overflow-hidden border border-black/10 bg-[#f8f7f2] shadow-sm ${aspectClass}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={label ?? "Wimmelbuch source"}
          className="absolute inset-0 h-full w-full object-cover"
          src={image}
        />
      ) : (
        <div className="absolute inset-0 grid grid-cols-10 gap-px bg-white/60">
          {emptyGrid.map((item) => (
            <span key={item} className="bg-[#ece7dc]" />
          ))}
        </div>
      )}

      {variant ? (
        <>
          <div
            className="absolute inset-0 mix-blend-screen"
            style={{
              opacity: overlayOpacity,
              background:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,.42), transparent 22%), linear-gradient(135deg, rgba(255,255,255,.3), rgba(255,236,188,.12))",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.24 + (10 - variant.sourceFidelity) * 0.025,
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(40,40,40,.18) 0, rgba(40,40,40,.18) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(90deg, rgba(40,40,40,.12) 0, rgba(40,40,40,.12) 1px, transparent 1px, transparent 12px)",
              mixBlendMode: "multiply",
            }}
          />
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
            {variant.doodles.map((doodle) => (
              <g
                key={doodle.id}
                opacity={doodle.opacity}
                transform={`translate(${doodle.x} ${doodle.y}) rotate(${doodle.rotation}) scale(${doodle.size})`}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <svg x="-12" y="-12" width="24" height="24" viewBox="0 0 24 24">
                  <DoodleMark color={doodle.color} compact={compact} shape={doodle.shape} />
                </svg>
              </g>
            ))}
          </svg>
          {variant.targets.map((target) => {
            const character = characters.find((item) => item.id === target.characterId);
            const color = character?.color ?? "#ef476f";
            return (
              <div
                className="absolute flex h-6 w-6 items-center justify-center border border-black/25 text-[10px] font-black text-black shadow-sm"
                key={target.characterId}
                style={{
                  backgroundColor: color,
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  opacity: revealTargets ? 0.95 : 0.46,
                  transform: `translate(-50%, -50%) rotate(${target.rotation}deg) scale(${target.scale})`,
                }}
                title={character?.name}
              >
                {characterInitials(character?.name ?? "")}
              </div>
            );
          })}
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-9 text-xs font-semibold text-white">
        <span>{label ?? "Page preview"}</span>
        {variant ? <span>{variant.treatment}</span> : <span>Waiting</span>}
      </div>
    </div>
  );
}

export function BookPageThumb({ page }: { page: BookPage }) {
  return (
    <ScenePreview
      compact
      image={page.sourceImage}
      label={`Page ${page.pageNumber}`}
      revealTargets
      variant={page.variant}
      characters={page.characters}
    />
  );
}
