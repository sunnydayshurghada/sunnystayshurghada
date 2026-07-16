import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BedDouble,
  Users,
  Bed,
  Sun,
  ArrowUpDown,
  Wifi,
  Snowflake,
  ChefHat,
  WashingMachine,
  Bath,
  Laptop,
  Heart,
  Zap,
  Home,
  MapPin,
  Mail,
  MessageCircle,
  ExternalLink,
  
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BookingWidget } from "@/components/BookingWidget";
import {
  AIRBNB_LISTING_URL,
  HOST_EMAIL,
  WHATSAPP_URL,
} from "@/lib/airbnb";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png.asset.json";
import hostsPhoto from "@/assets/hosts-wafaa-alex.jpg.asset.json";
import heroLivingKitchen from "@/assets/hero-living-kitchen.png.asset.json";

// Real photos of the apartment. No stock, no AI, no placeholder imagery.
import p6669 from "@/assets/dsc06669.jpg.asset.json";
import p6670 from "@/assets/dsc06670.jpg.asset.json";
import p6674 from "@/assets/dsc06674.jpg.asset.json";
import p6678 from "@/assets/dsc06678.jpg.asset.json";
import p6681 from "@/assets/dsc06681.jpg.asset.json";
import p6684 from "@/assets/dsc06684.jpg.asset.json";
import p6687 from "@/assets/dsc06687.jpg.asset.json";
import p6688 from "@/assets/dsc06688.jpg.asset.json";
import p6697 from "@/assets/dsc06697.jpg.asset.json";
import p6718 from "@/assets/dsc06718.jpg.asset.json";
import p6721 from "@/assets/dsc06721.jpg.asset.json";
import p6723 from "@/assets/dsc06723.jpg.asset.json";
import p6724 from "@/assets/dsc06724.jpg.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
});

type Photo = { url: string; captionKey: string; aspect: string };

// Ordered so the strongest apartment shots surface first in the masonry.
// Each aspect controls the intrinsic ratio inside the columns layout so
// the masonry keeps a natural rhythm instead of stripes.
const GALLERY: readonly Photo[] = [
  { url: p6674.url, captionKey: "gallery.bedroom_master", aspect: "aspect-[4/3]" },
  { url: p6669.url, captionKey: "gallery.living", aspect: "aspect-[3/4]" },
  { url: p6681.url, captionKey: "gallery.bedroom_twin", aspect: "aspect-[4/3]" },
  { url: p6670.url, captionKey: "gallery.balcony", aspect: "aspect-[4/3]" },
  { url: p6724.url, captionKey: "gallery.kitchen_breakfast", aspect: "aspect-[4/3]" },
  { url: p6723.url, captionKey: "gallery.living_entry", aspect: "aspect-[3/4]" },
  { url: p6697.url, captionKey: "gallery.bathroom", aspect: "aspect-[3/4]" },
  { url: p6718.url, captionKey: "gallery.living_sofa", aspect: "aspect-[4/3]" },
  { url: p6688.url, captionKey: "gallery.detail", aspect: "aspect-[4/3]" },
  { url: p6678.url, captionKey: "gallery.detail", aspect: "aspect-[4/5]" },
  { url: p6721.url, captionKey: "gallery.living_tv", aspect: "aspect-[4/3]" },
  { url: p6684.url, captionKey: "gallery.detail", aspect: "aspect-[4/3]" },
  { url: p6687.url, captionKey: "gallery.detail", aspect: "aspect-[4/3]" },
];

// Living room and kitchen — warm, sunny, welcoming.
const heroPhoto = heroLivingKitchen.url;


const FEATURES = [
  { icon: BedDouble, key: "features.bedrooms" },
  { icon: Users, key: "features.guests" },
  { icon: Bed, key: "features.beds" },
  { icon: Sun, key: "features.balconies" },
  { icon: ArrowUpDown, key: "features.elevator" },
  { icon: Wifi, key: "features.wifi" },
  { icon: Snowflake, key: "features.ac" },
  { icon: ChefHat, key: "features.kitchen" },
  { icon: Bath, key: "features.bath" },
  { icon: WashingMachine, key: "features.washer" },
  { icon: Laptop, key: "features.desk" },
] as const;

