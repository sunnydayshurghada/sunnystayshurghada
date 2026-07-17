import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalList, LegalMeta } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Sunny Stays Hurghada" },
      { name: "description", content: "The terms and conditions for bookings at Sunny Stays Hurghada." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
