## Klimaanlage-Feature-Text anpassen

**Ziel**
Den bestehenden Feature-Eintrag „Klimaanlage" in „3 Klimaanlagen + 3 Deckenventilatoren" ändern.

**Vorgehen**
1. In allen 6 Sprachdateien unter `src/i18n/locales/` den Key `features.ac` von der aktuellen Übersetzung auf die neue Formulierung setzen:
   - `de.json`: „3 Klimaanlagen + 3 Deckenventilatoren"
   - `en.json`: „3 air conditioners + 3 ceiling fans"
   - `nl.json`: „3 airconditioners + 3 plafondventilatoren"
   - `ru.json`: „3 кондиционера + 3 потолочных вентилятора"
   - `ar.json`: „3 مكيفات + 3 مراوح سقفية"
   - `ar-EG.json`: „3 تكييف + 3 مراوح سقف"

2. Keine Änderung am Icon (`Snowflake`) oder an sonstigen Features.

**Out of scope**
Keine Code-Änderungen außer den 6 i18n-JSON-Dateien.