const REASONS = [
  { icon: Heart, titleKey: "why.recs_title", bodyKey: "why.recs_body" },
  { icon: Zap, titleKey: "why.response_title", bodyKey: "why.response_body" },
  { icon: Home, titleKey: "why.comfort_title", bodyKey: "why.comfort_body" },
  { icon: MapPin, titleKey: "why.location_title", bodyKey: "why.location_body" },
] as const;

function Index() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-paper font-sans text-forest selection:bg-gold/30">
      <SiteHeader />
      <Hero />
      <GallerySection />
      <FeaturesSection />
      <HostsSection />
      <WhySection />
      <BookingSection />
      <SiteFooter />
      {/* Preserve legacy translation key so the fallback locale still resolves */}
      <span className="sr-only">{t("brand")}</span>
    </div>
  );
}

/* ---------------- Header ---------------- */

function SiteHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-forest/5">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 md:h-24 flex items-center justify-between gap-6">
        <a href="#top" aria-label="Sunny Stays Hurghada — home" className="flex items-center py-2">
          <img
            src={brandLogo.url}
            alt="Sunny Stays Hurghada"
            className="h-10 md:h-14 w-auto select-none"
            draggable={false}
          />
        </a>

        <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.25em] font-medium text-forest/70">
          <a href="#gallery" className="hover:text-gold transition-colors">
            {t("nav.gallery")}
          </a>
          <a href="#features" className="hover:text-gold transition-colors">
            {t("nav.features")}
          </a>
          <a href="#hosts" className="hover:text-gold transition-colors">
            {t("nav.hosts")}
          </a>
          <a href="#booking" className="hover:text-gold transition-colors">
            {t("nav.book")}
          </a>
        </nav>

        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <LanguageSwitcher />
          <a
            href={AIRBNB_LISTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 bg-forest text-paper px-5 py-2.5 rounded-full text-xs uppercase tracking-[0.2em] font-medium hover:bg-gold hover:text-forest transition-colors"
          >
            {t("hero.cta_primary")}
          </a>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const { t } = useTranslation();
  return (
    <section
      id="top"
      className="relative flex items-center overflow-hidden bg-forest min-h-[75vh] md:min-h-[90vh]"
    >
      <img
        src={heroPhoto}
        alt=""
        width={1920}
        height={1280}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-forest/70 via-forest/40 to-forest/80" />

      <div className="relative z-10 w-full max-w-[560px] mx-auto md:mx-0 px-6 md:pl-[9vw] md:pr-8 py-20 text-center md:text-start animate-fade-rise">
        <span className="inline-block text-gold uppercase tracking-[0.5em] text-[10px] md:text-[11px] mb-6">
          {t("hero.welcome_to")}
        </span>
        <h1 className="font-display text-paper text-5xl sm:text-6xl md:text-7xl lg:text-[80px] leading-[1.02] tracking-tight mb-6">
          {t("hero.headline")}
        </h1>
        <p className="text-paper/90 text-xl md:text-2xl font-display italic leading-relaxed mb-5">
          {t("hero.subhead")}
        </p>
        <p className="text-paper/70 text-sm md:text-base tracking-[0.25em] uppercase mb-10">
          {t("hero.mantra")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start items-stretch sm:items-center">
          <a
            href={AIRBNB_LISTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 bg-gold text-forest px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-semibold shadow-lift transition-all duration-300 hover:bg-paper hover:-translate-y-0.5 hover:shadow-luxe"
          >
            {t("hero.cta_primary")}
            <ExternalLink className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2} />
          </a>
          <a
            href="#gallery"
            className="inline-flex items-center justify-center gap-2 bg-transparent text-paper border border-paper/50 px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-medium transition-all duration-300 hover:bg-paper/10 hover:border-paper hover:-translate-y-0.5"
          >
            {t("hero.cta_secondary")}
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-paper/60 text-[10px] uppercase tracking-[0.4em]">
        <span>Scroll</span>
        <span className="block h-10 w-px bg-paper/40" />
      </div>
    </section>
  );
}

/* ---------------- Gallery (masonry) ---------------- */

function GallerySection() {
  const { t } = useTranslation();
  return (
    <section id="gallery" className="py-28 md:py-40 bg-paper">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("gallery.eyebrow")}
          title={t("gallery.title")}
          sub={t("gallery.sub")}
        />

        <div className="mt-20 columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance]">
          {GALLERY.map((photo, i) => (
            <figure
              key={photo.url}
              className="mb-6 break-inside-avoid overflow-hidden rounded-2xl bg-cloud shadow-soft group"
            >
              <img
                src={photo.url}
                alt={t(photo.captionKey)}
                loading={i < 2 ? "eager" : "lazy"}
                className={`w-full ${photo.aspect} object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

function FeaturesSection() {
  const { t } = useTranslation();
  return (
    <section id="features" className="py-28 md:py-40 bg-sand">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("features.eyebrow")}
          title={t("features.title")}
          sub={t("features.sub", { defaultValue: "" })}
        />

        <div className="mt-20 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
          {FEATURES.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="group bg-paper rounded-3xl p-6 sm:p-7 md:p-8 flex flex-col items-start gap-5 shadow-soft border border-forest/[0.06] transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-luxe hover:border-gold/30 min-w-0"
            >
              <span className="inline-flex items-center justify-center h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 text-gold transition-all duration-500 group-hover:from-gold group-hover:to-gold group-hover:text-paper">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span className="w-full text-[14px] sm:text-[15px] font-medium text-forest leading-snug break-words [hyphens:auto]">
                {t(key)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Hosts ---------------- */

function HostsSection() {
  const { t } = useTranslation();
  return (
    <section id="hosts" className="py-28 md:py-40 bg-paper">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[220px_1fr] gap-10 md:gap-20 items-center">
        <div className="mx-auto md:mx-0">
          <div className="relative h-[150px] w-[150px] md:h-[200px] md:w-[200px] rounded-full border-2 border-gold/60 p-1.5 shadow-[0_25px_60px_-25px_rgba(23,59,99,0.4)]">
            <img
              src={hostsPhoto.url}
              alt="Wafaa and Alex, hosts of Sunny Stays Hurghada"
              className="h-full w-full rounded-full object-cover"
              style={{ objectPosition: "50% 20%" }}
              draggable={false}
            />
          </div>
        </div>

        <div className="text-center md:text-start">
          <span className="text-[11px] uppercase tracking-[0.35em] text-gold font-medium">
            {t("hosts.eyebrow")}
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-forest leading-tight">
            {t("hosts.title")}
          </h2>
          <p className="mt-6 text-base md:text-lg text-forest/75 leading-relaxed font-light max-w-2xl">
            {t("hosts.body")}
          </p>
          <div className="mt-8 h-px w-24 bg-gold/50 mx-auto md:mx-0" />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Why stay ---------------- */

function WhySection() {
  const { t } = useTranslation();
  return (
    <section className="py-28 md:py-40 bg-cloud">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("why.eyebrow")}
          title={t("why.title")}
        />

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-7">
          {REASONS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="group bg-paper rounded-3xl p-8 md:p-9 shadow-soft border border-forest/[0.06] transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-luxe hover:border-gold/30"
            >
              <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 text-gold transition-all duration-500 group-hover:from-gold group-hover:to-gold group-hover:text-paper">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-7 font-display text-2xl md:text-[26px] text-forest leading-tight">
                {t(titleKey)}
              </h3>
              <p className="mt-3 text-[15px] text-forest/70 leading-relaxed">
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Booking ---------------- */

function BookingSection() {
  const { t } = useTranslation();
  return (
    <section id="booking" className="py-28 md:py-40 bg-sand">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20">
        <div>
          <span className="text-[11px] uppercase tracking-[0.35em] text-gold font-medium">
            {t("pricing.eyebrow")}
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-forest leading-tight">
            {t("pricing.starting_from")}
          </h2>
          <p className="mt-6 text-base md:text-lg text-forest/75 leading-relaxed font-light max-w-md">
            {t("pricing.note")}
          </p>

          <div className="mt-10 flex flex-col gap-3 max-w-sm">
            <a
              href={AIRBNB_LISTING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-forest text-paper px-6 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-semibold hover:bg-gold hover:text-forest transition-colors"
            >
              {t("pricing.cta_airbnb")}
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
            <p className="text-center text-xs text-forest/50 italic">
              {t("pricing.cta_enquire")}
            </p>
          </div>

          <div className="mt-14 border-s-2 border-gold ps-6 py-2 max-w-md">
            <p className="italic text-base md:text-lg text-forest/85 mb-3 font-light font-display">
              {t("review.quote")}
            </p>
            <cite className="text-[11px] uppercase tracking-[0.25em] text-gold font-medium not-italic">
              {t("review.author")}
            </cite>
          </div>
        </div>

        <BookingWidget />
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="bg-forest text-paper relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-24 md:pt-32 pb-16 grid gap-14 md:gap-10 md:grid-cols-4">
        {/* Column 1 — Brand */}
        <div className="md:col-span-1">
          <div className="inline-flex bg-paper rounded-2xl px-5 py-4 shadow-soft">
            <img
              src={brandLogo.url}
              alt="Sunny Stays Hurghada"
              className="h-12 md:h-14 w-auto select-none"
              draggable={false}
            />
          </div>
          <p className="mt-6 text-[15px] text-paper/70 leading-relaxed font-light max-w-xs">
            {t("footer.brand_blurb")}
          </p>
        </div>

        {/* Column 2 — Apartments */}
        <div>
          <h4 className="text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-6">
            {t("footer.apartments_title")}
          </h4>
          <ul className="space-y-3 text-[15px] text-paper/75 font-light">
            <li>
              <a href="#gallery" className="hover:text-gold transition-colors">
                {t("footer.apartment_madaris")}
              </a>
            </li>
            <li className="text-paper/45 italic">
              {t("footer.apartment_future")}
            </li>
          </ul>
        </div>

        {/* Column 3 — Quick links */}
        <div>
          <h4 className="text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-6">
            {t("footer.links_title")}
          </h4>
          <ul className="space-y-3 text-[15px] text-paper/75 font-light">
            <li><a href="#top" className="hover:text-gold transition-colors">{t("footer.link_home")}</a></li>
            <li><a href="#gallery" className="hover:text-gold transition-colors">{t("footer.link_gallery")}</a></li>
            <li><a href="#features" className="hover:text-gold transition-colors">{t("footer.link_amenities")}</a></li>
            <li><a href="#hosts" className="hover:text-gold transition-colors">{t("footer.link_hosts")}</a></li>
            <li><a href="#booking" className="hover:text-gold transition-colors">{t("footer.link_location")}</a></li>
            <li>
              <a
                href={AIRBNB_LISTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-gold transition-colors"
              >
                {t("footer.link_book")}
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </a>
            </li>
          </ul>
        </div>

        {/* Column 4 — Contact */}
        <div>
          <h4 className="text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-6">
            {t("footer.contact_title")}
          </h4>
          <ul className="space-y-4 text-[15px] text-paper/75 font-light">
            <li className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-gold shrink-0" strokeWidth={1.75} />
              <span>{t("footer.address_short")}</span>
            </li>
            <li className="flex items-start gap-3">
              <MessageCircle className="h-4 w-4 mt-0.5 text-gold shrink-0" strokeWidth={1.75} />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  {t("footer.whatsapp")}
                </a>
                <span aria-hidden="true" className="text-paper/30">·</span>
                <a
                  href="tel:+201556055957"
                  dir="ltr"
                  className="hover:text-gold transition-colors tracking-wide"
                >
                  +20&nbsp;155&nbsp;605&nbsp;5957
                </a>
              </span>
            </li>
            <li>
              <a
                href={`mailto:${HOST_EMAIL}`}
                className="inline-flex items-center gap-3 hover:text-gold transition-colors break-all"
              >
                <Mail className="h-4 w-4 text-gold shrink-0" strokeWidth={1.75} />
                <span>{HOST_EMAIL}</span>
              </a>
            </li>
            <li>
              <a
                href={AIRBNB_LISTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 hover:text-gold transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-gold shrink-0" strokeWidth={1.75} />
                <span>{t("footer.airbnb")}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-paper/55">
          <span className="tracking-wide">{t("footer.copyright")}</span>
          <span className="tracking-wide italic font-light">{t("footer.designed_with")}</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Bits ---------------- */

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <span className="text-[11px] uppercase tracking-[0.35em] text-gold font-medium">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-display text-4xl md:text-5xl text-forest leading-tight">
        {title}
      </h2>
      {sub ? (
        <p className="mt-5 text-base md:text-lg text-forest/70 font-light leading-relaxed">
          {sub}
        </p>
      ) : null}
      <div className="mt-8 h-px w-16 bg-gold/60 mx-auto" />
    </div>
  );
}
