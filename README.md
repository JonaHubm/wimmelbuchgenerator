# Wimmelbuch Generator

A full-stack Next.js application for creating personalized hidden-object picture books from uploaded place photos and custom characters.

## Current MVP

- Configure a book title, creator, page count, format, visual style, source fidelity, and scene complexity.
- Upload a source image for each page.
- Define up to five hidden characters with clues, colors, and optional reference images.
- Generate three selectable Wimmelbuch-style variants per page through a backend API.
- Add selected pages into a sequential book queue.
- Export the current book as a PDF from a server-side route.

The first iteration uses a deterministic local generation engine so the app is testable without API keys. The API boundary is already shaped for a future image-model provider.

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
src/app/api/generate-page/route.ts
src/app/api/export-pdf/route.ts
src/lib/wimmelbuch.ts
```

## Deployment

The app is ready for GitHub plus Vercel:

1. Create a GitHub repository.
2. Push this project to the repository.
3. Import the repository in Vercel.
4. Vercel will detect Next.js and run `npm run build`.

GitHub Pages is not a good target for this project because the app uses backend API routes for generation and PDF export.

## Next Milestones

- Add persistence for saved projects, uploaded assets, and generated pages.
- Replace the local generator with a real image-model adapter.
- Add authentication and shareable project links.
- Store large uploaded images in object storage instead of JSON payloads.
- Add print-on-demand export integration.
