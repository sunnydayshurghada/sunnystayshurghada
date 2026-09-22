# Roadmap

## Airbnb iCal-Synchronisation (in Arbeit)
- [x] Schema: external_uid, ical_settings, ical_sync_log
- [x] Import (Edge/Server) + Cron alle 15 Minuten
- [x] Privatsphäre-sicherer .ics-Export mit Geheim-Token
- [x] Adminbereich "Airbnb-Synchronisation" inkl. Protokoll
- [x] Konfliktschutz vor Bestätigung (Sync vor Confirm)
- [ ] Abschlusstest im Adminbereich + Testdaten entfernen

## Zahlungsvorbereitung (neu, noch keine echten Zahlungen)
- [ ] Buchungstabelle erweitern: booking_type, booking_status, payment_status,
      payment_provider, payment_method, currency, Beträge als Integer
      (nightly_total, cleaning_fee, discount_amount, total_amount,
      deposit_amount, amount_paid), payment_transaction_id, payment_reference,
      payment_expires_at, confirmed_at, cancelled_at, refunded_at, price_snapshot (JSON)
- [ ] Zeitlich begrenzte Reservierung (15 Min) + automatisches Freigeben abgelaufener Holds
- [ ] Serverseitige Verfügbarkeitsprüfung vor Zahlung und vor Bestätigung
- [ ] Saubere Schnittstellen/Platzhalter für Paymob und PayPal (Secrets nur serverseitig)
- [ ] Einstellung: Direktbuchungen automatisch bestätigen oder manuell freigeben
- [ ] Bestehende Anfragefunktion bleibt unverändert
