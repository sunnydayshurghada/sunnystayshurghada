import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BookingWidget } from "@/components/BookingWidget";
import { AIRBNB_LISTING_URL } from "@/lib/airbnb";

// Original photos of the apartment (Madaris & Sheraton Road, Hurghada).
import balconyAsset from "@/assets/dsc06669.jpg.asset.json";
import bedroomMasterAsset from "@/assets/dsc06681.jpg.asset.json";
import bedroomTwinAsset from "@/assets/dsc06674.jpg.asset.json";
import bathroomAsset from "@/assets/dsc06697.jpg.asset.json";
const AIRBNB = "https://a0.muscache.com/im/pictures/hosting/Hosting-1726918631381181396/original";
const heroImg = `${AIRBNB}/74d06523-75c3-4325-81af-87e2682952e7.jpeg?im_w=1920`;
const livingImg: string | null = bedroomMasterAsset.url;
const bedroomImg = bedroomTwinAsset.url;
const bathroomImg = bathroomAsset.url;
void balconyAsset;

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-sand font-sans text-forest selection:bg-gold/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-sand/80 backdrop-blur-md border-b border-forest/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#" className="text-xl md:text-2xl font-display font-bold tracking-tight">
            {t("brand")}
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-medium">
            <a href="#gallery" className="hover:text-gold transition-colors">
              {t("nav.gallery")}
            </a>
            <a href="#amenities" className="hover:text-gold transition-colors">
              {t("nav.amenities")}
            </a>
            <a href="#reviews" className="hover:text-gold transition-colors">
              {t("nav.reviews")}
            </a>
          </nav>

          <div className="flex items-center gap-3 md:gap-6">
            <a
              href={AIRBNB_LISTING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-forest/60 hover:text-[#FF385C] transition-colors"
              title={t("booking.airbnb_trust")}
            >
              <span className="text-[#FF385C] text-base leading-none">◈</span>
              Airbnb
            </a>
            <LanguageSwitcher />
            <a
              href="#booking"
              className="hidden sm:inline-block bg-forest text-sand px-5 py-2.5 text-sm font-medium hover:bg-forest/90 transition-all"
            >
              {t("nav.book")}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden bg-forest">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-forest/40 via-transparent to-forest/60" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <span className="text-gold uppercase tracking-[0.4em] text-xs md:text-sm mb-4">
            {t("hero.eyebrow")}
          </span>
          <h1 className="text-sand text-5xl md:text-7xl font-display mb-8 max-w-3xl leading-[1.1]">
            {t("hero.title_1")}{" "}
            <span className="italic font-normal text-gold">{t("hero.title_accent")}</span>
          </h1>
          <p className="text-sand/85 text-base md:text-lg max-w-xl font-light leading-relaxed">
            {t("hero.subtitle")}
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-12 gap-4 md:gap-6 h-auto md:h-[720px]">
          <div className="col-span-12 md:col-span-8 h-[400px] md:h-full bg-forest/5 flex items-center justify-center">
            {livingImg ? (
              <img
                src={livingImg}
                alt={t("gallery.living")}
                loading="lazy"
                width={1200}
                height={800}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-forest/40 text-xs uppercase tracking-widest px-6 text-center">
                {t("gallery.living")}
              </span>
            )}
          </div>
          <div className="col-span-12 md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
            <div className="h-[220px] md:h-1/2">
              <img
                src={bedroomImg}
                alt={t("gallery.suite")}
                loading="lazy"
                width={800}
                height={800}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="h-[220px] md:h-1/2">
              <img
                src={bathroomImg}
                alt={t("gallery.bathroom")}
                loading="lazy"
                width={800}
                height={800}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Amenities + Booking */}
      <section id="booking" className="py-24 bg-forest text-sand">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <div id="amenities">
              <h2 className="text-4xl md:text-5xl font-display mb-8">{t("amenities.title")}</h2>
              <div className="grid grid-cols-2 gap-y-6 gap-x-12 border-t border-sand/10 pt-8">
                {[
                  ["amenities.space_label", "amenities.space_value"],
                  ["amenities.capacity_label", "amenities.capacity_value"],
                  ["amenities.wellness_label", "amenities.wellness_value"],
                  ["amenities.heat_label", "amenities.heat_value"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-gold text-xs uppercase tracking-widest">
                      {t(label)}
                    </span>
                    <span className="font-light">{t(value)}</span>
                  </div>
                ))}
              </div>

              <div id="reviews" className="mt-16">
                <h3 className="text-xl font-display mb-6">{t("review.title")}</h3>
                <div className="border-s border-gold ps-6 py-2">
                  <p className="italic text-lg text-sand/90 mb-4 font-light">
                    {t("review.quote")}
                  </p>
                  <cite className="text-xs uppercase tracking-widest text-gold font-medium not-italic">
                    {t("review.author")}
                  </cite>
                </div>
              </div>
            </div>

            <BookingWidget />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-forest/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-lg font-display font-bold">{t("brand")}</div>
          <div className="flex gap-8 md:gap-12 text-[10px] uppercase tracking-[0.2em] font-medium text-forest/60">
            <a href="#" className="hover:text-forest">
              {t("footer.imprint")}
            </a>
            <a href="#" className="hover:text-forest">
              {t("footer.privacy")}
            </a>
            <a href="#" className="hover:text-forest">
              {t("footer.contact")}
            </a>
          </div>
          <div className="text-[10px] text-forest/40 uppercase tracking-widest">
            {t("footer.rights")}
          </div>
        </div>
      </footer>
    </div>
  );
}
