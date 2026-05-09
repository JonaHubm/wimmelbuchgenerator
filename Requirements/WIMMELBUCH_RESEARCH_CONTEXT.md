# Wimmelbuch Research Context

Source: `Requirements/Wimmelbuch_App.pptx`  
Created for reusable agent context. This is a product/planning synthesis, not legal advice.

## Product Thesis

The project is more than a playful image generator. The researched target is a Wimmelbuch creation and commerce platform that can support:

- standardized regional/location books for municipalities, tourism, booksellers, libraries, and similar B2B buyers;
- individualized books for private people, schools, clubs, associations, and other groups;
- a future shop and print-on-demand flow for physical books;
- a legally safer upload/generation process with explicit rights confirmation and liability language.

The current MVP already covers the core creative loop: configure a project, upload a source image, define hidden characters, generate selectable variants, queue pages, and export a PDF. The next product layer should preserve that loop while adding persistence, portability, legal acknowledgement, richer project metadata, and eventually ordering/production readiness.

## Research Themes By Slide

- Slides 2-5: legal and technical risk mitigation for uploaded photos, AI-generated images, customer liability, terms, disclaimers, rights confirmation, and optional content checks.
- Slide 6: company structure questions, with Swiss and German entities/holding as possible future setup.
- Slide 7: branding work remains open: name, domain, logo, website, browser icon, app identity, app icon.
- Slide 8: pricing is explicitly unresolved.
- Slides 9-11: product shape, target groups, and distribution channels.
- Slides 12-17: competitor research, mostly non-AI Wimmelbuch offerings.
- Slides 18-20: market sequencing, starting with Switzerland and Germany.
- Slide 21: print-on-demand partner research is still open.
- Slide 22: ISBN/publisher options and tradeoffs.
- Slides 23-27: process models for standardized and individualized editions, including customer, outsourcing partner, Wimmelbuch AG, quality checks, registration/payment, and liability steps.
- Slides 28-30: physical book specs and generator requirements.
- Slide 31: early mockup direction: choose standardized vs individualized, then define target location.

## Legal And Compliance Context

The app should eventually require customers to actively confirm that they own or can license uploaded images. The research calls for:

- clear terms of use and liability disclaimer;
- checkbox before generation/upload use;
- documented consent for later proof;
- customer responsibility and indemnity language;
- right to remove unlawful or infringing content;
- stronger contractual clauses for B2B licensing.

Technical safeguards mentioned:

- reverse image search or other upload screening for already-published/copyrighted images;
- brand/logo/character detection to reduce trademark and protected-character risk;
- metadata analysis for copyright or photographer information;
- manual review for commercial projects;
- checks for watermarks when external source images are used.

MVP implication: add an explicit rights-confirmation checkpoint before project export/order-related flows. For now this can be local state plus visible confirmation copy. A production version should store acceptance timestamp/version server-side.

## Market And Audience Context

Initial market focus:

- German-speaking: Switzerland as POC 1, Germany as POC 2, then Austria.
- English-speaking: UK, Ireland, USA.
- Later multilingual markets: Belgium, Denmark, Finland, France, Italy, Norway, Netherlands, Poland, Sweden.

Target groups:

- standardized B2B/B2C: municipalities, tourism organizations, book trade, libraries;
- individualized B2C/B2B: private people, schools, clubs, associations, interest groups.

Distribution channels:

- B2B campaigns by email;
- Amazon;
- social media;
- Trustpilot/reviews;
- eventually shop and direct sales.

## Competitor Context

The deck identifies competitors as mostly non-AI products:

- Librio: personalized children/Wimmel books, child avatar configuration, language/name/skin/hair/clothing options, CHF pricing, gift/secret-message mechanics, checkout upsells.
- Schanz & Partner: regional Wimmelbuch services for municipalities, tourism offices, bookshops, sponsors and partners, printed and digital presence, regional-storytelling positioning, process and calculator pages.
- Wimmelbuchverlag: personal/regional Wimmelbuch offering.
- Framily: seasonal Wimmelbuch concept.
- Stikets: personalized hidden-object book.
- Wonderbly: children-focused Wimmel books.
- Mein Eigenes Buch: Wimmelbuch offering.

Research claim: no identified competitor combines AI generation with a strong UX for this use case. Treat this as a hypothesis to validate, because the deck notes this came from initial Google search.

## Business Process Models

The deck sketches four operating variants:

- Standardized edition owned by Wimmelbuch AG: select target location from market analysis, research and select local sites, source/take photos, generate book, quality-check, B2B acquisition, order/payment, print-on-demand/shipping, B2C sale.
- Standardized B2B: customer selects target location, confirms video/terms/disclaimer, researches/selects sites and photos, generates book, passes a customer-side quality check, optional Wimmelbuch AG quality check, orders/pays, handles or triggers print-on-demand/shipping and B2C sale.
- Individualized B2B: similar to standardized B2B, focused on a customer/group-specific edition rather than broad regional resale.
- Individualized B2C: customer confirms video/terms/disclaimer, defines target location, selects sites/photos, passes quality check, orders/pays, print-on-demand/shipping.

Important repeated steps:

- registration may be needed before order/payment;
- rights confirmation should default to yes per image only after explicit user acknowledgement;
- quality check is a first-class process step, not a hidden implementation detail;
- terms and liability disclaimer should appear before meaningful use or ordering.

