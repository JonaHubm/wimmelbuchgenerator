# Wimmelbuch Generator: Next Session Handoff

## Current State

- Repository: https://github.com/JonaHubm/wimmelbuchgenerator
- Vercel is the production target for private live-AI testing.
- GitHub Pages URL: https://jonahubm.github.io/wimmelbuchgenerator/ static/demo fallback only.
- Local workspace: `/Users/taahujo7/Documents/Codex/Wimmelbuch`
- Branch: `main`
- Latest application/deployment commit before this handoff: `95b7037 Deploy static app to GitHub Pages`
- Handoff documentation is tracked in `NEXT_SESSION.md` on `main`.

The current MVP is a Next.js app with a browser mock generator plus guarded Vercel API routes for live OpenAI image generation. It supports project configuration, image upload, character definition, local mock variants, optional live AI page/character generation, adding pages to a book, and browser-side PDF export.

## Important Constraint

GitHub Pages cannot run backend API routes, `src/proxy.ts`, or keep secrets safe. Real AI image transformation now belongs on Vercel. GitHub Pages should be treated as a manual static/demo fallback only.

Production live AI is controlled by Vercel environment variables:

```text
OPENAI_API_KEY=<your key>
WIMMELBUCH_ACCESS_CODE=<shared tester passcode>
WIMMELBUCH_ACCESS_SECRET=<long random secret>
WIMMELBUCH_AI_ENABLED=false
WIMMELBUCH_AI_SESSION_LIMIT=3
```

Set `WIMMELBUCH_AI_ENABLED=false` to disconnect paid OpenAI usage without deleting the key. Change it to `true` and redeploy when selected testers should use live AI.

## Research Context Added

The new source deck `Requirements/Wimmelbuch_App.pptx` has been distilled into `Requirements/WIMMELBUCH_RESEARCH_CONTEXT.md`. Use that Markdown file as the reusable product context before making roadmap, data-model, legal-consent, print-export, or workflow decisions.

Key implications from the research:

- Persistence should prepare the later product model, not just save UI state.
- The app has two likely product modes: standardized regional editions and individualized editions.
- Uploaded photos are legally sensitive, so rights confirmation and provenance should become part of the project data model.
- A future physical book flow needs page/location metadata, hidden/search objects, quality-check state, cover/back-cover metadata, and print-on-demand readiness.
- Real AI generation should wait until persistence, upload/storage, rights, and moderation foundations are less fragile.

## Verified In This Thread

- `npm run lint` passed after the GitHub Pages conversion.
- `npx tsc --noEmit` passed after clearing stale local `.next` route types.
- `npm run lint` and `npx tsc --noEmit` passed after adding private access, AI kill switch, and session cap.
- `npm run build` is blocked inside the local Codex sandbox by Turbopack process/port restrictions; rerun on Vercel/GitHub or outside the sandbox.
- GitHub push succeeded after adding the token permission for workflow files.
- GitHub Pages workflow file exists at `.github/workflows/pages.yml`, but it is manual-only now and should not be used for protected live-AI testing.

Local production build could not be rerun inside the Codex sandbox because Turbopack needs a worker process that the sandbox blocks. Vercel should run the same build outside that sandbox.

## Next Sprint Recommendation

Build persistence and project portability before adding more visual complexity.

### Goal

Users should be able to start a Wimmelbuch, refresh the page or close the browser, and continue later. They should also be able to export a project draft as JSON and import it again.

### Scope

1. Add autosave to browser storage.
2. Add restore-on-load.
3. Add explicit project export/import.
4. Add a reset/clear project action.
5. Add a future-ready saved-project shape for product mode, source provenance, rights confirmation, page metadata, and quality-check state.
6. QA the public GitHub Pages URL on desktop and mobile.

### Acceptance Criteria

