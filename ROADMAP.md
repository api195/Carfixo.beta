# Carfixo – Technischer Umsetzungsplan

Carfixo ist **Vermittler**: Reparaturleistung, Rechnung und Gewährleistung liegen bei der Werkstatt.
Zahlungen laufen bis zum Launch ausschließlich im **Testmodus** (keine echten Stripe-Keys).

## Etappen (Priorität von oben nach unten)

| # | Etappe | Inhalt (Anforderungs-Nr.) | Status |
|---|---|---|---|
| 1 | Fundament | 13 Kategorien + Unterkategorien (4), Umkreissuche mit Standort/Adresse/Radius statt nur Stadtteil (3), neue Filter (Hol-/Bring, Ersatzwagen, geöffnet jetzt, E-Auto, Oldtimer), Formular-/Button-Fixes (6), Performance/Lazy-Loading (19) | ✅ |
| 2 | KI-Diagnose | Diagnose als Hauptfunktion mit Warnleuchten, Geräuschen, Foto, Dringlichkeit (1), Notfallmodus (13), Preisorientierung (14) | ✅ |
| 3 | Auftragsabwicklung | 10-stufiges Status-Tracking (7), Zusatzfreigaben mit Foto + Kosten (8), strukturierte Angebotskalkulation + Vorlagen (9), Teile-Optionen (27) | ✅ |
| 4 | Kundenbindung | Digitale Fahrzeugakte (16), Favoriten + mehrere Fahrzeuge (17), Erinnerungszentrale (12), Werkstattvergleich bis 3 (15) | ✅ |
| 5 | Buchung & Zahlung | Buchungsübersicht + Testzahlung + payment_status (22), Stornierung/Verschiebung/No-Show (23) | ✅ |
| 6 | Werkstatt-Ausbau | Profil-Bilder + Trust-Signale (5), Kapazitäten/Verfügbarkeit (10, 29), Premium für Werkstätten (11), Archiv + Export (30) | ✅ |
| 7 | Plattform | Meldesystem/Konflikte (25), Benachrichtigungszentrale (24), Onboarding-Touren (21), Rechtsseiten + Nutzerrechte (26), Team-Zugänge (28), Admin-Analytics (32), Qualität/Betrugsschutz (31, 18), Vermittler-Hinweise (33) | ✅ (Kern) – Feinschliff: rollenbasierte Team-Rechte, Push/E-Mail-Versand, Betrugs-Scoring |
| 8 | Marktplatz-Ausbau | Teile-Marktplatz (Betriebe verkaufen Teile, Kunden fragen direkt an), Kategorie „Teile & Zubehör", massiv erweiterte Unterkategorien (357 Leistungen, u.a. Felgenaufbereitung, Hochglanzverdichten, Stage-Tuning), Fahrzeugdatenbank auf ~80 Marken / ~900 Modelle + Freitext-Fallback, vereinfachtes Fahrzeugformular (nur Marke + Modell Pflicht) | ✅ |

## Architektur

- Statisches Frontend (`index.html`, `app.html`, `admin.html` + `assets/`), kein Build-Schritt
- Supabase: Postgres + RLS, Auth, Storage, Realtime; Migrationen über MCP versioniert
- Karten: Leaflet + OSM/Carto (lokal gevendort); Geocoding: Nominatim (deutschlandweit)
- KI-Diagnose: regelbasierte Beta (klar als „unverbindliche Ersteinschätzung" gekennzeichnet);
  später austauschbar gegen echtes Modell (Serverless Function)
- Zahlungen: UI/Statusmodell fertig, Stripe-Anbindung kommt kurz vor Launch
