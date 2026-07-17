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

const WHATSAPP = "+20 155 605 5957";

function PrivacyEN() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy">
      <LegalMeta>Last updated: July 2026</LegalMeta>

      <LegalH2>1. Overview</LegalH2>
      <LegalP>
        Sunny Stays Hurghada is a privately operated vacation rental hosted by
        Wafaa Belaid in Hurghada, Egypt. This policy explains which personal
        data is collected when you visit this website or get in touch, how it
        is used, and which rights you have.
      </LegalP>

      <LegalH2>2. Responsible person</LegalH2>
      <LegalP>
        Wafaa Belaid — Sunny Stays Hurghada<br />
        Hurghada, Red Sea Governorate, Egypt<br />
        Email: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>
      </LegalP>

      <LegalH2>3. Data we collect</LegalH2>
      <LegalList>
        <li><strong>Email contact:</strong> if you email us, we receive your email address and the content of your message.</li>
        <li><strong>WhatsApp contact:</strong> if you message us on WhatsApp ({WHATSAPP}), your phone number and messages are processed by WhatsApp under its own privacy policy.</li>
        <li><strong>Booking enquiries:</strong> name, email, optional phone number, stay dates, number of guests and any message you send.</li>
        <li><strong>Technical data:</strong> IP address, browser type, language and timestamps, collected automatically by our hosting provider for security and stability.</li>
      </LegalList>

      <LegalH2>4. Third-party services</LegalH2>
      <LegalList>
        <li><strong>Google Maps:</strong> the location section embeds Google Maps (Google Ireland Ltd.). When it loads, Google may process your IP address and device data.</li>
        <li><strong>Weather API:</strong> live weather in Hurghada is fetched from a third-party weather provider. Only technical request data (no personal data from you) is transmitted.</li>
        <li><strong>Airbnb booking links:</strong> the site links to Airbnb listings. When you follow such a link, Airbnb’s privacy policy applies to any data you provide there.</li>
      </LegalList>

      <LegalH2>5. Language preference</LegalH2>
      <LegalP>
        The website remembers your chosen display language using a small entry
        in your browser’s local storage. This is stored only on your device
        and is not shared with us or third parties.
      </LegalP>

      <LegalH2>6. Cookies &amp; analytics</LegalH2>
      <LegalP>
        This website does not use tracking cookies, advertising cookies or
        third-party analytics. Only technically necessary browser storage (for
        example, the language preference above) is used.
      </LegalP>

      <LegalH2>7. Purpose of processing</LegalH2>
      <LegalList>
        <li>Answering enquiries and preparing a stay.</li>
        <li>Operating the website securely and reliably.</li>
        <li>Fulfilling applicable legal obligations.</li>
      </LegalList>

      <LegalH2>8. Retention</LegalH2>
      <LegalP>
        Enquiries are kept for as long as needed to answer them and to comply
        with applicable retention rules. You may request earlier deletion at
        any time.
      </LegalP>

      <LegalH2>9. Your rights</LegalH2>
      <LegalP>
        You may request access to, correction of, or deletion of your personal
        data by contacting us at{" "}
        <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>

      <LegalH2>10. Where the website is operated from</LegalH2>
      <LegalP>
        This website is operated from Hurghada, Egypt.
      </LegalP>

      <LegalH2>11. Changes</LegalH2>
      <LegalP>
        This policy may be updated to reflect changes in the services offered
        or the applicable law. The current version is always available on this
        page.
      </LegalP>
    </LegalPage>
  );
}

function PrivacyDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Datenschutzerklärung">
      <LegalMeta>Stand: Juli 2026</LegalMeta>

      <LegalH2>1. Überblick</LegalH2>
      <LegalP>
        Sunny Stays Hurghada ist eine privat betriebene Ferienwohnung, die von
        Wafaa Belaid in Hurghada, Ägypten, vermietet wird. Diese Erklärung
        informiert darüber, welche personenbezogenen Daten beim Besuch der
        Website oder bei einer Kontaktaufnahme erhoben werden, wie sie
        verwendet werden und welche Rechte Ihnen zustehen.
      </LegalP>

      <LegalH2>2. Verantwortliche Person</LegalH2>
      <LegalP>
        Wafaa Belaid — Sunny Stays Hurghada<br />
        Hurghada, Gouvernement Rotes Meer, Ägypten<br />
        E-Mail: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>
      </LegalP>

      <LegalH2>3. Erhobene Daten</LegalH2>
      <LegalList>
        <li><strong>E-Mail-Kontakt:</strong> Bei einer E-Mail an uns erhalten wir Ihre E-Mail-Adresse und den Inhalt Ihrer Nachricht.</li>
        <li><strong>WhatsApp-Kontakt:</strong> Bei Nachrichten über WhatsApp ({WHATSAPP}) werden Ihre Telefonnummer und Nachrichten durch WhatsApp gemäß dessen eigener Datenschutzerklärung verarbeitet.</li>
        <li><strong>Buchungsanfragen:</strong> Name, E-Mail, optionale Telefonnummer, Aufenthaltsdaten, Personenzahl und Ihre Nachricht.</li>
        <li><strong>Technische Daten:</strong> IP-Adresse, Browsertyp, Sprache und Zeitstempel, die unser Hosting-Anbieter aus Sicherheits- und Stabilitätsgründen automatisch erhebt.</li>
      </LegalList>

      <LegalH2>4. Drittdienste</LegalH2>
      <LegalList>
        <li><strong>Google Maps:</strong> Im Standort-Bereich wird Google Maps (Google Ireland Ltd.) eingebunden. Dabei kann Google Ihre IP-Adresse und Gerätedaten verarbeiten.</li>
        <li><strong>Wetter-API:</strong> Aktuelle Wetterdaten für Hurghada werden von einem externen Wetterdienst geladen. Dabei werden nur technische Anfragen, jedoch keine personenbezogenen Daten von Ihnen übertragen.</li>
        <li><strong>Airbnb-Buchungslinks:</strong> Die Website verlinkt auf Airbnb-Inserate. Wenn Sie einem solchen Link folgen, gilt die Datenschutzerklärung von Airbnb.</li>
      </LegalList>

      <LegalH2>5. Spracheinstellung</LegalH2>
      <LegalP>
        Die Website merkt sich Ihre gewählte Anzeigesprache über einen kleinen
        Eintrag im lokalen Speicher Ihres Browsers. Dieser Eintrag verbleibt
        auf Ihrem Gerät und wird nicht an uns oder Dritte übertragen.
      </LegalP>

      <LegalH2>6. Cookies &amp; Analyse</LegalH2>
      <LegalP>
        Diese Website verwendet keine Tracking- oder Werbe-Cookies und keine
        externen Analysedienste. Es kommt ausschließlich technisch notwendiger
        Browserspeicher zum Einsatz (z. B. für die Spracheinstellung).
      </LegalP>

      <LegalH2>7. Zwecke der Verarbeitung</LegalH2>
      <LegalList>
        <li>Beantwortung von Anfragen und Vorbereitung eines Aufenthalts.</li>
        <li>Sicherer und zuverlässiger Betrieb der Website.</li>
        <li>Erfüllung gesetzlicher Pflichten, soweit anwendbar.</li>
      </LegalList>

      <LegalH2>8. Speicherdauer</LegalH2>
      <LegalP>
        Anfragen werden so lange gespeichert, wie es zur Beantwortung
        erforderlich ist und geltende Aufbewahrungspflichten es verlangen. Sie
        können jederzeit eine frühere Löschung verlangen.
      </LegalP>

      <LegalH2>9. Ihre Rechte</LegalH2>
      <LegalP>
        Sie können Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen
        Daten verlangen. Kontakt:{" "}
        <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>

      <LegalH2>10. Betriebsort der Website</LegalH2>
      <LegalP>
        Diese Website wird aus Hurghada, Ägypten, betrieben.
      </LegalP>

      <LegalH2>11. Änderungen</LegalH2>
      <LegalP>
        Diese Erklärung kann angepasst werden, um Änderungen der angebotenen
        Leistungen oder der Rechtslage abzubilden. Die aktuelle Fassung ist
        stets auf dieser Seite verfügbar.
      </LegalP>
    </LegalPage>
  );
}