## Physical Book Requirements

Target physical product:

- format around 25 cm x 34 cm;
- page thickness around 0.8 mm to 1.0 mm;
- inside pages use double-page spreads;
- minimum 7 images / 14 pages;
- maximum 10 images / 20 pages.

Front cover:

- title image as background, either own image or crop from inside page;
- title;
- Wimmelbuch AG;
- publisher.

Back cover:

- calm background;
- Wimmelbuch title and explanation;
- hidden objects/search elements;
- difficulty level;
- optional thanks;
- ISBN barcode;
- optional sponsor logos for standardized editions;
- book information;
- illustration and photo-template credits;
- copyright/all rights reserved;
- print-on-demand information if required by partner;
- publisher information if working with a publisher;
- QR code to the book for standardized editions;
- FSC icon if certified.

## Generator Requirements From Research

Core setup:

- choose standardized or individualized edition;
- define target location and title;
- choose page/location count;
- upload one photo per location/page, usually buildings or recognizable places;
- describe each image, for example schoolhouse, children, break, playing.

Creative controls:

- style, such as comic or caricature;
- optional guide motifs;
- seasons: all four seasons across the whole book, a fixed or variable season order, variable starting season, per-page seasons, or single-season winter mode;
- events, for example Basler Fasnacht or Sechselaeuten, applied book-wide or per page;
- motifs/themes, for example zoo, only in partnership contexts unless otherwise allowed;
- difficulty level, including color/camouflage rules such as red-on-red;
- difficulty can be constant, increasing across pages, per-page, or custom;
- post-generation reprompting.

Hidden/search objects:

- minimum 6 and maximum 10;
- objects must plausibly appear in every story-like image;
- objects need to fit scale relationships, so overly large items like trucks are usually unsuitable;
- examples include people, animals, fantasy beings, and small objects.

## Implications For Current Next Session

The existing next sprint should remain focused on persistence and project portability. The research strengthens that priority because later legal, quality, production, and order flows all need a durable project record.

Recommended additions to the saved project model:

- `projectMode`: `standardized` or `individualized`;
- `targetLocation`;
- per-page metadata: source description, location/site name, season, event/motif, difficulty, rights confirmation;
- book metadata: title, creator, target market/language, edition type;
- hidden-object metadata with count validation and scale/plausibility guidance;
- `legalAcceptance`: accepted terms version, timestamp, and rights-confirmation state, local-only for MVP;
- future-ready cover/back-cover metadata, even if PDF export does not use all fields yet.

Keep the immediate acceptance criteria from `NEXT_SESSION.md`, then add:

- project export/import preserves mode, target location, page metadata, hidden objects, and legal acknowledgement state;
- reset clears saved legal and project state;
- bad imports cannot silently bypass required rights confirmation;
- PDF export still works after restoring/importing enriched metadata.

## Suggested Backlog After Persistence

1. Legal checkpoint UX
   - Add terms/disclaimer acknowledgement and per-image rights confirmation.
   - Version the text so future server storage can prove what was accepted.

2. Mode-driven project setup
   - First screen asks standardized vs individualized.
   - Standardized mode emphasizes target location, public resale, sponsors/QR/ISBN readiness.
   - Individualized mode emphasizes personal/group context and direct order.

3. Page planning workflow
   - Let users define target locations/sites before upload.
   - Store page description, season, event/motif, and difficulty per page.

4. Print-ready export metadata
   - Expand PDF/book model toward cover, back cover, credits, search objects, and difficulty information.
   - Keep physical production constraints visible: 7-10 double-page spreads.

5. Quality check stage
   - Add a review screen before export/order.
   - Surface missing rights confirmations, missing descriptions, object count issues, and low-confidence pages.

6. Real AI/backend architecture
   - Defer until persistence is stable.
   - Needs backend-capable hosting, secret storage, upload/object storage, abuse/legal controls, and probably a moderation/check pipeline.

7. Commerce and production
   - Research pricing, print-on-demand partners, ISBN/publisher path, shop/order/payment, and delivery responsibilities.

## Open Questions

- What final brand name should be used: Wimmelbuch AG, Wimmelbuchel AG, or another brand?
- Which jurisdiction governs initial terms: Switzerland, Germany, or both?
- Which POD partners can produce 25 cm x 34 cm board/thick-page books at the required quality?
- Does the MVP need a visible terms checkbox now, or only once real uploads leave the browser?
- Which competitor claims are validated beyond the initial Google search?
- What pricing model applies: per digital export, per physical book, B2B license, setup fee, revenue share, or sponsored regional editions?
- Should standardized editions include sponsor-logo management from the start, or only in a later commerce sprint?
- How strict should object validation be for the 6-10 hidden object rule?

## Reuse Notes For Future Agents

When planning or implementing the app, preserve these product constraints:

- The platform has two product modes: standardized regional editions and individualized editions.
- Uploaded images are legally sensitive. Rights confirmation and provenance should be part of the data model, not just copy.
- The strongest differentiation hypothesis is AI plus good UX; competitor UX patterns are still useful for personalization, checkout, and regional storytelling.
- A physical book is the likely commercial endpoint, so PDF/export data should move toward print-ready structure.
- Persistence is the correct immediate foundation because nearly every researched feature depends on a durable project schema.
