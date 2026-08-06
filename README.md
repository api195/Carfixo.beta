# Carfixo – Werkstatt-Marktplatz (Beta)

Carfixo verbindet Autofahrer mit Werkstätten, Tuning-Betrieben, Fahrzeugaufbereitern und Prüfstellen.
Kunden beschreiben ihr Anliegen einmal – passende Betriebe antworten mit echten Angeboten.

## Seiten

| Datei | Zweck |
|---|---|
| `index.html` | Startseite: Direkt-Suche (Was? / Wo?), Kategorie-Schnellzugriff, Einstiegskacheln + Scroll-Story „So funktioniert's" |
| `app.html` | Die eigentliche Web-App (Kunden + Betriebe, Hash-Routing) |
| `admin.html` | Geschützter Admin-Bereich (nur `role = admin`) |

Alles ist statisches HTML/CSS/JS ohne Build-Schritt – direkt über GitHub Pages o. ä. hostbar.
Die Bibliotheken (supabase-js, Leaflet) liegen lokal unter `assets/vendor/`.

## Funktionen

**Kunden**
- Registrierung/Login, Fahrzeug-Garage im mobile.de-Aufbau – nur Marke + Modell Pflicht,
  ~80 Marken / ~950 Modelle (inkl. ausgeschriebener M/S/RS/AMG-Modelle), Freitext erlaubt
- **Fahrzeugschein scannen** (OCR, ohne API-Key via Tesseract.js): liest die genormten
  Feldcodes der Zulassungsbescheinigung Teil I und füllt Marke, Modell, PS, Erstzulassung,
  Kraftstoff, Sitzplätze automatisch vor
- Teile-Marktplatz: neue & gebrauchte Teile durchsuchen und **direkt kaufen** (Versand oder
  Abholung, vorab mit dem Betrieb abgestimmt) oder unverbindlich anfragen
- Einheitliches, eigenes SVG-Icon-Set statt Emojis auf der ganzen Website
- Werkstatt-Suche mit Filtern (Kategorie, Leistung, Marke, Stadtteil, Bewertung, mobil), Karte + Liste
- Vollständige Werkstattprofile mit Bewertungen und Öffnungszeiten
- Direktanfrage an einen Betrieb **oder** öffentliche Ausschreibung an alle passenden Betriebe
- KI-Analyse (Beta, regelbasiert) mit Foto-Upload
- Angebotsvergleich (Einzelpositionen, „Bester Preis"), verbindliche Annahme
- Chat mit dem Betrieb, Auftragsabschluss, Bewertung (1–5 ★)
- Premium: Erinnerungen für TÜV/Service/Reifenwechsel (in der Beta kostenlos aktivierbar)

**Betriebe**
- Registrierung als Betrieb, vollständiges Profil (Adresse mit Karten-Pin, Kategorien,
  Leistungen, Marken, Öffnungszeiten, Preisniveau, mobiler Service)
- Dashboard mit KPIs, offene Ausschreibungen (nach Kategorien gefiltert) + Direktanfragen
- Angebote mit Einzelpositionen, Auftragsverwaltung mit Status, Wochenkalender, Kundenchat
- Teile verkaufen über den Teile-Marktplatz (Fotos, Preis, Zustand, OE-Nummer, Versand/Einbau-Option, pausierbar)
- Sichtbar in der Suche erst nach **Verifizierung durch einen Admin**

**Admin** (`admin.html`)
- Plattform-KPIs, Werkstätten verifizieren/sperren, Nutzerliste, Anfragen-Monitor

## Backend (Supabase)

Projekt: `boozzfiroukraekyijfq` (EU) – Verbindung in `assets/config.js` (öffentlicher Publishable Key).

Tabellen: `profiles`, `workshops`, `vehicles`, `requests` (open/direct), `offers`, `bookings`,
`messages`, `reviews`, `reminders`, `parts` (Teile-Marktplatz) + Storage-Buckets `attachments` (öffentlich) und `documents` (privat).

Sicherheit:
- Row Level Security auf allen Tabellen (Kunden sehen nur Eigenes, Betriebe nur passende offene
  Ausschreibungen bzw. eigene Direktanfragen, Admins alles)
- Rollen-Eskalation per Trigger blockiert (`role` ändert nur ein Admin)
- Angebots-Annahme über `accept_offer()` (SECURITY DEFINER, transaktional: akzeptiert, lehnt Rest ab, bucht)
- Bewertungen nur durch den Kunden einer **abgeschlossenen** Buchung; Rating-Aggregat per Trigger

## Testkonten (Beta)

Für die Beta existieren Testkonten (`…@carfixo-test.de`) sowie 6 Demo-Betriebe in Köln
(`demo-…@carfixo-demo.de`).

> **Zugangsdaten stehen bewusst nicht mehr in diesem Repository.**
> Sie lagen hier zuvor im Klartext – inklusive eines Kontos mit Admin-Rolle.
> Passwörter bitte ausschließlich über den Passwortmanager teilen.
>
> **Vor dem Launch:** Testkonten löschen oder mit neuen, zufälligen Passwörtern
> versehen – insbesondere das Admin-Konto (siehe `db/2026-07-23_security_hardening.sql`).

## Lokal starten

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Tests

```bash
python3 -m http.server 8000     # in einem zweiten Terminal
npm i playwright && node tests/smoke.js
```

Smoke-Test für Routing, Auth-Ansichten und Handler-Escaping. Prüft bewusst nur, was
ohne Backend läuft – datengetriebene Inhalte brauchen eine erreichbare Supabase-Instanz.

## Vor dem Launch – offene Punkte

Diese Schritte lassen sich nicht im Code erledigen:

- **Auth → URL Configuration:** `https://carfixo.de` als Site-URL und als Redirect-URL
  eintragen (zusätzlich `http://localhost:8000/app.html` fürs lokale Testen).
  Ohne das laufen die Links aus „Passwort vergessen" ins Leere.
- **Auth → Providers → Password:** „Leaked password protection" aktivieren.
- **Testkonten** löschen oder Passwörter rotieren (siehe oben).
- **E-Mail-Versand:** Der einzige fehlende Wert ist `resend_api_key` in
  `private.app_secrets`. Trigger, Function, Push-Schlüssel und `app_url` sind bereits
  eingerichtet – siehe `supabase/functions/notify-dispatch/README.md`.
  Danach `resend_from` auf die eigene, in Resend verifizierte Domain umstellen.
- **Rechtstexte** in `legal.html` durch geprüfte Fassungen ersetzen.

Bereits erledigt (nicht erneut einrichten):
- Der pg_cron-Job `carfixo-daily-reminders` läuft täglich um 6:00 UTC.
- Benachrichtigungen werden per Trigger an die Edge Function `notify-dispatch`
  übergeben – ein Database-Webhook wird **nicht** benötigt.
