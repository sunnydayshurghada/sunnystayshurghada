import { createServerFn } from "@tanstack/react-start";

type GoogleMapsBrowserConfig = {
  key: string | null;
  channel: string | null;
  source: string | null;
};

function readUsableGoogleApiKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || key.includes("@secret:")) return null;
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key) ? key : null;
}

function readOptionalValue(value: string | undefined) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.includes("@secret:")) return null;
  return cleaned;
}

export const getGoogleMapsBrowserConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleMapsBrowserConfig> => {
    const candidates = [
      ["GOOGLE_API_KEY", process.env.GOOGLE_API_KEY],
      ["GOOGLE_MAPS_BROWSER_KEY", process.env.GOOGLE_MAPS_BROWSER_KEY],
      [
        "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
        process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY,
      ],
      ["VITE_GOOGLE_MAPS_BROWSER_KEY_PROD", process.env.VITE_GOOGLE_MAPS_BROWSER_KEY_PROD],
      ["VITE_GOOGLE_MAPS_BROWSER_KEY", process.env.VITE_GOOGLE_MAPS_BROWSER_KEY],
    ] as const;

    for (const [source, value] of candidates) {
      const key = readUsableGoogleApiKey(value);
      if (key) {
        return {
          key,
          channel: readOptionalValue(
            process.env.GOOGLE_MAPS_TRACKING_ID ??
              process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID
          ),
          source,
        };
      }
    }

    console.error(
      "[maps] no usable browser key available",
      JSON.stringify({
        envKeys: Object.keys(process.env ?? {}).filter((key) =>
          /GOOGLE|MAPS/i.test(key)
        ),
      })
    );

    return { key: null, channel: null, source: null };
  }
);