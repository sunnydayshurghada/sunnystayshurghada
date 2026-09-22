import { createFileRoute } from "@tanstack/react-router";

/**
 * Public but unguessable availability feed for one apartment.
 * Contains dates only — no names, contacts, messages or prices.
 */
export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").replace(/\.ics$/i, "");
        if (!token || token.length < 16) return new Response("Not found", { status: 404 });

        const { findPropertyByExportToken, buildExportIcs } = await import("@/lib/ical.server");
        const propertyId = await findPropertyByExportToken(token);
        if (!propertyId) return new Response("Not found", { status: 404 });

        const ics = await buildExportIcs(propertyId);
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
