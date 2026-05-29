# Wimmelbuch Generator

A full-stack Next.js application for creating personalized hidden-object picture books from uploaded place photos and custom search targets.

Live app:

```text
Vercel production deployment
```

Static demo fallback:

```text
https://jonahubm.github.io/wimmelbuchgenerator/
```

## Current MVP

- Configure a book title, creator, page count, format, visual style, source fidelity, and scene complexity.
- Upload a source image for each page.
- Define up to five hidden search targets with type, clue, color, scale hint, and optional reference image.
- Generate three local mock variants in the browser, or guarded live AI variants through Vercel API routes.
- Revise a selected generated variant up to two times before adding it to the book.
- Add selected pages into a sequential book queue.
- Export the current book as a print-oriented PDF with cover image, clean interior pages, and backcover target legend.
- Protect test deployments with a shared access code, a server-side AI kill switch, and a browser-session usage cap.

The mock generator remains available without API keys. Real AI generation requires Vercel environment variables and must not be hosted through GitHub Pages.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zod for API validation
- pdf-lib for browser-side PDF export
- Lucide React for interface icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For local live AI testing, copy `.env.example` to `.env.local` and set:

```text
OPENAI_API_KEY=...
WIMMELBUCH_AI_ENABLED=true
WIMMELBUCH_AI_SESSION_LIMIT=20
```

Set `WIMMELBUCH_ACCESS_CODE` and `WIMMELBUCH_ACCESS_SECRET` locally only if you also want to test the private access gate.

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
src/app/access/page.tsx           Private test access screen
src/app/api/access/route.ts       Access-code cookie route
src/app/api/ai-status/route.ts    Live AI control status route
src/app/api/generate-page/route.ts
src/app/api/generate-character/route.ts
src/proxy.ts                      Next.js 16 request gate
src/components/wimmelbuch-generator.tsx
src/components/scene-preview.tsx
src/lib/access-control.ts
src/lib/wimmelbuch.ts
src/lib/pdf-export.ts
Requirements/WIMMELBUCH_RESEARCH_CONTEXT.md
```

## Product Research

The latest product and market research from `Requirements/Wimmelbuch_App.pptx` is summarized in [Requirements/WIMMELBUCH_RESEARCH_CONTEXT.md](./Requirements/WIMMELBUCH_RESEARCH_CONTEXT.md). Read it before changing the product model, legal consent flow, print/export workflow, or roadmap.

## Deployment

Real AI testing is Vercel-first because it needs API routes and server-side secrets.

In Vercel Project Settings -> Environment Variables, add these Production variables:

```text
OPENAI_API_KEY=<your key>
WIMMELBUCH_ACCESS_CODE=<shared tester passcode>
WIMMELBUCH_ACCESS_SECRET=<long random secret>
WIMMELBUCH_AI_ENABLED=false
WIMMELBUCH_AI_SESSION_LIMIT=20
```

Use `WIMMELBUCH_AI_ENABLED=false` to disconnect paid OpenAI calls without deleting the key. Change it to `true` and redeploy when you want selected testers to use live AI.

GitHub Pages is only suitable for the earlier static/demo build and is no longer auto-deployed on every push. The existing URL may continue to show an older mock-only build:

```text
https://jonahubm.github.io/wimmelbuchgenerator/
```

Do not use GitHub Pages for protected live AI testing.

## Next Milestones

- Add autosave, restore, project import, and project export.
- Add sponsor logo upload and print-on-demand export presets.
- QA the public GitHub Pages URL on desktop and mobile.
- Replace the local generator with a real image-model adapter.
- Add authentication and shareable project links.
- Store large uploaded images in object storage instead of JSON payloads.
- Add print-on-demand export integration.

## Next Session

See [NEXT_SESSION.md](./NEXT_SESSION.md) for the handoff, next-sprint scope, acceptance criteria, and QA checklist.
