import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import de from "./locales/de.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import nl from "./locales/nl.json";
import ar from "./locales/ar.json";
import arEG from "./locales/ar-EG.json";

export const LANGUAGES = [
  { code: "de", label: "Deutsch", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "nl", label: "Nederlands", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "ar-EG", label: "العربية (مصر)", dir: "rtl" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        de: { translation: de },
        en: { translation: en },
        ru: { translation: ru },
        nl: { translation: nl },
        ar: { translation: ar },
        "ar-EG": { translation: arEG },
      },
      fallbackLng: "de",
      supportedLngs: LANGUAGES.map((l) => l.code),
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
      },
    });
}

export default i18n;
