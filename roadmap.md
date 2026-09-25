# Roadmap

## Airbnb iCal-Synchronisation (in Arbeit)
- [x] Schema: external_uid, ical_settings, ical_sync_log
- [x] Import (Edge/Server) + Cron alle 15 Minuten
- [x] Privatsphäre-sicherer .ics-Export mit Geheim-Token
- [x] Adminbereich "Airbnb-Synchronisation" inkl. Protokoll
- [x] Konfliktschutz vor Bestätigung (Sync vor Confirm)
- [x] Abschlusstest im Adminbereich + Testdaten entfernt

## Zahlungsvorbereitung (neu, noch keine echten Zahlungen)
- [x] Buchungstabelle erweitern: booking_type, booking_status, payment_status,
      payment_provider, payment_method, currency, Beträge als Integer
      (nightly_total, cleaning_fee, discount_amount, total_amount,
      deposit_amount, amount_paid), payment_transaction_id, payment_reference,
      payment_expires_at, confirmed_at, cancelled_at, refunded_at, price_snapshot (JSON)
- [x] Zeitlich begrenzte Reservierung (15 Min) + automatisches Freigeben abgelaufener Holds
- [x] Serverseitige Verfügbarkeitsprüfung vor Zahlung und vor Bestätigung
- [x] Saubere Schnittstellen/Platzhalter für Paymob und PayPal (Secrets nur serverseitig)
- [x] Einstellung: Direktbuchungen automatisch bestätigen oder manuell freigeben
- [x] Bestehende Anfragefunktion bleibt unverändert

## Status 22.09.
Airbnb-Sync getestet (Import, Duplikate, Änderung, Stornierung, Export, Konflikt, Datenschutz) — Testdaten entfernt.
Zahlungsvorbereitung: Schema + Serverschnittstellen fertig, keine aktive Zahlung.

## Mehrwährung (EGP/EUR/USD)
- [x] Kurs-Tabellen, Umrechnungsprotokoll, Währungseinstellungen je Wohnung
- [x] Kursdienst mit Fallback auf letzten Kurs, nie Kurs 0
- [x] 15-Minuten-Kursfixierung beim Zahlungsstart
- [x] Adminbereich Währung + Eigentümer-Anzeigewährung
