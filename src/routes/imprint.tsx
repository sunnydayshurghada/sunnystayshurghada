import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP } from "@/components/LegalPage";
import { HOST_EMAIL } from "@/lib/airbnb";

export const Route = createFileRoute("/imprint")({
  head: () => ({
    meta: [
      { title: "Legal Notice — Sunny Stays Hurghada" },
      { name: "description", content: "Legal notice and provider information for Sunny Stays Hurghada." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImprintPage,
});

function ImprintPage() {
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
        on these pages in accordance with the general laws. We are not obligated
        to monitor transmitted or stored third-party information.
      </LegalP>

      <LegalH2>Liability for links</LegalH2>
      <LegalP>
        Our website contains links to external websites of third parties, on
        whose contents we have no influence. Therefore, we cannot assume any
        liability for these external contents. The respective provider or
        operator of the linked pages is always responsible for their content.
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
