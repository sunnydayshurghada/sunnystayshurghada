import { createFileRoute } from "@tanstack/react-router";

/** Scheduled Airbnb import. Requires the shared cron secret. */
async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";

  const { getSettings, syncAirbnb } = await import("@/lib/ical.server");
  const settings = await getSettings();
  const expected = settings.cron_secret;

  if (!expected || provided.length !== expected.length) {
    return new Response("Unauthorized", { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });

  const result = await syncAirbnb("cron");
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const Route = createFileRoute("/api/public/ical/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
