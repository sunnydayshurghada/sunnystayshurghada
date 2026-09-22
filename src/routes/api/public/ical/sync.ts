import { createFileRoute } from "@tanstack/react-router";

/** Scheduled Airbnb import for every property. Requires the shared cron secret. */
async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";

  const { getCronSecret, syncAllProperties } = await import("@/lib/ical.server");
  const expected = await getCronSecret();

  if (!expected || provided.length !== expected.length) {
    return new Response("Unauthorized", { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });

  const results = await syncAllProperties();
  const ok = results.every((r) => r.result.ok);
  const imported = results.reduce((n, r) => n + r.result.imported, 0);
  return Response.json({ ok, properties: results.length, imported, results }, {
    status: ok ? 200 : 500,
  });
}

export const Route = createFileRoute("/api/public/ical/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
