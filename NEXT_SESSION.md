# Wimmelbuch Generator: Next Session Handoff

## Current State

- Repository: https://github.com/JonaHubm/wimmelbuchgenerator
- GitHub Pages URL: https://jonahubm.github.io/wimmelbuchgenerator/
- Local workspace: `/Users/taahujo7/Documents/Codex/Wimmelbuch`
- Branch: `main`
- Latest application/deployment commit before this handoff: `95b7037 Deploy static app to GitHub Pages`
- Handoff documentation is tracked in `NEXT_SESSION.md` on `main`.

The current MVP is a static Next.js app that runs fully in the browser so it can be hosted on GitHub Pages. It supports project configuration, image upload, character definition, three local generated variants per page, adding pages to a book, and browser-side PDF export.

## Important Constraint

GitHub Pages cannot run backend API routes or keep secrets safe. The current generation is a deterministic local visual mock. Real AI image transformation will require a backend-capable host such as Vercel, plus API-key storage and probably object storage for uploads.

## Verified In This Thread

- `npm run lint` passed after the GitHub Pages conversion.
- `npx tsc --noEmit` passed after clearing stale local `.next` route types.
- GitHub push succeeded after adding the token permission for workflow files.
- GitHub Pages workflow file exists at `.github/workflows/pages.yml`.

Local static build could not be rerun inside the Codex sandbox because Turbopack needs a worker process that the sandbox blocks. GitHub Actions should run the same build outside that sandbox.

## Next Sprint Recommendation

Build persistence and project portability before adding more visual complexity.

### Goal

Users should be able to start a Wimmelbuch, refresh the page or close the browser, and continue later. They should also be able to export a project draft as JSON and import it again.

### Scope

1. Add autosave to browser storage.
2. Add restore-on-load.
3. Add explicit project export/import.
4. Add a reset/clear project action.
5. QA the public GitHub Pages URL on desktop and mobile.

### Acceptance Criteria

- Editing project title, settings, characters, current page source, variants, selected variant, and book pages updates saved browser state.
- Refreshing the page restores the last project state.
- A user can export a `.json` project file.
- A user can import that `.json` file and recover the same book state.
- Reset clears saved state after a confirmation.
- Bad import files show a friendly error and do not corrupt the current project.
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

## QA Checklist For Next Session

Run:

```bash
npm run lint
npx tsc --noEmit
GITHUB_PAGES=true npm run build
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

## Product Roadmap After Persistence

1. Improve PDF layout for print readiness.
2. Add better guided page flow and empty/loading/error states.
3. Add a backend deployment for real AI image generation.
4. Add account/project sharing.
5. Add print-on-demand integration.
