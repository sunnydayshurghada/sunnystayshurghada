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

function readGoogleWeatherApiKey() {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY?.trim();
  if (!apiKey || apiKey.includes("@secret:")) return null;
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey) ? apiKey : null;
}

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
    const apiKey = readGoogleWeatherApiKey();
    const keyPresent = !!apiKey;
    console.log(
      "[weather] env check",
      JSON.stringify({
        keyPresent,
        keyLen: apiKey?.length ?? 0,
        keyPrefix: apiKey ? apiKey.slice(0, 6) : "",
        hasProcess: typeof process !== "undefined",
        matchingEnvKeys:
          typeof process !== "undefined"
            ? Object.keys(process.env ?? {}).filter((k) =>
                /GOOGLE|MAPS|WEATHER/i.test(k)
              )
            : [],
      })
    );
    if (!apiKey) {
      return { current: null, daily: [], error: "missing_credentials" };
    }
    const languageCode = LANG_MAP[data.lang] ?? "en";

    const currentUrl = new URL(`${WEATHER_API}/v1/currentConditions:lookup`);
    currentUrl.searchParams.set("key", apiKey);
    currentUrl.searchParams.set("location.latitude", String(LAT));
    currentUrl.searchParams.set("location.longitude", String(LNG));
    currentUrl.searchParams.set("languageCode", languageCode);
    currentUrl.searchParams.set("unitsSystem", "METRIC");

    const forecastUrl = new URL(`${WEATHER_API}/v1/forecast/days:lookup`);
    forecastUrl.searchParams.set("key", apiKey);
    forecastUrl.searchParams.set("location.latitude", String(LAT));
    forecastUrl.searchParams.set("location.longitude", String(LNG));
    forecastUrl.searchParams.set("languageCode", languageCode);
    forecastUrl.searchParams.set("unitsSystem", "METRIC");
    forecastUrl.searchParams.set("days", "7");

    const redact = (u: URL) => {
      const c = new URL(u.toString());
      c.searchParams.set("key", "REDACTED");
      return c.toString();
    };

    console.log(
      "[weather] requesting",
      JSON.stringify({
        currentUrl: redact(currentUrl),
        forecastUrl: redact(forecastUrl),
      })
    );

    try {
      const [curRes, fcRes] = await Promise.all([
        fetch(currentUrl.toString(), { headers: { Accept: "application/json" } }),
        fetch(forecastUrl.toString(), { headers: { Accept: "application/json" } }),
      ]);

      const curBody = await curRes.text();
      const fcBody = await fcRes.text();

      console.log(
        "[weather] responses",
        JSON.stringify({
          currentStatus: curRes.status,
          currentOk: curRes.ok,
          currentBody: curBody.slice(0, 1500),
          forecastStatus: fcRes.status,
          forecastOk: fcRes.ok,
          forecastBody: fcBody.slice(0, 1500),
        })
      );

      if (!curRes.ok || !fcRes.ok) {
        return { current: null, daily: [], error: "upstream_error" };
      }

      const cur = JSON.parse(curBody) as any;
      const fc = JSON.parse(fcBody) as any;

      const current = cur
        ? {
            tempC: Math.round(cur.temperature?.degrees ?? 0),
            feelsLikeC: Math.round(
              cur.feelsLikeTemperature?.degrees ?? cur.temperature?.degrees ?? 0
            ),
            humidity: Math.round(cur.relativeHumidity ?? 0),
            windKph: Math.round(cur.wind?.speed?.value ?? 0),
            iconType: cur.weatherCondition?.type ?? "UNKNOWN",
            description: cur.weatherCondition?.description?.text ?? "",
          }
        : null;

      const daily = ((fc.forecastDays ?? []) as any[]).map((d) => {
        const dp = d.displayDate ?? {};
        const iso = `${dp.year}-${String(dp.month).padStart(2, "0")}-${String(
          dp.day
        ).padStart(2, "0")}`;
        return {
          date: iso,
          minC: Math.round(d.minTemperature?.degrees ?? 0),
          maxC: Math.round(d.maxTemperature?.degrees ?? 0),
          iconType: d.daytimeForecast?.weatherCondition?.type ?? "UNKNOWN",
          description:
            d.daytimeForecast?.weatherCondition?.description?.text ?? "",
        };
      });

      return { current, daily };
    } catch (e) {
      console.error("[weather] network error", e);
      return { current: null, daily: [], error: "network_error" };
    }
  });

