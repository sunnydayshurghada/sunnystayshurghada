import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Navigation,
  ExternalLink,
  Waves,
  UtensilsCrossed,
  Coffee,
  ShoppingCart,
  Plane,
  Wind,
  Droplets,
  Thermometer,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
} from "lucide-react";
import { getHurghadaWeather } from "@/lib/weather.functions";
import { AIRBNB_LISTING_URL } from "@/lib/airbnb";

const LAT = 27.212769;
const LNG = 33.832099;
const GMAPS_PLACE_URL = "https://www.google.com/maps/search/?api=1&query=Wasta+Street+9+Madaris+Hurghada+Egypt";
const GMAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`;

/* -------- Map (lazy loaded when visible) -------- */

declare global {
  interface Window {
    google?: any;
    __sunnyInitMap?: () => void;
  }
}

function InteractiveMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return;

    const init = () => {
      if (!ref.current || !window.google?.maps) return;
      const map = new window.google.maps.Map(ref.current, {
        center: { lat: LAT, lng: LNG },
        zoom: 15,
        disableDefaultUI: false,
        clickableIcons: true,
        gestureHandling: "cooperative",
        styles: [
          { featureType: "poi.business", stylers: [{ visibility: "on" }] },
        ],
      });
      new window.google.maps.Marker({
        position: { lat: LAT, lng: LNG },
        map,
        title: "Madaris Apartment",
      });
      setLoaded(true);
    };

    if (window.google?.maps) {
      init();
      return;
    }

    window.__sunnyInitMap = init;
    const existing = document.querySelector<HTMLScriptElement>("script[data-sunny-gmaps]");
    if (existing) {
      // Wait for existing script
      const check = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(check);
          init();
        }
      }, 100);
      return () => clearInterval(check);
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__sunnyInitMap${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.defer = true;
    script.dataset.sunnyGmaps = "1";
    document.head.appendChild(script);
  }, []);

  return (
    <div className="relative w-full h-[340px] md:h-[520px] rounded-[20px] overflow-hidden shadow-luxe bg-cloud">
      <div ref={ref} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-forest/50 text-sm">
          <span className="inline-block h-8 w-8 rounded-full border-2 border-gold/40 border-t-gold animate-spin" />
        </div>
      )}
    </div>
  );
}



/* -------- Weather helpers -------- */

function iconForType(type: string) {
  const t = type.toUpperCase();
  if (t.includes("THUNDER")) return CloudLightning;
  if (t.includes("SNOW") || t.includes("ICE") || t.includes("HAIL")) return CloudSnow;
  if (t.includes("RAIN") || t.includes("SHOWER") || t.includes("DRIZZLE")) return CloudRain;
  if (t.includes("FOG") || t.includes("MIST") || t.includes("HAZE") || t.includes("SMOKE")) return CloudFog;
  if (t.includes("CLOUD") || t.includes("OVERCAST")) return Cloud;
  return Sun;
}

function formatDay(iso: string, locale: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  } catch {
    return iso;
  }
}

/* -------- Nearby -------- */

const NEARBY = [
  { icon: Waves, key: "beach" },
  { icon: UtensilsCrossed, key: "restaurants" },
  { icon: Coffee, key: "cafes" },
  { icon: ShoppingCart, key: "supermarket" },
  { icon: Plane, key: "airport" },
] as const;

/* -------- Section -------- */

export function LocationSection() {
  const { t, i18n } = useTranslation();
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const fetchWeather = useServerFn(getHurghadaWeather);

  useEffect(() => {
    if (!rootRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  const lang = i18n.language || "en";
  const weatherQuery = useQuery({
    queryKey: ["hurghada-weather", lang],
    queryFn: () => fetchWeather({ data: { lang } }),
    enabled: visible,
    staleTime: 15 * 60 * 1000,
  });

  return (
    <section ref={rootRef} id="location" className="py-28 md:py-40 bg-paper">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-[11px] uppercase tracking-[0.35em] text-gold font-medium">
            {t("location.eyebrow")}
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl text-forest leading-tight">
            {t("location.title")}
          </h2>
          <p className="mt-5 text-base md:text-lg text-forest/70 font-light leading-relaxed">
            {t("location.sub")}
          </p>
          <div className="mt-8 h-px w-16 bg-gold/60 mx-auto" />
        </div>

        <div className="mt-16 md:mt-20 grid lg:grid-cols-[3fr_2fr] gap-8 lg:gap-10 items-start">
          {/* MAP */}
          <div className="flex flex-col gap-4">
            {visible ? <InteractiveMap /> : (
              <div className="w-full h-[340px] md:h-[520px] rounded-[20px] bg-cloud shadow-soft" />
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={GMAPS_PLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-forest text-paper px-6 py-3.5 rounded-full text-xs uppercase tracking-[0.25em] font-semibold hover:bg-gold hover:text-forest transition-colors"
              >
                <MapPin className="h-4 w-4" strokeWidth={2} />
                {t("location.open_in_maps")}
              </a>
              <a
                href={GMAPS_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-transparent text-forest border border-forest/25 px-6 py-3.5 rounded-full text-xs uppercase tracking-[0.25em] font-medium hover:border-gold hover:text-gold transition-colors"
              >
                <Navigation className="h-4 w-4" strokeWidth={2} />
                {t("location.get_directions")}
              </a>
            </div>
          </div>

          {/* INFO + WEATHER + NEARBY */}
          <div className="flex flex-col gap-6">
            {/* Address card */}
            <div className="bg-sand rounded-3xl p-7 md:p-8 shadow-soft border border-forest/[0.06]">
              <span className="text-[10px] uppercase tracking-[0.35em] text-gold font-medium">
                {t("location.address_label")}
              </span>
              <p className="mt-3 font-display text-2xl text-forest leading-tight">
                {t("location.address_line1")}
              </p>
              <p className="mt-1 text-[15px] text-forest/70 font-light">
                {t("location.address_line2")}
              </p>
            </div>

            {/* Weather */}
            <WeatherCard
              data={weatherQuery.data}
              loading={weatherQuery.isLoading || !visible}
              lang={lang}
            />
          </div>
        </div>

        {/* Nearby */}
        <div className="mt-16 md:mt-20">
          <h3 className="text-center font-display text-2xl md:text-3xl text-forest">
            {t("location.nearby_title")}
          </h3>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-5 md:gap-6">
            {NEARBY.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="group bg-paper rounded-3xl p-6 md:p-7 flex flex-col items-center text-center gap-4 shadow-soft border border-forest/[0.06] transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-luxe hover:border-gold/30"
              >
                <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 text-gold transition-all duration-500 group-hover:from-gold group-hover:to-gold group-hover:text-paper">
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="font-medium text-forest text-[15px] leading-snug">
                    {t(`location.nearby.${key}.title`)}
                  </p>
                  <p className="mt-1 text-xs text-forest/60 tracking-wide">
                    {t(`location.nearby.${key}.distance`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-16 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <a
            href={AIRBNB_LISTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-gold text-forest px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-semibold shadow-lift hover:bg-forest hover:text-paper hover:-translate-y-0.5 transition-all duration-300"
          >
            {t("location.cta_airbnb")}
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <a
            href={GMAPS_PLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-transparent text-forest border border-forest/25 px-8 py-4 rounded-full text-xs uppercase tracking-[0.25em] font-medium hover:border-gold hover:text-gold transition-colors"
          >
            {t("location.cta_maps")}
            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------- Weather Card -------- */

function WeatherCard({
  data,
  loading,
  lang,
}: {
  data: any;
  loading: boolean;
  lang: string;
}) {
  const { t } = useTranslation();

  if (loading || !data) {
    return (
      <div className="bg-gradient-to-br from-forest to-forest/90 text-paper rounded-3xl p-7 md:p-8 shadow-luxe min-h-[220px] flex items-center justify-center">
        <span className="inline-block h-6 w-6 rounded-full border-2 border-gold/40 border-t-gold animate-spin" />
      </div>
    );
  }

  if (!data.current) {
    return (
      <div className="bg-gradient-to-br from-forest to-forest/90 text-paper rounded-3xl p-7 md:p-8 shadow-luxe">
        <span className="text-[10px] uppercase tracking-[0.35em] text-gold font-medium">
          {t("location.weather_label")}
        </span>
        <p className="mt-3 text-paper/70 text-sm">{t("location.weather_unavailable")}</p>
      </div>
    );
  }

  const CurIcon = iconForType(data.current.iconType);
  const today = data.daily?.[0];

  return (
    <div className="bg-gradient-to-br from-forest to-forest/90 text-paper rounded-3xl p-7 md:p-8 shadow-luxe">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.35em] text-gold font-medium">
            {t("location.weather_label")}
          </span>
          <p className="mt-2 text-sm text-paper/70">{t("location.weather_city")}</p>
        </div>
        <CurIcon className="h-10 w-10 text-gold" strokeWidth={1.5} />
      </div>

      <div className="mt-5 flex items-end gap-3">
        <span className="font-display text-6xl md:text-7xl leading-none">
          {data.current.tempC}°
        </span>
        <span className="text-paper/70 text-sm pb-2 capitalize">
          {data.current.description}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2 text-paper/80">
          <Thermometer className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={1.75} />
          <span>{t("location.feels_like")} {data.current.feelsLikeC}°</span>
        </div>
        <div className="flex items-center gap-2 text-paper/80">
          <Droplets className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={1.75} />
          <span>{data.current.humidity}%</span>
        </div>
        <div className="flex items-center gap-2 text-paper/80">
          <Wind className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={1.75} />
          <span>{data.current.windKph} km/h</span>
        </div>
      </div>

      {today && (
        <div className="mt-6 pt-5 border-t border-paper/10 flex items-center justify-between text-xs">
          <span className="uppercase tracking-[0.25em] text-paper/60">{t("location.today")}</span>
          <span className="text-paper/80">
            <span className="text-gold font-medium">{today.maxC}°</span>
            <span className="mx-1.5 text-paper/40">/</span>
            <span>{today.minC}°</span>
          </span>
        </div>
      )}

      {data.daily?.length > 1 && (
        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {data.daily.slice(1, 7).map((d: any) => {
            const Icon = iconForType(d.iconType);
            return (
              <div
                key={d.date}
                className="flex flex-col items-center gap-1.5 py-2 rounded-xl bg-paper/5"
              >
                <span className="text-[10px] uppercase tracking-wider text-paper/60">
                  {formatDay(d.date, lang)}
                </span>
                <Icon className="h-4 w-4 text-gold" strokeWidth={1.75} />
                <span className="text-[11px] text-paper/85">
                  <span className="font-medium">{d.maxC}°</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
