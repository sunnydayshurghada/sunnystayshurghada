/**
 * Central Sunny Stays default guest email templates.
 * Used whenever a property has no own template for a key/language.
 * Placeholders use {{variable}} and are replaced with plain text (never HTML).
 */

export const TEMPLATE_KEYS = [
  "inquiry_received",
  "reservation_confirmed",
  "booking_confirmed",
  "payment_confirmed",
  "inquiry_declined",
  "cancellation_confirmed",
  "booking_changed",
  "payment_reminder",
  "pre_arrival_info",
  "departure_info",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LANGUAGES = ["de", "en", "ar"] as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number];

/** Placeholders offered in the admin editor. */
export const TEMPLATE_VARIABLES = [
  "property_name",
  "booking_number",
  "guest_name",
  "checkin",
  "checkout",
  "checkin_time",
  "checkout_time",
  "guests",
  "nights",
  "nightly_total",
  "cleaning_fee",
  "discount",
  "total_amount",
  "amount_paid",
  "amount_due",
  "payment_method",
  "booking_status",
  "address",
  "arrival_instructions",
  "house_rules",
  "host_contact",
  "signature",
] as const;

interface Entry {
  subject: string;
  body: string;
}

const STAY_BLOCK_DE =
  "Wohnung: {{property_name}}\nBuchungsnummer: {{booking_number}}\nAnreise: {{checkin}} (ab {{checkin_time}})\nAbreise: {{checkout}} (bis {{checkout_time}})\nGäste: {{guests}} · Nächte: {{nights}}\nÜbernachtungen: {{nightly_total}}\nReinigungsgebühr: {{cleaning_fee}}\nRabatt: {{discount}}\nGesamtbetrag: {{total_amount}}";

const STAY_BLOCK_EN =
  "Apartment: {{property_name}}\nBooking number: {{booking_number}}\nCheck-in: {{checkin}} (from {{checkin_time}})\nCheck-out: {{checkout}} (until {{checkout_time}})\nGuests: {{guests}} · Nights: {{nights}}\nAccommodation: {{nightly_total}}\nCleaning fee: {{cleaning_fee}}\nDiscount: {{discount}}\nTotal: {{total_amount}}";

const STAY_BLOCK_AR =
  "الشقة: {{property_name}}\nرقم الحجز: {{booking_number}}\nالوصول: {{checkin}} (من {{checkin_time}})\nالمغادرة: {{checkout}} (حتى {{checkout_time}})\nالضيوف: {{guests}} · الليالي: {{nights}}\nقيمة الإقامة: {{nightly_total}}\nرسوم التنظيف: {{cleaning_fee}}\nالخصم: {{discount}}\nالإجمالي: {{total_amount}}";

