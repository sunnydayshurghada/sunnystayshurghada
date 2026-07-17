import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalList, LegalMeta } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";
import { isLegalLang, type LegalLang } from "@/lib/legal-lang";

export const Route = createFileRoute("/$lang/terms")({
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
  component: TermsPage,
});

const META = {
  de: {
    title: "AGB — Sunny Stays Hurghada",
    desc: "Bedingungen für Buchungsanfragen und Aufenthalte bei Sunny Stays Hurghada.",
  },
  en: {
    title: "Terms & Conditions — Sunny Stays Hurghada",
    desc: "Terms for booking requests and stays at Sunny Stays Hurghada.",
  },
} as const;

const WHATSAPP = "+20 155 605 5957";

function TermsPage() {
  const { lang } = Route.useParams();
  return lang === "de" ? <TermsDE /> : <TermsEN />;
}

function TermsEN() {
  return (
    <LegalPage eyebrow="Legal" title="Terms & Conditions">
      <LegalMeta>Last updated: July 2026</LegalMeta>

      <LegalH2>1. Scope</LegalH2>
      <LegalP>
        Sunny Stays Hurghada is a private vacation rental hosted by Wafaa
        Belaid in Hurghada, Egypt. These terms apply to all enquiries and stays
        arranged directly with the host, whether through this website, email
        or WhatsApp. Bookings made through Airbnb are additionally subject to
        Airbnb’s own terms.
      </LegalP>

      <LegalH2>2. Booking requests</LegalH2>
      <LegalP>
        Enquiries submitted through the website, email or WhatsApp are
        non-binding. A stay is only confirmed once the host has replied in
        writing (email or messaging) with an explicit confirmation.
      </LegalP>

      <LegalH2>3. Availability</LegalH2>
      <LegalP>
        Availability shown on the website is indicative and can change at any
        time, in particular due to parallel enquiries or existing bookings on
        Airbnb. The host reserves the right to decline a booking request.
      </LegalP>

      <LegalH2>4. Prices</LegalH2>
      <LegalP>
        Prices shown on this website (for example the “from” nightly rate) are
        indicative and may change at any time without prior notice, depending
        on season, length of stay and number of guests. The price applicable
        to your stay is the one stated in the written confirmation.
      </LegalP>

      <LegalH2>5. Payment</LegalH2>
      <LegalP>
        Unless otherwise agreed in writing, payments are handled through
        Airbnb according to Airbnb’s payment and cancellation rules. For direct
        bookings, the payment method and timing will be stated in the written
        confirmation.
      </LegalP>

      <LegalH2>6. Check-in &amp; check-out</LegalH2>
      <LegalList>
        <li>Check-in: from 2:00 PM local time.</li>
        <li>Check-out: by 11:00 AM local time.</li>
        <li>Earlier check-in or later check-out may be possible on request and subject to availability.</li>
      </LegalList>

      <LegalH2>7. House rules</LegalH2>
      <LegalList>
        <li>Please treat the apartment and its furnishings with care.</li>
        <li>Smoking is not permitted inside the apartment.</li>
        <li>Please be considerate of neighbours; quiet hours apply between 10:00 PM and 8:00 AM.</li>
        <li>Parties and events are not permitted.</li>
        <li>Only the guests stated in the booking may stay in the apartment.</li>
      </LegalList>

      <LegalH2>8. Liability</LegalH2>
      <LegalP>
        Guests are liable for damage they cause during their stay. To the
        extent permitted by law, the host is not liable for personal
        belongings left in the apartment, for interruptions of external
        services (water, electricity, internet) outside the host’s reasonable
        control, or for indirect or consequential damages.
      </LegalP>

      <LegalH2>9. Contact</LegalH2>
      <LegalP>
        Wafaa Belaid — Sunny Stays Hurghada, Hurghada, Egypt.<br />
        Email: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a><br />
        WhatsApp: <span dir="ltr">{WHATSAPP}</span>
      </LegalP>
    </LegalPage>
  );
}

function TermsDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen">
      <LegalMeta>Stand: Juli 2026</LegalMeta>

      <LegalH2>1. Geltungsbereich</LegalH2>
      <LegalP>
        Sunny Stays Hurghada ist eine private Ferienwohnung, die von Wafaa
        Belaid in Hurghada, Ägypten, vermietet wird. Diese Bedingungen gelten
        für alle Anfragen und Aufenthalte, die direkt mit der Gastgeberin
        vereinbart werden — sei es über diese Website, per E-Mail oder
        WhatsApp. Für Buchungen über Airbnb gelten zusätzlich die Bedingungen
        von Airbnb.
      </LegalP>

      <LegalH2>2. Buchungsanfragen</LegalH2>
      <LegalP>
        Anfragen über die Website, per E-Mail oder WhatsApp sind unverbindlich.
        Ein Aufenthalt ist erst bestätigt, sobald die Gastgeberin diesen
        schriftlich (per E-Mail oder Messenger) ausdrücklich bestätigt hat.
      </LegalP>

      <LegalH2>3. Verfügbarkeit</LegalH2>
      <LegalP>
        Die auf der Website angezeigte Verfügbarkeit ist unverbindlich und kann
        sich jederzeit ändern, insbesondere durch parallele Anfragen oder
        bestehende Buchungen über Airbnb. Die Gastgeberin behält sich vor,
        Buchungsanfragen abzulehnen.
      </LegalP>

      <LegalH2>4. Preise</LegalH2>
      <LegalP>
        Die auf dieser Website angezeigten Preise (z. B. „ab“-Nachtpreis) sind
        unverbindliche Richtwerte und können sich jederzeit ohne vorherige
        Ankündigung ändern, abhängig von Saison, Aufenthaltsdauer und
        Personenzahl. Maßgeblich ist der in der schriftlichen Bestätigung
        genannte Preis.
      </LegalP>

      <LegalH2>5. Zahlung</LegalH2>
      <LegalP>
        Soweit nicht ausdrücklich anders vereinbart, erfolgt die Zahlung über
        Airbnb nach den dortigen Zahlungs- und Stornierungsbedingungen. Bei
        Direktbuchungen werden Zahlungsweg und -zeitpunkt in der schriftlichen
        Bestätigung mitgeteilt.
      </LegalP>

      <LegalH2>6. Anreise &amp; Abreise</LegalH2>
      <LegalList>
        <li>Anreise: ab 14:00 Uhr Ortszeit.</li>
        <li>Abreise: bis 11:00 Uhr Ortszeit.</li>
        <li>Frühere Anreise oder spätere Abreise ist auf Anfrage und nach Verfügbarkeit möglich.</li>
      </LegalList>

      <LegalH2>7. Hausordnung</LegalH2>
      <LegalList>
        <li>Bitte behandeln Sie die Wohnung und die Einrichtung sorgsam.</li>
        <li>Rauchen ist innerhalb der Wohnung nicht gestattet.</li>
        <li>Bitte nehmen Sie Rücksicht auf die Nachbarn; Ruhezeiten gelten von 22:00 bis 08:00 Uhr.</li>
        <li>Partys und Veranstaltungen sind nicht erlaubt.</li>
        <li>Nur die in der Buchung genannten Gäste dürfen die Wohnung nutzen.</li>
      </LegalList>

      <LegalH2>8. Haftung</LegalH2>
      <LegalP>
        Gäste haften für Schäden, die sie während ihres Aufenthalts
        verursachen. Soweit gesetzlich zulässig, haftet die Gastgeberin nicht
        für zurückgelassene persönliche Gegenstände, für Unterbrechungen
        externer Versorgungsleistungen (Wasser, Strom, Internet) außerhalb
        ihres Einflussbereichs sowie für mittelbare oder Folgeschäden.
      </LegalP>

      <LegalH2>9. Kontakt</LegalH2>
      <LegalP>
        Wafaa Belaid — Sunny Stays Hurghada, Hurghada, Ägypten.<br />
        E-Mail: <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a><br />
        WhatsApp: <span dir="ltr">{WHATSAPP}</span>
      </LegalP>
    </LegalPage>
  );
}
