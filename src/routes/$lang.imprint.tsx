import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";
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
    desc: "Anbieterkennzeichnung und rechtliche Angaben für Sunny Stays Hurghada.",
  },
  en: {
    title: "Legal Notice — Sunny Stays Hurghada",
    desc: "Legal notice and provider information for Sunny Stays Hurghada.",
  },
} as const;

function ImprintPage() {
  const { lang } = Route.useParams();
  return lang === "de" ? <ImprintDE /> : <ImprintEN />;
}

function ImprintEN() {
  return (
    <LegalPage eyebrow="Legal" title="Legal Notice">
      <LegalH2>Provider</LegalH2>
      <LegalP>
        Sunny Stays Hurghada<br />
        Wafaa Fraktion<br />
        Hurghada, Red Sea Governorate, Egypt
      </LegalP>

      <LegalH2>Contact</LegalH2>
      <LegalP>
        Email: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a><br />
        WhatsApp: +20 155 605 5957
      </LegalP>

      <LegalH2>Responsible for content</LegalH2>
      <LegalP>Wafaa Fraktion (address as above).</LegalP>

      <LegalH2>Liability for content</LegalH2>
      <LegalP>
        The content of this website has been created with the greatest possible
        care. However, we cannot guarantee its accuracy, completeness or
        timeliness. As a service provider, we are responsible for our own content
        on these pages in accordance with the general laws.
      </LegalP>

      <LegalH2>Liability for links</LegalH2>
      <LegalP>
        Our website contains links to external websites of third parties, on
        whose contents we have no influence. Therefore, we cannot assume any
        liability for these external contents.
      </LegalP>

      <LegalH2>Copyright</LegalH2>
      <LegalP>
        All photography, text and design elements on this website are protected
        by copyright. Any reproduction, distribution or use outside the limits
        of copyright law requires our prior written consent.
      </LegalP>

      <LegalH2>Dispute resolution</LegalH2>
      <LegalP>
        The European Commission provides a platform for online dispute resolution
        at{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
          ec.europa.eu/consumers/odr
        </a>
        . We are not obliged and not willing to participate in dispute resolution
        procedures before a consumer arbitration board.
      </LegalP>
    </LegalPage>
  );
}

function ImprintDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Impressum">
      <LegalH2>Anbieter</LegalH2>
      <LegalP>
        Sunny Stays Hurghada<br />
        Wafaa Fraktion<br />
        Hurghada, Gouvernement Rotes Meer, Ägypten
      </LegalP>

      <LegalH2>Kontakt</LegalH2>
      <LegalP>
        E-Mail: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a><br />
        WhatsApp: +20 155 605 5957
      </LegalP>

      <LegalH2>Verantwortlich für den Inhalt</LegalH2>
      <LegalP>Wafaa Fraktion (Anschrift wie oben).</LegalP>

      <LegalH2>Haftung für Inhalte</LegalH2>
      <LegalP>
        Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt. Für
        die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir
        jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir für eigene
        Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
      </LegalP>

      <LegalH2>Haftung für Links</LegalH2>
      <LegalP>
        Unsere Website enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir
        daher keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
        stets der jeweilige Anbieter oder Betreiber verantwortlich.
      </LegalP>

      <LegalH2>Urheberrecht</LegalH2>
      <LegalP>
        Alle auf dieser Website veröffentlichten Fotos, Texte und
        Gestaltungselemente sind urheberrechtlich geschützt. Jede Vervielfältigung,
        Verbreitung oder Nutzung außerhalb der Grenzen des Urheberrechts bedarf
        unserer vorherigen schriftlichen Zustimmung.
      </LegalP>

      <LegalH2>Streitschlichtung</LegalH2>
      <LegalP>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung bereit:{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
          ec.europa.eu/consumers/odr
        </a>
        . Wir sind nicht verpflichtet und nicht bereit, an
        Streitbeilegungsverfahren vor einer Verbraucher­schlichtungsstelle
        teilzunehmen.
      </LegalP>
    </LegalPage>
  );
}
