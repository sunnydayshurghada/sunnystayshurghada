import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getPropertyBySlug } from "@/lib/properties.functions";
import { BookingWidget } from "@/components/BookingWidget";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";

export const Route = createFileRoute("/apartments/$slug")({
  loader: async ({ params }) => {
    const property = await getPropertyBySlug({ data: { slug: params.slug } });
    if (!property) throw notFound();
    return property;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.public_name ?? "Wohnung";
    const description =
      loaderData?.short_description ?? "Privat vermietete Wohnung in Hurghada am Roten Meer.";
    return {
      meta: [
        { title: `${name} — Sunny Stays Hurghada` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} — Sunny Stays Hurghada` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <Shell>—</Shell>,
  notFoundComponent: () => <Shell>—</Shell>,
  component: ApartmentPage,
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

function ApartmentPage() {
  const property = Route.useLoaderData();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split("-")[0];
  const tr = property.translations?.[lang] ?? {};
  const name = tr["public_name"] ?? property.public_name;
  const full = tr["full_description"] ?? property.full_description ?? property.short_description;

  return (
    <Shell>
      <Link
        to="/apartments"
        className="text-[10px] uppercase tracking-[0.3em] text-gold hover:text-forest"
      >
        {t("apartments.back")}
      </Link>
      <h1 className="font-display text-4xl mt-4 mb-4">{name}</h1>
      {full ? <p className="text-forest/75 leading-relaxed max-w-2xl mb-8">{full}</p> : null}

      <ul className="flex flex-wrap gap-6 text-xs uppercase tracking-widest text-forest/60 mb-14">
        <li>{t("apartments.facts.guests", { count: property.maximum_guests })}</li>
        <li>{t("apartments.facts.bedrooms", { count: property.bedrooms })}</li>
        <li>{t("apartments.facts.beds", { count: property.beds })}</li>
        <li>{t("apartments.facts.bathrooms", { count: property.bathrooms })}</li>
      </ul>

      <BookingWidget propertyId={property.id} />
    </Shell>
  );
}
