# Mitarbeiterbereich & Aufgabenverwaltung

Der Umfang ist sehr groß. Damit nichts halb fertig oder instabil bleibt (wie zuletzt bei der Abrechnung), baue ich in drei aufeinander aufbauenden Etappen. Jede Etappe ist für sich nutzbar und getestet. Bestehende Wohnungen, Buchungen, Eigentümer, Preise, Zahlungen, Services und E-Mails bleiben unverändert.

## Etappe 1 – Grundlage und Mitarbeiter-App (diese Runde)
- Neue Rollen: Teamleiter, Mitarbeiter, externer Dienstleister (Super-Admin existiert bereits).
- Mitarbeiterkonten: anlegen, per E-Mail einladen, aktivieren/deaktivieren, Wohnungen, Team, Aufgabenarten, Sprache und Berechtigungen zuordnen. Mitarbeiter können sich nichts selbst zuordnen.
- Aufgabenkatalog mit den 23 Standard-Aufgabenarten, eigene Arten ergänzbar.
- Checklisten je Aufgabenart, je Wohnung anpassbar, Pflichtpunkte blockieren den Abschluss.
- Automatische Aufgaben je Wohnung konfigurierbar: bei Bestätigung (Vorbereitung, Empfang, Endreinigung, Check-out-Kontrolle, Wäsche). Keine Doppelungen bei Wiederholung. Bei Stornierung werden nicht begonnene Aufgaben storniert, begonnene/kostenpflichtige bleiben erhalten, mit Hinweis an die Verwaltung.
- Alle Status (nicht zugewiesen … überfällig) mit lückenlosem Verlauf und Audit-Protokoll.
- Mobiler Mitarbeiterbereich unter /staff: heute, kommend, überfällig, hohe Priorität, neu, erledigt; Filter; große Knöpfe; Annehmen/Ablehnen/Unterwegs/Start/Pause/Fertig; Checkliste; Navigation zur Adresse; Fotos direkt mit der Kamera; Deutsch/Englisch/Arabisch (RTL).
- Arbeitszeit: Start, Pausen, Ende, Gesamtdauer; Korrektur nur durch Verwaltung mit Grund.
- Fotos/Belege mit Kategorie, Beschreibung und Sichtbarkeit (Verwaltung / + Mitarbeiter / + Eigentümer) in einem geschützten Speicher.
- Admin-Aufgabenübersicht: Listenansicht mit Filtern und Suche, Kennzahlen (heute, nicht zugewiesen, überfällig, zur Kontrolle, Nacharbeit), Zuweisen mit Anzeige von Verfügbarkeit, vorhandenen Aufgaben und Überschneidungen, Kontrollieren/Freigeben/Nacharbeit/Stornieren.
- Datenschutz: jede Abfrage serverseitig und per Datenbankregeln abgesichert; Gastkontakt nur bei Empfang/Transfer-Aufgaben; keine Umsätze, Abrechnungen, Provisionen oder fremde Vergütungen für Mitarbeiter.

## Etappe 2 – Kosten, Reparaturen, Eigentümer
- Vergütung Mitarbeiter getrennt vom Eigentümer-Servicepreis, Marge intern sichtbar, Kostenstatus-Workflow.
- Übergabe geprüfter Kosten an die Buchungs-Serviceposition und Eigentümerabrechnung (nie ungeprüft).
- Reparaturen mit Kostenschätzung, Freigabegrenze je Wohnung, Freigabe/Ablehnung protokolliert, Notfall-Kennzeichnung.
- Eigentümerportal: geplante/erledigte Leistungen, freigegebene Fotos und Dokumente, Servicekosten.

## Etappe 3 – Planung und Benachrichtigungen
- Verfügbarkeit der Mitarbeiter (verfügbar, Urlaub, krank, Uhrzeiten) mit Konfliktmeldung an die Verwaltung.
- Kalender- und Wochenplanung im Adminbereich, Teams.
- E-Mail- und interne Benachrichtigungen (neue/geänderte/stornierte Aufgabe, Erinnerung, überfällig, Nacharbeit); vorbereitet für spätere offizielle WhatsApp-/Push-Anbindung.

Nach jeder Etappe teste ich die zugehörigen Punkte aus deiner Liste (z. B. automatische Reinigung, keine Doppelungen, Stornierung, fremde Aufgaben unsichtbar, externer Dienstleister, Pflichtcheckliste, Foto-Upload, Zeiterfassung, Nacharbeit, drei Sprachen).

## Technische Details
- Neue Tabellen: staff_profiles, teams, staff_property_assignments, staff_task_type_assignments, task_types, task_checklist_templates (+ property overrides), task_automation_rules, tasks, task_checklist_items, task_status_history, task_time_entries, task_attachments, task_audit_log; später task_costs, repair_approvals, staff_availability, staff_notifications.
- Enum app_role um team_lead, staff, contractor erweitern; Hilfsfunktionen can_access_task / is_task_manager (security definer) für RLS.
- Idempotenz über eindeutigen Schlüssel (booking_id, task_type_id, automation_key).
- Auslösung über die bestehenden Bestätigungs-/Stornierungs- und Airbnb-Sync-Pfade.
- Privater Storage-Bucket task-files, Zugriff nur über signierte URLs aus Serverfunktionen.
