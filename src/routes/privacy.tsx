import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalList, LegalMeta } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sunny Stays Hurghada" },
      { name: "description", content: "How Sunny Stays Hurghada collects, uses and protects your personal data." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
