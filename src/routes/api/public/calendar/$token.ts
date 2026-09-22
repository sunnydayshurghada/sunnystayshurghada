import { createFileRoute } from "@tanstack/react-router";

/**
 * Public but unguessable availability feed for Airbnb.
 * Contains dates only — no names, contacts, messages or prices.
 */
export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").replace(/\.ics$/i, "");
        if (!token || token.length < 16) return new Response("Not found", { status: 404 });

        const { getSettings, buildExportIcs } = await import("@/lib/ical.server");
        const settings = await getSettings();
        const expected = settings.export_token;

        if (!expected || token.length !== expected.length) {
          return new Response("Not found", { status: 404 });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i += 1) {
          diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
        }
        if (diff !== 0) return new Response("Not found", { status: 404 });

        const ics = await buildExportIcs();
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="sunny-stays.ics"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
