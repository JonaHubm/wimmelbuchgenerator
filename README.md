# Wimmelbuch Generator

A full-stack Next.js application for creating personalized hidden-object picture books from uploaded place photos and custom characters.

Live app:

```text
https://jonahubm.github.io/wimmelbuchgenerator/
```

## Current MVP

- Configure a book title, creator, page count, format, visual style, source fidelity, and scene complexity.
- Upload a source image for each page.
- Define up to five hidden characters with clues, colors, and optional reference images.
- Generate three selectable Wimmelbuch-style variants per page directly in the browser.
- Add selected pages into a sequential book queue.
- Export the current book as a PDF in the browser.

The first iteration uses a deterministic local generation engine so the app is testable without API keys and can be hosted on GitHub Pages.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zod for API validation
- pdf-lib for server-side PDF export
- Lucide React for interface icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev     # local development
npm run lint    # ESLint
npm run build   # production build
npm run start   # production server
```

## Project Structure

```text
src/app/page.tsx                  Main app entry
src/components/wimmelbuch-generator.tsx
src/components/scene-preview.tsx
src/lib/wimmelbuch.ts
src/lib/pdf-export.ts
```

## Deployment

The app is configured for GitHub Pages:

1. Push to `main`.
2. In GitHub, open **Settings -> Pages**.
3. Set **Build and deployment** to **GitHub Actions**.
4. The workflow publishes the static export to:

```text
https://jonahubm.github.io/wimmelbuchgenerator/
```

For a future production version with real image-generation APIs, use Vercel or another backend-capable host.

## Next Milestones

- Add autosave, restore, project import, and project export.
- Improve PDF layout for print readiness.
- QA the public GitHub Pages URL on desktop and mobile.
- Replace the local generator with a real image-model adapter.
- Add authentication and shareable project links.
- Store large uploaded images in object storage instead of JSON payloads.
- Add print-on-demand export integration.

## Next Session

See [NEXT_SESSION.md](./NEXT_SESSION.md) for the handoff, next-sprint scope, acceptance criteria, and QA checklist.
