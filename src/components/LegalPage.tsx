import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";
import { AIRBNB_LISTING_URL, HOST_EMAIL, WHATSAPP_URL } from "@/lib/airbnb";
import { resolveLegalLang } from "@/lib/legal-lang";
import type { ReactNode, ComponentType, SVGProps } from "react";


export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const legalLang = resolveLegalLang(i18n.language);

  return (
    <div className="min-h-screen flex flex-col bg-paper text-navy">
      {/* Minimal header */}
      <header className="border-b border-navy/10">
        <div className="max-w-5xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Sunny Stays Hurghada"
              className="h-10 md:h-12 w-auto select-none"
              draggable={false}
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm tracking-wide text-navy/70 hover:text-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>{t("legal.back", { defaultValue: "Back to home" })}</span>
          </Link>
        </div>
      </header>

      {/* Hero band */}
      <section className="bg-sand">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <p className="text-[11px] uppercase tracking-[0.35em] text-gold font-medium mb-5">
            {eyebrow}
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-navy">
            {title}
          </h1>
          <div className="mt-8 h-px w-16 bg-gold/70" />
        </div>
      </section>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 md:px-8 py-16 md:py-24">
          <article className="legal-prose text-[15px] md:text-base leading-[1.75] text-navy/85 font-light">
            {children}
          </article>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="bg-forest text-paper">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-10 flex flex-col md:flex-row gap-6 items-center justify-between text-sm text-paper/70">
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            <Link to="/$lang/privacy" params={{ lang: legalLang }} className="hover:text-gold transition-colors">
              {t("footer.privacy", { defaultValue: "Privacy Policy" })}
            </Link>
            <Link to="/$lang/imprint" params={{ lang: legalLang }} className="hover:text-gold transition-colors">
              {t("footer.imprint", { defaultValue: "Legal Notice" })}
            </Link>
            <Link to="/$lang/terms" params={{ lang: legalLang }} className="hover:text-gold transition-colors">
              {t("footer.terms", { defaultValue: "Terms & Conditions" })}
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center text-paper/60">
            <a href={`mailto:${HOST_EMAIL}`} className="hover:text-gold transition-colors">
              {HOST_EMAIL}
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
              WhatsApp
            </a>
            <a href={AIRBNB_LISTING_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
              Airbnb
            </a>
          </div>
        </div>
        <div className="border-t border-paper/10 py-5 text-center text-xs text-paper/50 tracking-wide">
          © 2026 Sunny Stays Hurghada
        </div>
      </footer>
    </div>
  );
}

/* Shared prose styling helpers */
export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-2xl md:text-3xl text-navy mt-14 mb-5 first:mt-0">
      {children}
    </h2>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mb-5">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="mb-5 space-y-2 list-disc pl-6 marker:text-gold">{children}</ul>;
}

export function LegalMeta({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-navy/55 italic mb-10 tracking-wide">{children}</p>
  );
}

/* Elegant host info card */
export function HostInfoCard({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 md:p-10 rounded-3xl bg-sand/60 border border-navy/8 shadow-soft">
      {children}
    </div>
  );
}

/* Elegant contact card with icon */
export function ContactCard({
  href,
  icon: Icon,
  label,
  value,
  external = false,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-5 p-6 md:p-7 rounded-3xl bg-paper border border-navy/8 shadow-soft transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-luxe hover:border-gold/30"
    >
      <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center text-gold transition-transform duration-500 group-hover:scale-110">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.25em] text-navy/50 font-medium mb-1">
          {label}
        </p>
        <p className="text-navy font-medium text-base md:text-lg truncate group-hover:text-gold transition-colors">
          {value}
        </p>
      </div>
    </a>
  );
}

/* Pre-configured contact cards */
export function EmailContactCard({ label }: { label: string }) {
  return (
    <ContactCard
      href={`mailto:${HOST_EMAIL}`}
      icon={Mail}
      label={label}
      value={HOST_EMAIL}
    />
  );
}

export function WhatsAppContactCard({ label }: { label: string }) {
  return (
    <ContactCard
      href={WHATSAPP_URL}
      icon={MessageCircle}
      label={label}
      value="+20 155 605 5957"
      external
    />
  );
}

