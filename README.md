# Carfixo – Werkstatt-Marktplatz (Beta)

Carfixo verbindet Autofahrer mit Werkstätten, Tuning-Betrieben, Fahrzeugaufbereitern und Prüfstellen.
Kunden beschreiben ihr Anliegen einmal – passende Betriebe antworten mit echten Angeboten.

## Seiten

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage (interaktive Scroll-Experience) |
| `app.html` | Die eigentliche Web-App (Kunden + Betriebe, Hash-Routing) |
| `admin.html` | Geschützter Admin-Bereich (nur `role = admin`) |

Alles ist statisches HTML/CSS/JS ohne Build-Schritt – direkt über GitHub Pages o. ä. hostbar.
Die Bibliotheken (supabase-js, Leaflet) liegen lokal unter `assets/vendor/`.

## Funktionen

**Kunden**
- Registrierung/Login, Fahrzeug-Garage (mit Fahrzeugschein-Upload, TÜV-Datum)
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
- Sichtbar in der Suche erst nach **Verifizierung durch einen Admin**

**Admin** (`admin.html`)
- Plattform-KPIs, Werkstätten verifizieren/sperren, Nutzerliste, Anfragen-Monitor

## Backend (Supabase)

Projekt: `boozzfiroukraekyijfq` (EU) – Verbindung in `assets/config.js` (öffentlicher Publishable Key).

Tabellen: `profiles`, `workshops`, `vehicles`, `requests` (open/direct), `offers`, `bookings`,
`messages`, `reviews`, `reminders` + Storage-Buckets `attachments` (öffentlich) und `documents` (privat).

Sicherheit:
- Row Level Security auf allen Tabellen (Kunden sehen nur Eigenes, Betriebe nur passende offene
  Ausschreibungen bzw. eigene Direktanfragen, Admins alles)
- Rollen-Eskalation per Trigger blockiert (`role` ändert nur ein Admin)
- Angebots-Annahme über `accept_offer()` (SECURITY DEFINER, transaktional: akzeptiert, lehnt Rest ab, bucht)
- Bewertungen nur durch den Kunden einer **abgeschlossenen** Buchung; Rating-Aggregat per Trigger

## Testkonten (Beta)

Alle mit Passwort `Carfixo2026!`:

| Konto | Rolle |
|---|---|
| `kunde@carfixo-test.de` | Kunde |
| `werkstatt@carfixo-test.de` | Betrieb („Carfixo Testwerkstatt", verifiziert) |
| `admin@carfixo-test.de` | Admin |

Dazu 6 Demo-Betriebe in Köln (`demo-…@carfixo-demo.de`, gleiches Passwort).

## Lokal starten

```bash
python3 -m http.server 8000
# → http://localhost:8000
```
