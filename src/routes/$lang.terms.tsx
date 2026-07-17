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
    desc: "Allgemeine Geschäftsbedingungen für Buchungen bei Sunny Stays Hurghada.",
  },
  en: {
    title: "Terms & Conditions — Sunny Stays Hurghada",
    desc: "The terms and conditions for bookings at Sunny Stays Hurghada.",
  },
} as const;

function TermsPage() {
  const { lang } = Route.useParams();
  return lang === "de" ? <TermsDE /> : <TermsEN />;
}

function TermsEN() {
  return (
    <LegalPage eyebrow="Legal" title="Terms & Conditions">
      <LegalMeta>Last updated: January 2026</LegalMeta>

      <LegalH2>1. Scope</LegalH2>
      <LegalP>
        These terms and conditions apply to all bookings and enquiries made
        directly with Sunny Stays Hurghada, whether via this website, WhatsApp
        or email. Bookings made through third-party platforms (e.g. Airbnb) are
        additionally governed by the terms of those platforms.
      </LegalP>

      <LegalH2>2. Booking &amp; contract</LegalH2>
      <LegalP>
        Enquiries submitted through the website are non-binding. A rental
        contract is only concluded once we confirm the booking in writing (email
        or messaging) and, where applicable, the agreed payment has been received.
      </LegalP>

      <LegalH2>3. Prices &amp; payment</LegalH2>
      <LegalP>
        Prices are shown per night and depend on the season, length of stay and
        number of guests. Any cleaning fees or deposits will be stated before
        the booking is confirmed.
      </LegalP>

      <LegalH2>4. Check-in &amp; check-out</LegalH2>
      <LegalList>
        <li>Check-in: from 2:00 PM local time.</li>
        <li>Check-out: by 11:00 AM local time.</li>
        <li>Earlier check-in or later check-out may be possible on request, subject to availability.</li>
      </LegalList>

      <LegalH2>5. Cancellation</LegalH2>
      <LegalP>
        Cancellation conditions will be communicated in the booking confirmation.
        For bookings made via Airbnb, the cancellation policy of that platform
        applies.
      </LegalP>

      <LegalH2>6. House rules</LegalH2>
      <LegalList>
        <li>Please treat the apartment and its furnishings with care.</li>
        <li>Smoking is not permitted inside the apartment.</li>
        <li>Loud noise between 10:00 PM and 8:00 AM is not allowed out of respect for neighbours.</li>
        <li>Parties and events are not permitted.</li>
      </LegalList>

      <LegalH2>7. Liability</LegalH2>
      <LegalP>
        Guests are liable for damage they cause during their stay. We are not
        liable for personal belongings left in the apartment or for interruptions
        of external services (e.g. water, electricity, internet) beyond our
        reasonable control.
      </LegalP>

      <LegalH2>8. Applicable law</LegalH2>
      <LegalP>
        These terms are governed by the laws of the location of the property,
        subject to mandatory consumer protection provisions in the guest’s
        country of residence.
      </LegalP>

      <LegalH2>9. Contact</LegalH2>
      <LegalP>
        For questions about these terms please contact us at{" "}
        <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>
    </LegalPage>
  );
}

function TermsDE() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen">
      <LegalMeta>Stand: Januar 2026</LegalMeta>

      <LegalH2>1. Geltungsbereich</LegalH2>
      <LegalP>
        Diese Allgemeinen Geschäftsbedingungen gelten für alle Buchungen und
        Anfragen, die direkt bei Sunny Stays Hurghada erfolgen — sei es über
        diese Website, WhatsApp oder E-Mail. Für Buchungen über Drittplattformen
        (z. B. Airbnb) gelten zusätzlich die Bedingungen der jeweiligen Plattform.
      </LegalP>

      <LegalH2>2. Buchung &amp; Vertrag</LegalH2>
      <LegalP>
        Anfragen über die Website sind unverbindlich. Ein Mietvertrag kommt erst
        mit unserer schriftlichen Bestätigung (per E-Mail oder Messenger) und —
        soweit vereinbart — mit Eingang der Zahlung zustande.
      </LegalP>

      <LegalH2>3. Preise &amp; Zahlung</LegalH2>
      <LegalP>
        Die Preise verstehen sich pro Nacht und richten sich nach Saison,
        Aufenthaltsdauer und Personenzahl. Etwaige Reinigungsgebühren oder
        Kautionen werden vor Buchungsbestätigung mitgeteilt.
      </LegalP>

      <LegalH2>4. Anreise &amp; Abreise</LegalH2>
      <LegalList>
        <li>Anreise: ab 14:00 Uhr Ortszeit.</li>
        <li>Abreise: bis 11:00 Uhr Ortszeit.</li>
        <li>Eine frühere Anreise oder spätere Abreise ist auf Anfrage und nach Verfügbarkeit möglich.</li>
      </LegalList>

      <LegalH2>5. Stornierung</LegalH2>
      <LegalP>
        Die Stornierungsbedingungen werden in der Buchungsbestätigung mitgeteilt.
        Für Buchungen über Airbnb gilt die dortige Stornierungsrichtlinie.
      </LegalP>

      <LegalH2>6. Hausordnung</LegalH2>
      <LegalList>
        <li>Bitte behandeln Sie die Wohnung und die Einrichtung sorgsam.</li>
        <li>Rauchen ist innerhalb der Wohnung nicht gestattet.</li>
        <li>Zwischen 22:00 und 08:00 Uhr bitten wir um Ruhe aus Rücksicht auf die Nachbarn.</li>
        <li>Partys und Veranstaltungen sind nicht erlaubt.</li>
      </LegalList>

      <LegalH2>7. Haftung</LegalH2>
      <LegalP>
        Gäste haften für Schäden, die sie während ihres Aufenthalts verursachen.
        Wir haften nicht für zurückgelassene persönliche Gegenstände oder für
        Unterbrechungen externer Versorgungsleistungen (z. B. Wasser, Strom,
        Internet), die außerhalb unseres Einflussbereichs liegen.
      </LegalP>

      <LegalH2>8. Anwendbares Recht</LegalH2>
      <LegalP>
        Es gilt das Recht des Belegenheitsortes der Immobilie, vorbehaltlich
        zwingender Verbraucherschutzvorschriften im Wohnsitzstaat des Gastes.
      </LegalP>

      <LegalH2>9. Kontakt</LegalH2>
      <LegalP>
        Fragen zu diesen Bedingungen richten Sie bitte an{" "}
        <a href={`mailto:${HOST_EMAIL}`} className="text-gold hover:underline">{HOST_EMAIL}</a>.
      </LegalP>
    </LegalPage>
  );
}
