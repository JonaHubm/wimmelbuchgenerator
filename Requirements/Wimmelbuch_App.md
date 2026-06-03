# Wimmelbuch App Requirements

This file keeps the product requirements in a lightweight, reviewable Markdown format.

## Product Goal

Build a consumer-friendly Wimmelbuch Generator that lets users create personalized hidden-object picture books from their own place photos, custom search targets, and AI-generated illustrated scenes.

The MVP should support private testing on Vercel and prepare the product for a later print-on-demand and commerce workflow.

## Current MVP Scope

- Configure a book title, creator, page count, visual style, image complexity, search difficulty, and source fidelity.
- Upload a source image for each Wimmelbuch page.
- Define up to five recurring search targets.
- Search targets can be people, animals, objects, vehicles, or symbols.
- Generate or upload target reference images.
- Generate two live AI page variants by default.
- Revise a selected generated variant up to two times.
- Add accepted generated pages to a book queue.
- Export a hardcover-oriented PDF.
- Protect the Vercel test app with a shared access code.
- Control paid OpenAI usage with a server-side kill switch and session cap.
- Keep mock mode usable without API keys.

## Search Target Requirements

- Search targets must not be limited to human characters.
- Supported target kinds:
  - `person`
  - `animal`
  - `object`
  - `vehicle`
  - `symbol`
- Each target should have:
  - name;
  - clue;
  - kind;
  - accent color;
  - optional reference image;
  - optional scale hint.
- Object and vehicle targets must not be transformed into humans.
- Targets should be integrated naturally into the generated scene.
- Targets should be findable but not immediately obvious.
- Generated images must not contain labels, arrows, red circles, colored rings, outlines, or other callout markers around hidden targets.

## Scale Requirements

- Each target should appear at plausible real-world scale relative to the scene.
- User-provided scale hints override automatic scale estimation.
- Examples:
  - football: small object scale;
  - yellow bag: handheld bag scale;
  - vehicle: vehicle-sized;
  - large landmark or structure: visibly large unless explicitly described as a toy/model.
- Manual placement controls define the hiding zone only. They do not resize the target in the current MVP.

## Generation Requirements

- Use OpenAI `gpt-image-2` for live image generation.
- Page generation should use image edits with the source photo and available target references.
- Target reference generation should create a single clean standalone target reference.
- Default live page generation should produce two variants for speed.
- If one live variant fails and another succeeds, show the successful variant with a warning.
- Session usage should count successful live variants.
- Revision should use the selected generated page as the main base image and apply the revision prompt.
- Maximum MVP revision depth: two revisions per page.

## Private Testing And Cost Control

- Vercel is the production host for protected live AI testing.
- GitHub Pages is static/demo-only.
- Required Vercel environment variables:
  - `OPENAI_API_KEY`
  - `WIMMELBUCH_ACCESS_CODE`
  - `WIMMELBUCH_ACCESS_SECRET`
  - `WIMMELBUCH_AI_ENABLED`
  - `WIMMELBUCH_AI_SESSION_LIMIT`
- `OPENAI_API_KEY` must remain server-only.
- `WIMMELBUCH_AI_ENABLED=false` must block paid OpenAI calls before any OpenAI request is made.
- Unauthenticated API calls must return JSON errors, not HTML pages.

## PDF Export Requirements

- Export one combined PDF for the MVP.
- First page should be the hardcover cover wrap:
  - full page: `475 x 332 mm`;
  - back cover + spine + front cover;
  - no crop marks.
- The cover should include:
  - selected cover image only inside the front-cover panel;
  - readable title overlay;
  - creator;
  - spine title;
  - back-cover description;
  - search-target legend;
  - sponsor/supporter placeholders.
- Interior pages should be landscape spreads:
  - page size: `426 x 303 mm`;
  - intended trim: A4 + A4 spread with 3 mm bleed;
  - one generated Wimmelbuch image spans one full landscape spread.
- The back cover, spine, and outer cover wrap bleed must not show any crop from the selected cover image.
- PDF export must not draw red circles, target outlines, or marker boxes around hidden targets.
- Existing generated images with baked-in circles must be regenerated.

## Legal And Rights Requirements

- Users must confirm that they have the rights to use uploaded source and reference images.
- Future versions should store:
  - terms version;
  - acceptance timestamp;
  - per-image rights confirmation;
  - source/provenance metadata.
- For commercial/public launch, add stronger legal review, moderation, and audit trails.

## Research-Informed Future Requirements

- Support two product modes:
  - standardized regional editions;
  - individualized private/group editions.
- Add project persistence and import/export before expanding the workflow.
- Add page planning metadata:
  - target location;
  - source description;
  - season;
  - event or motif;
  - difficulty;
  - rights confirmation;
  - review status.
- Later physical-product scope:
  - 7 to 10 double-page Wimmel spreads;
  - print-on-demand partner presets;
  - sponsor logos;
  - ISBN/publisher metadata;
  - QR code;
  - credits;
  - order/payment flow.

## Near-Term Backlog

1. Autosave and restore project state.
2. Project JSON export/import.
3. Reset project action.
4. Versioned saved-project schema.
5. Storage quota handling for large uploaded images.
6. Sponsor logo upload.
7. Manual cover crop controls.
8. Database/blob storage.
9. Database-backed rate limiting and user accounts.
10. Automated visual audit for target presence.
