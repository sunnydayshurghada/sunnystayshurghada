import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/i18n/config";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = current.code;
    document.documentElement.dir = current.dir;
  }, [current]);

  const choose = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 text-sm font-medium border border-forest/20 px-3 py-1.5 rounded-full hover:border-forest transition-colors"
        aria-label={t("language")}
      >
        <span className="uppercase">{current.code}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-44 bg-card shadow-xl rounded-lg border border-forest/10 p-2 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onMouseDown={() => choose(lang.code)}
              className={`w-full text-start px-3 py-2 hover:bg-sand rounded text-sm ${
                lang.code === current.code ? "font-bold text-forest" : "text-forest/70"
              }`}
              dir={lang.dir}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