export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  Record<TemplateLanguage, Entry>
> = {
  inquiry_received: {
    de: {
      subject: "Ihre Anfrage bei {{property_name}} ist angekommen",
      body: `Hallo {{guest_name}},

vielen Dank für Ihre Anfrage. Wir haben Ihre Anfrage erhalten. Dies ist noch keine verbindliche Buchungsbestätigung.

${STAY_BLOCK_DE}

Wir prüfen die Verfügbarkeit und melden uns persönlich bei Ihnen.

{{signature}}`,
    },
    en: {
      subject: "We received your enquiry for {{property_name}}",
      body: `Hello {{guest_name}},

thank you for your enquiry. We have received your request. This is not yet a binding booking confirmation.

${STAY_BLOCK_EN}

We will check availability and get back to you personally.

{{signature}}`,
    },
    ar: {
      subject: "استلمنا طلبك لـ {{property_name}}",
      body: `مرحباً {{guest_name}}،

شكراً لطلبك. لقد استلمنا طلبك. هذا ليس تأكيد حجز نهائي بعد.

${STAY_BLOCK_AR}

سنتحقق من التوفر ونتواصل معك شخصياً.

{{signature}}`,
    },
  },
  reservation_confirmed: {
    de: {
      subject: "Ihre Reservierung für {{property_name}} ist vorgemerkt",
      body: `Hallo {{guest_name}},

wir haben Ihre Reservierung vorgemerkt.

${STAY_BLOCK_DE}

Status: {{booking_status}}

{{signature}}`,
    },
    en: {
      subject: "Your reservation for {{property_name}} is held",
      body: `Hello {{guest_name}},

we have reserved these dates for you.

${STAY_BLOCK_EN}

Status: {{booking_status}}

{{signature}}`,
    },
    ar: {
      subject: "تم حجز موعدك مبدئياً في {{property_name}}",
      body: `مرحباً {{guest_name}}،

قمنا بحجز التواريخ لك مبدئياً.

${STAY_BLOCK_AR}

الحالة: {{booking_status}}

{{signature}}`,
    },
  },
  booking_confirmed: {
    de: {
      subject: "Verbindliche Buchungsbestätigung – {{property_name}}",
      body: `Hallo {{guest_name}},

Ihre Buchung ist jetzt verbindlich bestätigt.

${STAY_BLOCK_DE}
Bereits gezahlt: {{amount_paid}}
Noch offen: {{amount_due}}

Adresse: {{address}}
Anreisehinweise: {{arrival_instructions}}
Hausregeln: {{house_rules}}
Kontakt: {{host_contact}}

{{signature}}`,
    },
    en: {
      subject: "Booking confirmed – {{property_name}}",
      body: `Hello {{guest_name}},

your booking is now confirmed.

${STAY_BLOCK_EN}
Already paid: {{amount_paid}}
Outstanding: {{amount_due}}

Address: {{address}}
Arrival information: {{arrival_instructions}}
House rules: {{house_rules}}
Contact: {{host_contact}}

{{signature}}`,
    },
    ar: {
      subject: "تأكيد الحجز – {{property_name}}",
      body: `مرحباً {{guest_name}}،

تم تأكيد حجزك نهائياً.

${STAY_BLOCK_AR}
المدفوع: {{amount_paid}}
المتبقي: {{amount_due}}

العنوان: {{address}}
تعليمات الوصول: {{arrival_instructions}}
قواعد المنزل: {{house_rules}}
للتواصل: {{host_contact}}

{{signature}}`,
    },
  },
  payment_confirmed: {
    de: {
      subject: "Zahlungsbestätigung – {{booking_number}}",
      body: `Hallo {{guest_name}},

wir haben Ihre Zahlung erhalten.

Bezahlt: {{amount_paid}} ({{payment_method}})
Noch offen: {{amount_due}}
Gesamtbetrag: {{total_amount}}

${STAY_BLOCK_DE}

{{signature}}`,
    },
    en: {
      subject: "Payment received – {{booking_number}}",
      body: `Hello {{guest_name}},

we have received your payment.

Paid: {{amount_paid}} ({{payment_method}})
Outstanding: {{amount_due}}
Total: {{total_amount}}

${STAY_BLOCK_EN}

{{signature}}`,
    },
    ar: {
      subject: "تأكيد الدفع – {{booking_number}}",
      body: `مرحباً {{guest_name}}،

لقد استلمنا دفعتك.

المدفوع: {{amount_paid}} ({{payment_method}})
المتبقي: {{amount_due}}
الإجمالي: {{total_amount}}

${STAY_BLOCK_AR}

{{signature}}`,
    },
  },
  inquiry_declined: {
    de: {
      subject: "Ihre Anfrage für {{property_name}}",
      body: `Hallo {{guest_name}},

leider können wir Ihre Anfrage für {{checkin}} – {{checkout}} nicht bestätigen.

Gerne prüfen wir andere Termine für Sie.

{{signature}}`,
    },
    en: {
      subject: "Your enquiry for {{property_name}}",
      body: `Hello {{guest_name}},

unfortunately we cannot confirm your enquiry for {{checkin}} – {{checkout}}.

We are happy to look at other dates for you.

{{signature}}`,
    },
    ar: {
      subject: "طلبك لـ {{property_name}}",
      body: `مرحباً {{guest_name}}،

للأسف لا يمكننا تأكيد طلبك من {{checkin}} إلى {{checkout}}.

يسعدنا البحث عن تواريخ أخرى لك.

{{signature}}`,
    },
  },
  cancellation_confirmed: {
    de: {
      subject: "Stornierung bestätigt – {{booking_number}}",
      body: `Hallo {{guest_name}},

Ihre Buchung {{booking_number}} für {{property_name}} ({{checkin}} – {{checkout}}) wurde storniert.

{{signature}}`,
    },
    en: {
      subject: "Cancellation confirmed – {{booking_number}}",
      body: `Hello {{guest_name}},

your booking {{booking_number}} for {{property_name}} ({{checkin}} – {{checkout}}) has been cancelled.

{{signature}}`,
    },
    ar: {
      subject: "تأكيد الإلغاء – {{booking_number}}",
      body: `مرحباً {{guest_name}}،

تم إلغاء حجزك {{booking_number}} في {{property_name}} ({{checkin}} – {{checkout}}).

{{signature}}`,
    },
  },
  booking_changed: {
    de: {
      subject: "Ihre Buchung wurde geändert – {{booking_number}}",
      body: `Hallo {{guest_name}},

Ihre Buchung wurde angepasst. Hier der aktuelle Stand:

${STAY_BLOCK_DE}

{{signature}}`,
    },
    en: {
      subject: "Your booking was updated – {{booking_number}}",
      body: `Hello {{guest_name}},

your booking has been updated. Current details:

${STAY_BLOCK_EN}

{{signature}}`,
    },
    ar: {
      subject: "تم تعديل حجزك – {{booking_number}}",
      body: `مرحباً {{guest_name}}،

تم تعديل حجزك. التفاصيل الحالية:

${STAY_BLOCK_AR}

{{signature}}`,
    },
  },
  payment_reminder: {
    de: {
      subject: "Zahlungserinnerung – {{booking_number}}",
      body: `Hallo {{guest_name}},

für Ihre Buchung {{booking_number}} ({{property_name}}) ist noch ein Betrag von {{amount_due}} offen.

Gesamtbetrag: {{total_amount}}
Bereits gezahlt: {{amount_paid}}

{{signature}}`,
    },
    en: {
      subject: "Payment reminder – {{booking_number}}",
      body: `Hello {{guest_name}},

an amount of {{amount_due}} is still outstanding for your booking {{booking_number}} ({{property_name}}).

Total: {{total_amount}}
Already paid: {{amount_paid}}

{{signature}}`,
    },
    ar: {
      subject: "تذكير بالدفع – {{booking_number}}",
      body: `مرحباً {{guest_name}}،

ما زال مبلغ {{amount_due}} مستحقاً لحجزك {{booking_number}} ({{property_name}}).

الإجمالي: {{total_amount}}
المدفوع: {{amount_paid}}

{{signature}}`,
    },
  },
  pre_arrival_info: {
    de: {
      subject: "Ihre Anreise zu {{property_name}}",
      body: `Hallo {{guest_name}},

wir freuen uns auf Sie am {{checkin}} ab {{checkin_time}}.

Adresse: {{address}}
Anreisehinweise: {{arrival_instructions}}
Hausregeln: {{house_rules}}
Kontakt: {{host_contact}}

{{signature}}`,
    },
    en: {
      subject: "Your arrival at {{property_name}}",
      body: `Hello {{guest_name}},

we look forward to welcoming you on {{checkin}} from {{checkin_time}}.

Address: {{address}}
Arrival information: {{arrival_instructions}}
House rules: {{house_rules}}
Contact: {{host_contact}}

{{signature}}`,
    },
    ar: {
      subject: "وصولك إلى {{property_name}}",
      body: `مرحباً {{guest_name}}،

نتطلع لاستقبالك في {{checkin}} من {{checkin_time}}.

العنوان: {{address}}
تعليمات الوصول: {{arrival_instructions}}
قواعد المنزل: {{house_rules}}
للتواصل: {{host_contact}}

{{signature}}`,
    },
  },
  departure_info: {
    de: {
      subject: "Ihre Abreise aus {{property_name}}",
      body: `Hallo {{guest_name}},

Ihre Abreise ist am {{checkout}} bis {{checkout_time}}.

{{house_rules}}

Danke für Ihren Aufenthalt – wir würden uns freuen, Sie wiederzusehen.

{{signature}}`,
    },
    en: {
      subject: "Your departure from {{property_name}}",
      body: `Hello {{guest_name}},

your check-out is on {{checkout}} until {{checkout_time}}.

{{house_rules}}

Thank you for staying with us — we would love to welcome you again.

{{signature}}`,
    },
    ar: {
      subject: "مغادرتك من {{property_name}}",
      body: `مرحباً {{guest_name}}،

موعد مغادرتك {{checkout}} حتى {{checkout_time}}.

{{house_rules}}

شكراً لإقامتك معنا — يسعدنا استقبالك مرة أخرى.

{{signature}}`,
    },
  },
};

export function defaultTemplate(key: TemplateKey, language: string): Entry {
  const lang = (
    TEMPLATE_LANGUAGES.includes(language as TemplateLanguage) ? language : "de"
  ) as TemplateLanguage;
  return DEFAULT_TEMPLATES[key][lang];
}