- Editing project title, settings, characters, current page source, variants, selected variant, and book pages updates saved browser state.
- Refreshing the page restores the last project state.
- A user can export a `.json` project file.
- A user can import that `.json` file and recover the same book state.
- Reset clears saved state after a confirmation.
- Bad import files show a friendly error and do not corrupt the current project.
- Saved JSON has a version and can be migrated later.
- Saved JSON can carry product mode, target location, per-page description/provenance, rights-confirmation state, and review status even if the full UI is implemented in a later sprint.
- Bad imports cannot silently bypass required rights confirmation fields.
- Storage quota failures show a friendly recovery hint instead of failing silently.
- PDF export still works after import.
- The public URL works at `https://jonahubm.github.io/wimmelbuchgenerator/`.

## Likely Files To Touch

- `src/components/wimmelbuch-generator.tsx`
- `src/lib/wimmelbuch.ts`
- Optional new file: `src/lib/project-storage.ts`
- Optional new file: `src/lib/project-schema.ts`
- `README.md`

## Suggested Implementation Shape

Use a versioned project save format:

```ts
type SavedProject = {
  version: 1;
  savedAt: string;
  project: ProjectConfig;
  characters: HiddenCharacter[];
  source: SourcePage | null;
  variants: GeneratedVariant[];
  selectedVariantId: string | null;
  bookPages: BookPage[];
  phase: number;
  revealTargets: boolean;
  product?: {
    mode: "standardized" | "individualized";
    targetLocation?: string;
    market?: "CHE" | "DEU" | "AUT" | "other";
  };
  legal?: {
    termsVersion: string;
    acceptedAt?: string;
    rightsConfirmed: boolean;
  };
};
```

Add helpers:

- `serializeProjectState`
- `parseProjectState`
- `saveProjectState`
- `loadProjectState`
- `clearProjectState`
- `downloadProjectJson`

Use `localStorage` for now. Keep the storage key stable, for example:

```text
wimmelbuch-generator:v1
```

Guard against `localStorage` quota errors because uploaded images are stored as data URLs. If quota is exceeded, keep the current in-memory state, show a clear error, and suggest exporting the project JSON or reducing image size/page count. IndexedDB or object storage can come later.

### Research-Informed Data Model Prep

Do not overbuild the full commercial workflow in this sprint, but leave room for:

- `projectMode`: standardized vs individualized.
- `targetLocation` and optional organization/customer context.
- page-level `locationName`, `sourceDescription`, `season`, `eventOrMotif`, `difficulty`, `rightsConfirmed`, `rightsConfirmedAt`, and `reviewStatus`.
- hidden/search objects eventually expanding from 1-5 characters toward the researched 6-10 Wimmelobjekte range.
- print metadata for later cover, back cover, credits, ISBN, QR code, sponsor logos, and print-on-demand information.

## QA Checklist For Next Session

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then test manually:

1. Open local dev server.
2. Change title and characters.
3. Upload a source image.
4. Generate variants.
5. Add a page.
6. Refresh and confirm state is restored.
7. Export project JSON.
8. Reset project.
9. Import project JSON.
10. Export PDF.
11. Confirm unauthenticated visitors redirect to `/access`.
12. Confirm `WIMMELBUCH_AI_ENABLED=false` blocks paid API calls before OpenAI is contacted.
13. Try importing invalid JSON and confirm the current project remains intact.
14. Try a large image/page project and confirm quota errors are handled gracefully if they occur.

## Product Roadmap After Persistence

1. Add legal checkpoint UX: terms/disclaimer acknowledgement, active rights confirmation, and terms versioning.
2. Add mode-driven setup for standardized vs individualized books, including target location.
3. Add page planning: location/site name, image description, season, event/motif, difficulty, and review status.
4. Improve PDF layout toward print readiness: cover, double-page spreads, back-cover legend, credits, hidden/search objects, difficulty level.
5. Add better guided page flow and empty/loading/error states.
6. Add backend deployment for real AI generation, upload/object storage, secret handling, and moderation/safety checks.
7. Add account/project sharing.
8. Research and integrate print-on-demand, ISBN/publisher path, pricing, checkout, and shipping.
