import { createServerFn } from "@tanstack/react-start";

// Hurghada, Egypt
const LAT = 27.212769;
const LNG = 33.832099;
const WEATHER_API = "https://weather.googleapis.com";

const LANG_MAP: Record<string, string> = {
  de: "de",
  en: "en",
  nl: "nl",
  ru: "ru",
  ar: "ar",
  "ar-EG": "ar",
};

type WeatherPayload = {
  current: {
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKph: number;
    iconType: string;
    description: string;
  } | null;
  daily: Array<{
    date: string; // ISO YYYY-MM-DD
    minC: number;
    maxC: number;
    iconType: string;
    description: string;
  }>;
  error?: string;
};

export const getHurghadaWeather = createServerFn({ method: "GET" })
  .inputValidator((input: { lang?: string } | undefined) => ({
    lang: input?.lang ?? "en",
  }))
  .handler(async ({ data }): Promise<WeatherPayload> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!apiKey || !lovableKey) {
      return { current: null, daily: [], error: "missing_credentials" };
    }
    const languageCode = LANG_MAP[data.lang] ?? "en";
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
    };

    const currentUrl = new URL(`${GATEWAY}/weather/v1/currentConditions:lookup`);
    currentUrl.searchParams.set("location.latitude", String(LAT));
    currentUrl.searchParams.set("location.longitude", String(LNG));
    currentUrl.searchParams.set("languageCode", languageCode);
    currentUrl.searchParams.set("unitsSystem", "METRIC");

    const forecastUrl = new URL(`${GATEWAY}/weather/v1/forecast/days:lookup`);
    forecastUrl.searchParams.set("location.latitude", String(LAT));
    forecastUrl.searchParams.set("location.longitude", String(LNG));
    forecastUrl.searchParams.set("languageCode", languageCode);
    forecastUrl.searchParams.set("unitsSystem", "METRIC");
    forecastUrl.searchParams.set("days", "7");

    try {
      const [curRes, fcRes] = await Promise.all([
        fetch(currentUrl.toString(), { headers }),
        fetch(forecastUrl.toString(), { headers }),
      ]);

      if (!curRes.ok || !fcRes.ok) {
        const body = !curRes.ok ? await curRes.text() : await fcRes.text();
        console.error("Weather API error", curRes.status, fcRes.status, body);
        return { current: null, daily: [], error: "upstream_error" };
      }

      const cur = (await curRes.json()) as any;
      const fc = (await fcRes.json()) as any;

      const current = cur
        ? {
            tempC: Math.round(cur.temperature?.degrees ?? 0),
            feelsLikeC: Math.round(cur.feelsLikeTemperature?.degrees ?? cur.temperature?.degrees ?? 0),
            humidity: Math.round(cur.relativeHumidity ?? 0),
            windKph: Math.round(cur.wind?.speed?.value ?? 0),
            iconType: cur.weatherCondition?.type ?? "UNKNOWN",
            description: cur.weatherCondition?.description?.text ?? "",
          }
        : null;

      const daily = ((fc.forecastDays ?? []) as any[]).map((d) => {
        const dp = d.displayDate ?? {};
        const iso = `${dp.year}-${String(dp.month).padStart(2, "0")}-${String(dp.day).padStart(2, "0")}`;
        return {
          date: iso,
          minC: Math.round(d.minTemperature?.degrees ?? 0),
          maxC: Math.round(d.maxTemperature?.degrees ?? 0),
          iconType: d.daytimeForecast?.weatherCondition?.type ?? "UNKNOWN",
          description: d.daytimeForecast?.weatherCondition?.description?.text ?? "",
        };
      });

      return { current, daily };
    } catch (e) {
      console.error("Weather fetch failed", e);
      return { current: null, daily: [], error: "network_error" };
    }
  });
