import { HOST_EMAIL } from "@/lib/airbnb";

/** Sample placeholder values for template preview and test emails. */
export function sampleVars(
  property: Record<string, any> | null,
  language: string,
): Record<string, string> {
  const currency = property?.currency ?? "EUR";
  const fmt = (cents: number) => {
    try {
      return new Intl.NumberFormat(language === "ar" ? "ar-EG" : language, {
        style: "currency",
        currency,
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`;
    }
  };
  return {
    property_name: property?.public_name ?? "Sunny Stays Hurghada",
    booking_number: "SS-2026-01042",
    guest_name: language === "ar" ? "سارة" : "Jana Muster",
    checkin: "2026-10-12",
    checkout: "2026-10-19",
    checkin_time: (property?.check_in_time ?? "14:00:00").slice(0, 5),
    checkout_time: (property?.check_out_time ?? "11:00:00").slice(0, 5),
    guests: "2",
    nights: "7",
    nightly_total: fmt(14000),
    cleaning_fee: fmt(2500),
    discount: fmt(0),
    total_amount: fmt(16500),
    amount_paid: fmt(5000),
    amount_due: fmt(11500),
    payment_method: "card",
    booking_status: "confirmed",
    address: property?.address ?? "Hurghada, Red Sea, Egypt",
    arrival_instructions:
      property?.arrival_instructions ?? "Schlüsselübergabe vor Ort durch unser Team.",
    house_rules: property?.house_rules ?? "Nichtraucher-Wohnung, keine Partys.",
    host_contact: property?.host_contact ?? HOST_EMAIL,
    signature: property?.email_signature ?? "Wafaa & Alex\nSunny Stays Hurghada",
  };
}
