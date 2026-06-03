# Wimmelbuch Generator: Next Session Handoff

## Current State

- Repository: `https://github.com/JonaHubm/wimmelbuchgenerator`
- Production app: `https://wimmelbuch.vercel.app/`
- Production target: Vercel private live-AI testing.
- GitHub Pages URL: `https://jonahubm.github.io/wimmelbuchgenerator/` static/demo fallback only.
- Local workspace: `/Users/taahujo7/Documents/Codex/Wimmelbuch`
- Branch: `main`
- Latest pushed commit checked in this session: `801dbe0 Export Wimmel pages as landscape spreads`

The current MVP is a Next.js 16 App Router app with a browser mock generator and guarded Vercel API routes for live OpenAI image generation. It supports project setup, source image upload, flexible search targets, target reference generation, two page variants, selected-variant revision, adding accepted pages to a book, and browser-side PDF export.

## Current MVP Features

- Private access screen protected by `src/proxy.ts`.
- Server-only access-code cookie signing.
- Server-side AI kill switch via `WIMMELBUCH_AI_ENABLED`.
- Per-browser live AI usage cap via signed HTTP-only cookie.
- GPT Image 2 generation for target references and Wimmelbuch page edits.
- Search targets support people, animals, objects, vehicles, and symbols.
- Optional scale hints and stronger hiding prompts.
- Two generated variants by default for speed.
- Revision flow for selected generated pages.
- Hardcover PDF export with:
  - first page cover wrap: `475 x 332 mm`;
  - cover image restricted to the front-cover panel only;
  - landscape intro spread: `426 x 303 mm`;
  - one generated image per full landscape Wimmel spread: `426 x 303 mm`;
  - no printed target-marker overlays;
  - back-cover target legend and sponsor placeholders.

## Important Constraints

GitHub Pages cannot run backend API routes, `src/proxy.ts`, or keep secrets safe. Real AI image transformation belongs on Vercel. GitHub Pages should be treated as a static/demo fallback only.

Production live AI is controlled by Vercel environment variables:

```text
OPENAI_API_KEY=<your key>
WIMMELBUCH_ACCESS_CODE=<shared tester passcode>
WIMMELBUCH_ACCESS_SECRET=<long random secret>
WIMMELBUCH_AI_ENABLED=false
WIMMELBUCH_AI_SESSION_LIMIT=20
```

Use `WIMMELBUCH_AI_ENABLED=false` to disconnect paid OpenAI calls without deleting the key. Change it to `true` and redeploy when selected testers should use live AI.

## Verified In This Session

Local checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Results:

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed when run outside the local sandbox. The sandboxed build fails because Turbopack cannot bind an internal worker port in this environment.
- Git status after the last push was clean: `main...origin/main`.
- Vercel `/access/` returned HTTP 200.
- Vercel root `/` redirected to `/access?next=%2F`.
- Unauthenticated `POST /api/generate-page` returned HTTP 401 JSON: `{"error":"Private test access is required."}`.

## Notes From Review

- No real secrets are tracked. Only `.env.example` is versioned.
- `.DS_Store` files exist locally but are ignored and not tracked.
- Requirements now live in `Requirements/Wimmelbuch_App.md`; the large slide deck has been removed from the repo.
- The current session cap is still a lightweight browser-session guard, not a hard global billing limit.
- The app currently stores work in memory only. Refreshing can still lose a project.
- Existing generated images that already contain red circles or labels need to be regenerated; those markings are baked into image pixels.

## Next Sprint Recommendation

Build persistence and project portability before adding more visual complexity.

### Scope

1. Add autosave to browser storage.
2. Add restore-on-load.
3. Add explicit project export/import.
4. Add a reset/clear project action.
5. Add a versioned saved-project schema.
6. Handle local storage quota failures clearly because uploaded images are stored as data URLs.

### Suggested Save Shape

```ts
type SavedProject = {
  version: 1;
  savedAt: string;
  project: ProjectConfig;
  characters: HiddenCharacter[];
  source: SourcePage | null;
  placements: Record<string, CharacterPlacement>;
  variants: GeneratedVariant[];
  selectedVariantId: string | null;
  bookPages: BookPage[];
  coverVariantId: string | null;
  phase: number;
  revealTargets: boolean;
  legal?: {
    termsVersion: string;
    acceptedAt?: string;
    rightsConfirmed: boolean;
  };
};
```

## QA Checklist For Next Session

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then test manually:

1. Open local dev server.
2. Enter access code if the local gate is enabled.
3. Change title and targets.
4. Upload a source image.
5. Generate two variants.
6. Revise one selected variant.
7. Add one page.
8. Export PDF and confirm page sizes:
   - cover: `475 x 332 mm`;
   - intro and Wimmel spreads: `426 x 303 mm`.
9. Confirm no red target marker overlays are printed in the exported PDF.
10. Confirm `WIMMELBUCH_AI_ENABLED=false` blocks paid API calls before OpenAI is contacted.
11. Confirm unauthenticated API calls return JSON 401, not HTML.

## Backlog

- Database/blob storage for large projects and uploaded images.
- Database-backed rate limiting and user accounts.
- Sponsor logo upload and back-cover placement.
- Manual cover crop controls.
- Manual per-target scale/resize handles.
- Print-on-demand export presets with bleed, spine width, ISBN, QR code, and production PDF rules.
- Automated visual audit to confirm all hidden targets are present.
