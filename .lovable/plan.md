## Goal
Elevate the existing single-page site to a premium boutique-hotel feel — same structure, richer visual language, real apartment photos only, new brand name **Sunny Stays Hurghada**.

## Brand & tokens
- Rename **Madaris Stays → Sunny Stays Hurghada** everywhere (all 6 i18n locale JSONs + `<title>` in `__root.tsx`), tagline **Your Home by the Red Sea**.
- New palette in `src/styles.css` (`@theme` tokens, replacing the current forest/sand/gold):
  - `--color-navy: #173B63`
  - `--color-gold: #C8A15A`
  - `--color-sand: #F7F2EA` (light sand bg)
  - `--color-cloud: #F1F1EE` (light grey bg)
  - `--color-ink: #1a1a1a`, `--color-paper: #ffffff`
  - Subtle shadow token `--shadow-soft`
- Drop the bright forest green; navy becomes the dominant dark.
- Typography via `<link>` in `__root.tsx` head (no CSS URL imports): **Cormorant Garamond** (display) + **Inter** (body). Wire into `--font-display` / `--font-sans`.

## Sections (edit `src/routes/index.tsx`, keep order)
1. **Header** — same nav; rename brand; slightly airier padding.
2. **Hero** — grow to `min-h-[92vh]`, real apartment overview photo (widest of the 10 uploaded DSC images, picked by inspecting sizes: `dsc06684` / `dsc06687`), dark navy overlay `bg-navy/55`, huge Cormorant headline **"Sunny Stays Hurghada"**, sub **"Feel at Home by the Red Sea"**, two buttons: primary gold **Book on Airbnb** (→ `AIRBNB_LISTING_URL`), ghost white **View Apartment** (→ `#gallery`). Fade-in on mount.
3. **Gallery — masonry** using CSS `columns-1 md:columns-2 lg:columns-3` with all 10 real photos (`dsc06669, 70, 74, 78, 81, 84, 87, 88, 97, 708`), `rounded-2xl`, `shadow-soft`, `hover:scale-[1.02] transition` — no small thumbnails. Priority order: living → balcony → bedroom1 → bedroom2 → kitchen → bathroom.
4. **Apartment Features** — grid of 10 cards (icon + label) using lucide icons: `BedDouble` 2 Bedrooms, `Users` Sleeps 6, `Sun` 3 Balconies, `ArrowUpDown` Elevator, `Wifi` Fast Wi-Fi, `Snowflake` AC, `ChefHat` Kitchen, `WashingMachine` Washer, `Bath` Bathtub, `Laptop` Work Desk. Rounded-2xl white cards on light sand section, soft shadow, gold icon.
5. **Meet Your Hosts** — two-column: circular framed photo (reuse one uploaded photo as placeholder OR neutral silhouette — noting the user hasn't provided a host photo; will use a warm placeholder circle with initials **W & partner** until they upload one), warm copy as given. Background: white.
6. **Why Stay With Us** — 4 elegant cards (Heart, Zap, Home, MapPin icons): Personal Recommendations / Fast Response / Comfort Like Home / Perfect Location. Light grey background.
7. **Booking / Pricing** — keep existing `BookingWidget.tsx` but change price display from `€40 / night` to **"Starting from…"** with small line **"Current prices available on Airbnb — vary by season"** and keep the form + Airbnb trust link. Light sand background.
8. **Footer** — minimal, navy background, gold accents: brand + "Madaris Apartment · Hurghada, Egypt", link row (Airbnb, WhatsApp `wa.me/...` placeholder, Email `mailto:wafaa@fraktion42.net`, Instagram placeholder). Add small legal row.

Section background rhythm: white → light sand → white → light grey → white → light sand → navy footer.

## Animations
- Add `animate-fade-in` on hero text and section headings (existing keyframes in Tailwind config — verify or add via `@keyframes` in `styles.css`).
- Card hover: `transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`.
- No parallax, no flashy motion.

## i18n
Update all 6 locale files (`de, en, ar, ar-EG, nl, ru`) with:
- new brand + tagline
- hero sub, both CTA labels
- 10 amenity labels
- host section (title + paragraph)
- 4 "Why stay" card titles/descs
- pricing "Starting from…" copy
- footer address

## Open item
No host photo was uploaded. Plan uses an elegant monogram circle ("W&W" or similar) as a tasteful stand-in. If you'd rather I skip the host image until you send one, say so and I'll leave a subtle typographic placeholder.

## Out of scope
- Booking form logic, database, RLS, server functions — untouched.
- No new photos generated. Only the 10 already-uploaded apartment photos are used.

## Technical notes
- Files touched: `src/routes/index.tsx`, `src/routes/__root.tsx` (title + font `<link>` tags), `src/styles.css` (tokens + fade-in keyframes), `src/components/BookingWidget.tsx` (price block copy), all `src/i18n/locales/*.json`.
- New component: `src/components/FeatureCard.tsx`, `src/components/ReasonCard.tsx` to keep `index.tsx` readable.
- No package installs (lucide-react already used).
