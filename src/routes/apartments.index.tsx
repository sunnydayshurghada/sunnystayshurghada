import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { listPublicProperties } from "@/lib/properties.functions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";

export const Route = createFileRoute("/apartments/")({
  loader: () => listPublicProperties(),
  head: () => ({
    meta: [
      { title: "Unsere Wohnungen — Sunny Stays Hurghada" },
      {
        name: "description",
        content:
          "Alle privat vermieteten Wohnungen von Wafaa & Alex in Hurghada am Roten Meer im Überblick.",
      },
      { property: "og:title", content: "Unsere Wohnungen — Sunny Stays Hurghada" },
      {
        property: "og:description",
        content: "Alle privat vermieteten Wohnungen von Wafaa & Alex in Hurghada im Überblick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <Shell>—</Shell>,
  notFoundComponent: () => <Shell>—</Shell>,
  component: ApartmentsPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-sand text-forest">
      <header className="border-b border-forest/10 bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img src={brandLogo} alt="Sunny Stays Hurghada" className="h-12 w-auto" />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-16">{children}</div>
    </main>
  );
}

function ApartmentsPage() {
  const properties = Route.useLoaderData();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split("-")[0];

  return (
    <Shell>
      <span className="block text-[10px] uppercase tracking-[0.35em] text-gold font-medium mb-3">
        {t("apartments.eyebrow")}
      </span>
      <h1 className="font-display text-4xl mb-10">{t("apartments.title")}</h1>

      {properties.length === 0 ? (
        <p className="text-sm text-forest/60">{t("apartments.empty")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {properties.map((p) => {
            const name = p.translations?.[lang]?.["public_name"] ?? p.public_name;
            const teaser =
              p.translations?.[lang]?.["short_description"] ?? p.short_description ?? "";
            return (
              <Link
                key={p.id}
                to="/apartments/$slug"
                params={{ slug: p.slug }}
                className="bg-card rounded-3xl border border-forest/10 p-8 hover:shadow-lift transition-shadow"
              >
                <h2 className="font-display text-2xl mb-2">{name}</h2>
                <p className="text-sm text-forest/70 leading-relaxed">{teaser}</p>
                <p className="mt-4 text-[10px] uppercase tracking-widest text-gold">
                  {t("apartments.details")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
