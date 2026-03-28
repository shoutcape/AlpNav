# Adding a New Resort Area

When adding a new map area (resort) to AlpNav, there are several visual and data-parsing edge cases to account for. This checklist is based on learnings from integrating the "Mayrhofner Bergbahnen" map alongside the original "Zillertal Arena" reference area.

## 1. Verify SVG Geometry Types
Different intermaps SVGs might use different SVG elements to represent the same type of data. 
- **Example:** Zillertal Arena predominantly used `<polyline>` and `<path>` for lifts. Mayrhofen also used `<line>` elements for perfectly straight lifts (e.g., "6SB Ebenwald").
- **Action:** If pistes or lifts are mysteriously missing from the parsed output but visible in the raw SVG, check if the SVG uses a geometry tag (like `<line>`, `<polygon>`, or `<rect>`) that the parser in `src/lib/resorts/intermaps/parser.ts` is not yet extracting.

## 2. Configure Visual Scaling (`visualScale`)
Each resort's panorama has a different baseline resolution and coordinate space. An item drawn with a radius of `10` might look perfect in Zillertal Arena but look microscopic in Mayrhofen.
- **Concept:** We decouple **coordinate scaling** (mapping SVG coordinates to 3D world space) from **visual scaling** (how thick lines are and how big badges are).
- **Action:** Set a `visualScale` multiplier in the resort's `ResortDefinition` in `src/lib/resorts/catalog.ts`. (e.g., Zillertal Arena is `1.0`, Mayrhofen is `2.0`).

## 3. Apply Visual Scale to Rendering
When adding new map overlays or updating existing ones, ensure that sizes scale dynamically.
- **Action:** Pass `activeArea.visualScale` from `MapShell.tsx` into the specific overlay rendering function.
- **Checklist for drawing:**
  - [ ] Stroke widths (`width`)
  - [ ] Circle/Badge radii (`radius`)
  - [ ] Line dash and gap lengths (`DASH_LEN`, `GAP_LEN`)
  - [ ] Font sizes (`fontSize`)
  - [ ] Corner radii on rounded rectangles
  - [ ] Custom drawn icons (e.g., drawing paths for gondolas or chairlifts)

## 4. Scale Hit Testing Areas
If you scale up the visual appearance of an icon by 2x, you must also scale its clickable hit area, otherwise users will click the outer edges of a badge and nothing will happen.
- **Action:** Ensure `visualScale` is passed to `hitTestOverlays` in `src/features/map/hitTest.ts`.
- **Checklist for hit testing:**
  - [ ] Scale minimum hit thresholds (`HIT_THRESHOLD`)
  - [ ] Scale radius checks for point POIs (`ICON_HIT_RADIUS`, `GASTRO_HIT_RADIUS`, etc.)

## 5. Catalog Registration
Don't forget the standard boilerplate:
- [ ] Add the resort manifest.
- [ ] Create the data loader function.
- [ ] Add the definition to `RESORTS` in `src/lib/resorts/catalog.ts`.
