Use the uploaded PNG logo verbatim (transparent background, unmodified) as the site's primary brand mark.

1. **Upload the logo as a Lovable asset**
   - `lovable-assets create --file /mnt/user-uploads/ChatGPT_Image_16._Juli_2026_21_26_33.png --filename sunny-stays-hurghada-logo.png > src/assets/sunny-stays-hurghada-logo.png.asset.json`
   - The original PNG already has a transparent background and will not be modified.

2. **Header (`SiteHeader` in `src/routes/index.tsx`)**
   - Replace the current two-line text lockup ("Boutique · Hurghada" + "Sunny Stays Hurghada") with an `<img>` of the logo.
   - `alt="Sunny Stays Hurghada"`, `className="h-9 md:h-14 w-auto"` (≈36px mobile / ≈56px desktop), preserving natural proportions with `w-auto`.
   - Bump header height from `h-20` to `h-24` and increase left padding slightly so the logo has breathing room.
   - Keep the anchor to `#top`, keep the nav links and Airbnb CTA untouched.

3. **Footer (`SiteFooter`)**
   - Replace the "Boutique · Hurghada" eyebrow + italic brand line with the same logo (`h-12 md:h-14 w-auto`).
   - Since the logo art is deep navy on transparency and the footer is navy, wrap it in a small rounded light-sand plaque (`bg-paper rounded-xl px-5 py-3 inline-flex`) so the logo remains legible without altering its colors.
   - Keep address, tagline, contact, and social columns unchanged.

4. **Root head (`src/routes/__root.tsx`)**
   - Point `<link rel="icon">` / `apple-touch-icon` to the new logo URL so browser tabs use the brand mark.

5. **Text sweep — "Madaris Stays" → "Sunny Stays Hurghada"**
   - Grep the repo (`rg "Madaris Stays"`) and replace any remaining occurrences across `src/i18n/locales/*.json`, route heads, and components. (Most were already migrated; this is a safety pass.)
   - Leave "Madaris Apartment" as-is where it names the property.

6. **Verify**
   - Reload the preview, confirm the logo renders crisply at both breakpoints in header and footer, transparent background intact, no color shift, and no leftover "Madaris Stays" strings.

### Out of scope
- No changes to hero, gallery, features, hosts, booking, i18n keys other than brand-name string sweep, styles.css tokens, routes, or backend.
- No regeneration or editing of the logo artwork.