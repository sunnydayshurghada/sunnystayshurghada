Replace the "W & F" monogram placeholder in `HostsSection` with the uploaded host photo and update the copy.

1. **Upload the photo as a CDN asset**
   - `lovable-assets create --file /mnt/user-uploads/WhatsApp_Image_2026-07-14_at_23.30.27_1-2.jpeg --filename hosts-wafaa-alex.jpg > src/assets/hosts-wafaa-alex.jpg.asset.json`
   - No cropping, retouching or regeneration — the CSS circular mask handles the round frame.

2. **`HostsSection` in `src/routes/index.tsx`**
   - Import the new asset pointer.
   - Replace the monogram `<span>W & F</span>` frame with an `<img>` (`object-cover`, positioned to keep both faces visible via `object-[50%_20%]`), preserving the gold ring and adding a softer premium shadow (`shadow-[0_25px_60px_-25px_rgba(23,59,99,0.35)]`).
   - Size: `h-[150px] w-[150px] md:h-[200px] md:w-[200px]`.
   - Keep the existing grid layout: image left / text right on desktop (`md:grid-cols-[220px_1fr]`), stacked on mobile — matches the requested behaviour.
   - Remove the tiny "signature" caption under the monogram (was tied to the initials).

3. **Copy**
   - Update the English locale `hosts.title` → "Meet Your Hosts".
   - Update `hosts.body` → the provided Wafaa & Alex paragraph.
   - Mirror the same two strings into the other locales (`de`, `ar`, `ar-EG`, `nl`, `ru`) so nothing regresses to the old text; translations for the body will be provided in each locale's language, keeping meaning identical.

4. **Verify**
   - Reload the preview at desktop and mobile widths, confirm the photo is crisp inside the gold ring, the shadow is subtle, and no other section changed.

### Out of scope
- No changes to header/logo, hero, gallery, features, why-stay, booking, footer, styles.css, routes, or backend.
- No edits to the uploaded photo file itself.