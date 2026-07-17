// Maps the current i18n language to the legal-page language.
// German UI → German legal pages. Everything else falls back to English
// until translated versions are provided. Add more locales here later
// without touching the footer or route components.
export type LegalLang = "de" | "en";

export const SUPPORTED_LEGAL_LANGS: LegalLang[] = ["de", "en"];

export function resolveLegalLang(uiLang: string | undefined | null): LegalLang {
  if (!uiLang) return "en";
  const base = uiLang.toLowerCase().split("-")[0];
  if (base === "de") return "de";
  // Extend here (e.g. `if (base === "nl") return "nl";`) once content exists.
  return "en";
}

export function isLegalLang(value: string): value is LegalLang {
  return (SUPPORTED_LEGAL_LANGS as string[]).includes(value);
}
