import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  LegalPage,
  LegalH2,
  LegalP,
  HostInfoCard,
  EmailContactCard,
  WhatsAppContactCard,
} from "@/components/LegalPage";
import { isLegalLang, type LegalLang } from "@/lib/legal-lang";


export const Route = createFileRoute("/$lang/imprint")({
  beforeLoad: ({ params }) => {
    if (!isLegalLang(params.lang)) throw notFound();
  },
  head: ({ params }) => {
    const meta = META[params.lang as LegalLang] ?? META.en;
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.desc },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ImprintPage,
});

const META = {
  de: {
    title: "Impressum — Sunny Stays Hurghada",
    desc: "Rechtliche Angaben zum privaten Vermieter von Sunny Stays Hurghada.",
  },
  en: {
    title: "Legal Notice — Sunny Stays Hurghada",
    desc: "Legal notice for the private host of Sunny Stays Hurghada.",
  },
} as const;

function ImprintPage() {
  const { lang } = Route.useParams();
  return lang === "de" ? <ImprintDE /> : <ImprintEN />;
}

function ImprintEN() {
  return (
    <LegalPage eyebrow="Legal" title="Legal Notice">
      <LegalH2>Host</LegalH2>
      <HostInfoCard>
        <p className="font-display text-2xl md:text-3xl text-navy mb-2">
          Sunny Stays Hurghada
        </p>
        <p className="text-[11px] uppercase tracking-[0.25em] text-gold font-semibold mb-6">
          Private Vacation Rental
        </p>
        <div className="space-y-1 text-[15px] md:text-base leading-[1.8] text-navy/80 font-light">
          <p className="text-navy/50 text-sm mb-2">Hosted by</p>
          <p className="font-medium text-navy text-lg">Wafaa Belaid</p>
          <p>Hurghada</p>
          <p>Red Sea Governorate</p>
          <p>Egypt</p>
        </div>
      </HostInfoCard>

      <LegalH2>Contact</LegalH2>
      <div className="grid sm:grid-cols-2 gap-5">
        <EmailContactCard label="Email" />
        <WhatsAppContactCard label="WhatsApp" />
      </div>

      <LegalH2>About this website</LegalH2>
      <LegalP>
        Sunny Stays Hurghada is a privately operated vacation rental hosted by
        Wafaa Belaid in Hurghada, Egypt. This website provides information about
        the apartment, availability, booking options and guest services. It is
        not operated by a company.
      </LegalP>

      <LegalH2>Responsible for content</LegalH2>
      <LegalP>Wafaa Belaid (address as above).</LegalP>

      <LegalH2>Liability for content</LegalH2>
      <LegalP>
        The content of this website has been created with the greatest possible
        care. However, no guarantee is given for its accuracy, completeness or
        timeliness.
      </LegalP>

      <LegalH2>Liability for links</LegalH2>
      <LegalP>
        This website contains links to external websites of third parties, on
        whose contents we have no influence. No liability is assumed for such
        external content; responsibility lies with the respective provider.
      </LegalP>

      <LegalH2>Copyright</LegalH2>
      <LegalP>
        All photography, text and design elements on this website are protected
        by copyright. Any reproduction, distribution or use outside the limits
        of copyright law requires prior written consent.
      </LegalP>
    </LegalPage>
  );
}


function ImprintDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Impressum">
      <LegalH2>Gastgeberin</LegalH2>
      <HostInfoCard>
        <p className="font-display text-2xl md:text-3xl text-navy mb-2">
          Sunny Stays Hurghada
        </p>
        <p className="text-[11px] uppercase tracking-[0.25em] text-gold font-semibold mb-6">
          Private Ferienwohnung
        </p>
        <div className="space-y-1 text-[15px] md:text-base leading-[1.8] text-navy/80 font-light">
          <p className="text-navy/50 text-sm mb-2">Gastgeberin</p>
          <p className="font-medium text-navy text-lg">Wafaa Belaid</p>
          <p>Hurghada</p>
          <p>Gouvernement Rotes Meer</p>
          <p>Ägypten</p>
        </div>
      </HostInfoCard>

      <LegalH2>Kontakt</LegalH2>
      <div className="grid sm:grid-cols-2 gap-5">
        <EmailContactCard label="E-Mail" />
        <WhatsAppContactCard label="WhatsApp" />
      </div>

      <LegalH2>Über diese Website</LegalH2>
      <LegalP>
        Sunny Stays Hurghada ist eine privat betriebene Ferienwohnung, die von
        Wafaa Belaid in Hurghada, Ägypten, vermietet wird. Diese Website
        informiert über die Wohnung, Verfügbarkeiten, Buchungsmöglichkeiten und
        Gäste-Services. Es handelt sich nicht um ein Unternehmen.
      </LegalP>

      <LegalH2>Verantwortlich für den Inhalt</LegalH2>
      <LegalP>Wafaa Belaid (Anschrift wie oben).</LegalP>

      <LegalH2>Haftung für Inhalte</LegalH2>
      <LegalP>
        Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
        Für Richtigkeit, Vollständigkeit und Aktualität kann jedoch keine Gewähr
        übernommen werden.
      </LegalP>

      <LegalH2>Haftung für Links</LegalH2>
      <LegalP>
        Diese Website enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte wird keine
        Haftung übernommen; verantwortlich ist stets der jeweilige Anbieter.
      </LegalP>

      <LegalH2>Urheberrecht</LegalH2>
      <LegalP>
        Alle auf dieser Website veröffentlichten Fotos, Texte und
        Gestaltungselemente sind urheberrechtlich geschützt. Jede
        Vervielfältigung, Verbreitung oder Nutzung außerhalb der Grenzen des
        Urheberrechts bedarf der vorherigen schriftlichen Zustimmung.
      </LegalP>
    </LegalPage>
  );
}

