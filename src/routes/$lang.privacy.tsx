import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalList, LegalMeta } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";
import { isLegalLang, type LegalLang } from "@/lib/legal-lang";

export const Route = createFileRoute("/$lang/privacy")({
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
  component: PrivacyPage,
});

const META = {
  de: {
    title: "Datenschutzerklärung — Sunny Stays Hurghada",
    desc: "Wie Sunny Stays Hurghada personenbezogene Daten erhebt, verwendet und schützt.",
  },
  en: {
    title: "Privacy Policy — Sunny Stays Hurghada",
    desc: "How Sunny Stays Hurghada collects, uses and protects your personal data.",
  },
} as const;

function PrivacyPage() {
  const { lang } = Route.useParams();
  return lang === "de" ? <PrivacyDE /> : <PrivacyEN />;
}

function PrivacyEN() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy">
      <LegalMeta>Last updated: January 2026</LegalMeta>

      <LegalH2>1. Overview</LegalH2>
      <LegalP>
        Sunny Stays Hurghada (“we”, “us”) respects your privacy. This policy explains
        which personal data we collect when you visit our website or send a booking
        enquiry, how we use it, and which rights you have under the EU General Data
        Protection Regulation (GDPR).
      </LegalP>

      <LegalH2>2. Controller</LegalH2>
      <LegalP>
        Wafaa Fraktion — Sunny Stays Hurghada<br />
        Email: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>
      </LegalP>

      <LegalH2>3. Data we collect</LegalH2>
      <LegalList>
        <li><strong>Booking enquiries:</strong> name, email address, phone number (optional), check-in / check-out dates, number of guests, and any message you send.</li>
        <li><strong>Technical data:</strong> IP address, browser type, language, and timestamps, collected automatically by our hosting provider for security and stability.</li>
        <li><strong>Third-party embeds:</strong> when you view the location section, Google Maps loads content from Google, which may process your IP address.</li>
      </LegalList>

      <LegalH2>4. Purpose &amp; legal basis</LegalH2>
      <LegalList>
        <li>Answering booking enquiries and preparing / performing a rental agreement — Art. 6 (1)(b) GDPR.</li>
        <li>Operating the website securely — Art. 6 (1)(f) GDPR (legitimate interest).</li>
        <li>Fulfilling legal obligations, e.g. tax retention — Art. 6 (1)(c) GDPR.</li>
      </LegalList>

      <LegalH2>5. Recipients &amp; processors</LegalH2>
      <LegalP>
        We use carefully selected service providers who process data on our behalf:
        our hosting and database provider, our email provider, and Google Maps
        (Google Ireland Ltd.) for the interactive map. We do not sell personal data.
      </LegalP>

      <LegalH2>6. Retention</LegalH2>
      <LegalP>
        Booking enquiries are stored for as long as needed to answer them and to
        fulfil legal retention periods (typically up to 10 years for tax-relevant
        documents under German law). You may request earlier deletion where no
        legal obligation applies.
      </LegalP>

      <LegalH2>7. Your rights</LegalH2>
      <LegalP>
        You have the right to access, rectify, delete, restrict or port your data,
        and to object to processing based on legitimate interest. You may also
        lodge a complaint with a supervisory authority. To exercise your rights,
        contact us at <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>

      <LegalH2>8. Cookies</LegalH2>
      <LegalP>
        This website does not use tracking or advertising cookies. Only strictly
        necessary storage is used to remember your language preference.
      </LegalP>

      <LegalH2>9. Changes</LegalH2>
      <LegalP>
        We may update this policy to reflect changes in our services or the law.
        The current version is always available on this page.
      </LegalP>
    </LegalPage>
  );
}

function PrivacyDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Datenschutzerklärung">
      <LegalMeta>Stand: Januar 2026</LegalMeta>

      <LegalH2>1. Überblick</LegalH2>
      <LegalP>
        Sunny Stays Hurghada („wir“) achtet Ihre Privatsphäre. Diese Erklärung
        informiert Sie darüber, welche personenbezogenen Daten wir erheben, wenn Sie
        unsere Website besuchen oder eine Buchungsanfrage senden, wie wir sie
        verwenden und welche Rechte Ihnen nach der EU-Datenschutz-Grundverordnung
        (DSGVO) zustehen.
      </LegalP>

      <LegalH2>2. Verantwortlicher</LegalH2>
      <LegalP>
        Wafaa Fraktion — Sunny Stays Hurghada<br />
        E-Mail: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>
      </LegalP>

      <LegalH2>3. Erhobene Daten</LegalH2>
      <LegalList>
        <li><strong>Buchungsanfragen:</strong> Name, E-Mail-Adresse, Telefonnummer (optional), An- und Abreisedatum, Anzahl der Gäste sowie Ihre Nachricht.</li>
        <li><strong>Technische Daten:</strong> IP-Adresse, Browsertyp, Sprache und Zeitstempel, die unser Hosting-Anbieter aus Sicherheits- und Stabilitätsgründen automatisch erhebt.</li>
        <li><strong>Eingebundene Drittdienste:</strong> Beim Aufruf des Standort-Bereichs lädt Google Maps Inhalte, wobei Google Ihre IP-Adresse verarbeiten kann.</li>
      </LegalList>

      <LegalH2>4. Zweck &amp; Rechtsgrundlage</LegalH2>
      <LegalList>
        <li>Beantwortung von Anfragen und Anbahnung/Durchführung des Mietvertrags — Art. 6 Abs. 1 lit. b DSGVO.</li>
        <li>Sicherer Betrieb der Website — Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).</li>
        <li>Erfüllung gesetzlicher Aufbewahrungspflichten — Art. 6 Abs. 1 lit. c DSGVO.</li>
      </LegalList>

      <LegalH2>5. Empfänger &amp; Auftragsverarbeiter</LegalH2>
      <LegalP>
        Wir nutzen sorgfältig ausgewählte Dienstleister, die Daten in unserem Auftrag
        verarbeiten: unseren Hosting- und Datenbankanbieter, unseren E-Mail-Anbieter
        sowie Google Maps (Google Ireland Ltd.) für die interaktive Karte. Wir
        verkaufen keine personenbezogenen Daten.
      </LegalP>

      <LegalH2>6. Speicherdauer</LegalH2>
      <LegalP>
        Anfragen speichern wir so lange, wie es zur Beantwortung erforderlich ist
        und gesetzliche Aufbewahrungsfristen (in der Regel bis zu 10 Jahre für
        steuerrelevante Unterlagen) es verlangen. Sie können eine frühere Löschung
        verlangen, sofern keine gesetzliche Pflicht entgegensteht.
      </LegalP>

      <LegalH2>7. Ihre Rechte</LegalH2>
      <LegalP>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und
        Datenübertragbarkeit sowie ein Widerspruchsrecht gegen die Verarbeitung auf
        Grundlage berechtigter Interessen. Zudem können Sie sich bei einer
        Aufsichtsbehörde beschweren. Kontakt:{" "}
        <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>

      <LegalH2>8. Cookies</LegalH2>
      <LegalP>
        Diese Website verwendet keine Tracking- oder Werbe-Cookies. Es wird nur ein
        technisch notwendiger Speicher verwendet, um Ihre Spracheinstellung zu
        merken.
      </LegalP>

      <LegalH2>9. Änderungen</LegalH2>
      <LegalP>
        Wir können diese Erklärung anpassen, um Änderungen unserer Dienste oder der
        Rechtslage abzubilden. Die jeweils aktuelle Fassung ist auf dieser Seite
        verfügbar.
      </LegalP>
    </LegalPage>
  );
}
