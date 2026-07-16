import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BedDouble,
  Users,
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
  Instagram,
  ExternalLink,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BookingWidget } from "@/components/BookingWidget";
import {
  AIRBNB_LISTING_URL,
  HOST_EMAIL,
  WHATSAPP_URL,
  INSTAGRAM_URL,
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
  { icon: Sun, key: "features.balconies" },
  { icon: ArrowUpDown, key: "features.elevator" },
  { icon: Wifi, key: "features.wifi" },
  { icon: Snowflake, key: "features.ac" },
  { icon: ChefHat, key: "features.kitchen" },
  { icon: WashingMachine, key: "features.washer" },
  { icon: Bath, key: "features.bath" },
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
    <section id="top" className="relative min-h-[92vh] flex items-center overflow-hidden bg-forest">
      <img
        src={heroPhoto}
        alt=""
        width={1920}
        height={1280}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-forest/60 via-forest/45 to-forest/80" />

      <div className="relative z-10 w-full max-w-[560px] px-6 md:px-0 md:ml-16 lg:ml-[clamp(120px,9vw,180px)] py-24 text-center md:text-left animate-fade-rise">
        <span className="inline-block text-gold uppercase tracking-[0.45em] text-[11px] md:text-xs mb-8">
          {t("hero.eyebrow")}
        </span>
        <h1 className="font-display text-paper text-5xl sm:text-6xl md:text-7xl lg:text-[92px] leading-[1.02] tracking-tight mb-8">
          {t("hero.headline")}
        </h1>
        <p className="text-paper/85 text-lg md:text-2xl font-display italic max-w-2xl mx-auto leading-relaxed mb-12">
          {t("hero.sub")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={AIRBNB_LISTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gold text-forest px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-semibold hover:bg-paper transition-colors shadow-lg shadow-forest/40"
          >
            {t("hero.cta_primary")}
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <a
            href="#gallery"
            className="inline-flex items-center gap-2 bg-transparent text-paper border border-paper/50 px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-medium hover:bg-paper/10 transition-colors"
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
    <section id="gallery" className="py-24 md:py-32 bg-paper">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("gallery.eyebrow")}
          title={t("gallery.title")}
          sub={t("gallery.sub")}
        />

        <div className="mt-16 columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance]">
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
    <section id="features" className="py-24 md:py-32 bg-sand">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("features.eyebrow")}
          title={t("features.title")}
          sub={t("features.sub", { defaultValue: "" })}
        />

        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {FEATURES.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="bg-paper rounded-2xl p-6 md:p-7 flex flex-col items-start gap-4 shadow-soft border border-forest/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 text-gold">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="text-sm md:text-[15px] font-medium text-forest leading-snug">
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
    <section id="hosts" className="py-24 md:py-32 bg-paper">
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
    <section className="py-24 md:py-32 bg-cloud">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow={t("why.eyebrow")}
          title={t("why.title")}
        />

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {REASONS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="bg-paper rounded-2xl p-8 shadow-soft border border-forest/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-forest/5 text-gold">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-6 font-display text-2xl text-forest leading-tight">
                {t(titleKey)}
              </h3>
              <p className="mt-3 text-sm text-forest/70 leading-relaxed">
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
    <section id="booking" className="py-24 md:py-32 bg-sand">
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
    <footer className="bg-forest text-paper">
      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="inline-flex bg-paper rounded-2xl px-5 py-4 shadow-soft">
            <img
              src={brandLogo.url}
              alt="Sunny Stays Hurghada"
              className="h-14 md:h-16 w-auto select-none"
              draggable={false}
            />
          </div>
          <p className="mt-5 text-sm text-paper/60">{t("footer.address_line")}</p>
          <p className="mt-4 text-sm text-paper/70 max-w-sm leading-relaxed font-light">
            {t("tagline")}
          </p>
        </div>

        <div>
          <h4 className="text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-5">
            {t("footer.contact_title")}
          </h4>
          <ul className="space-y-3 text-sm text-paper/75">
            <li>
              <a
                href={`mailto:${HOST_EMAIL}`}
                className="inline-flex items-center gap-2 hover:text-gold transition-colors"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                {HOST_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-gold transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
                {t("footer.whatsapp")}
              </a>
            </li>
            <li>
              <a
                href={AIRBNB_LISTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-gold transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                {t("footer.airbnb")}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-5">
            {t("footer.social_title")}
          </h4>
          <ul className="space-y-3 text-sm text-paper/75">
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-gold transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" strokeWidth={2} />
                {t("footer.instagram")}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <span>{t("footer.rights")}</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gold transition-colors">
              {t("footer.imprint")}
            </a>
            <a href="#" className="hover:text-gold transition-colors">
              {t("footer.privacy")}
            </a>
          </div>
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
