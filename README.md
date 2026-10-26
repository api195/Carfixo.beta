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
Leaflet wird **nicht** fest eingebunden, sondern erst nachgeladen, wenn Google Maps
ausfällt – das spart jedem Besucher 158 KB (siehe „Karten").

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
- Diagnose (regelbasiert, bewusst nicht „KI“ genannt) mit Foto-Upload
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

## Karten (Google Maps)

Alle drei Karten (Suche, Werkstattprofil, Betriebs-Onboarding) laufen über die gemeinsame
Schicht `assets/maps.js`. Welcher Anbieter dahinter steckt, entscheidet **allein der Key**:

| `GOOGLE_MAPS_KEY` in `assets/config.js` | Anbieter |
|---|---|
| gesetzt | Google Maps |
| leer, Skript blockiert oder Google nicht erreichbar | Leaflet + OpenStreetMap (Rückfall) |

Die App bleibt also ohne Key voll funktionsfähig – nichts bricht.

Leaflet lädt `maps.js` erst im Rückfall nach (JS + CSS zur Laufzeit). Im Normalbetrieb
mit Google Maps wird es nie geholt. Wer daran etwas ändert, sollte beide Wege prüfen:
Google erreichbar **und** Google blockiert.

**Einrichtung** (Google Cloud Console, [console.cloud.google.com](https://console.cloud.google.com)):

1. Projekt anlegen und **Abrechnungskonto** verknüpfen. Ohne Abrechnung liefert Google nur
   graue Karten mit „For development purposes only". Google gewährt monatlich ein
   kostenloses Kontingent, das für die Beta reichlich ist.
2. Unter **APIs & Services → Library** aktivieren:
   - **Maps JavaScript API** (die Karten im Browser)
   - **Geocoding API** (Adresse → Koordinaten, serverseitig)
3. Zwei **getrennte** Schlüssel unter **Credentials → Create credentials → API key** anlegen:

   | Schlüssel | Ablage | Einschränkungen |
   |---|---|---|
   | Browser-Key | `GOOGLE_MAPS_KEY` in `assets/config.js` | *Application restrictions:* Websites → `https://carfixo.de/*`, `http://localhost:8000/*`<br>*API restrictions:* nur **Maps JavaScript API** |
   | Server-Key | Vercel-Umgebungsvariable `GOOGLE_MAPS_SERVER_KEY` | *Application restrictions:* keine (oder IP)<br>*API restrictions:* nur **Geocoding API** |

   Der Browser-Key steht zwangsläufig im Quelltext – das ist bei Google so vorgesehen.
   Der Schutz kommt aus der Website-Beschränkung, **nicht** aus Geheimhaltung.
   Der Server-Key darf niemals ins Frontend.
4. Unter **Billing → Budgets & alerts** ein Budget mit E-Mail-Warnung setzen (z. B. 20 €).
   Google stoppt bei Budgetüberschreitung **nicht** automatisch – die Warnung ist die Bremse.

**Datenschutz:** Karten werden erst geladen, wenn sie aktiv geöffnet werden
(„Karte anzeigen"). Vorher geht keine einzige Anfrage an Google. Die Adresssuche läuft
über `/api/geocode`, also über unseren Server – die IP-Adressen der Nutzer erreichen
Google dabei nicht. Siehe `legal.html`.

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

Früher gab es 3 Testkonten (`…@carfixo-test.de`) und 6 Demo-Betriebe in Köln
(`demo-…@carfixo-demo.de`).

> **Alle 9 Konten sind seit 2026-10-18 gesperrt.** Ihre Zugangsdaten standen früher
> im Klartext in diesem (öffentlichen) Repository und sind über die Git-Historie
> weiterhin lesbar. Gesperrt über `auth.users.banned_until`, laufende Sitzungen
> beendet. Das frühere Admin-Konto `admin@carfixo-test.de` ist zusätzlich auf
> `customer` herabgestuft.
>
> Admin ist jetzt das Inhaberkonto. Neue Testkonten bitte mit eigenen, zufälligen
> Passwörtern anlegen und **nie** ins Repository schreiben.

Die Betriebe dieser Konten bleiben als **Beispielbetriebe** sichtbar (zum Vorzeigen),
sobald `db/2026-10-18_vertrauensfelder_und_beispielbetriebe.sql` eingespielt ist:
mit Hinweis „Beispielbetrieb", ohne Prüfsiegel, ohne Anfrage- oder Kaufmöglichkeit.
Vor dem echten Launch ausblenden mit
`update public.workshops set is_verified = false where is_demo;`

**Aktuelle Testkonten (seit 2026-10-24)** – Passwörter wurden nur im Chat übergeben
und stehen bewusst nicht hier:

| Konto | Rolle | Hinweis |
|---|---|---|
| `test-kunde@carfixo-test.de` | Kunde | E-Mail-Benachrichtigungen aus (Domain empfängt keine Mails) |
| `test-werkstatt@carfixo-test.de` | Betrieb „Carfixo Testwerkstatt“ | verifiziert **und** Beispielbetrieb, alle 8 Home-Kategorien |

Die Testwerkstatt ist verifiziert, sieht also offene Ausschreibungen und kann Angebote
abgeben. Als Beispielbetrieb nimmt sie aber keine Direktanfragen an und trägt den
Hinweis „Beispielbetrieb“. Durchspielen: als Kunde eine Ausschreibung in Köln anlegen,
als Werkstatt anbieten, als Kunde annehmen. Echte verifizierte Betriebe sehen
Ausschreibungen des Testkunden ebenfalls – im Titel am besten „TEST“ schreiben.
Vor dem Launch sperren wie oben (`banned_until`); die Zeile oben blendet die Testwerkstatt mit aus.

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

`node tests/diagnose.js` prüft die Diagnose-Schritte und die Bilder der Home-Kacheln
(mit `SHOTS=ordner` entstehen Bildschirmfotos).

Smoke-Test für Routing, Auth-Ansichten und Handler-Escaping. Prüft bewusst nur, was
ohne Backend läuft – datengetriebene Inhalte brauchen eine erreichbare Supabase-Instanz.

## Content-Security-Policy (Report-Only)

Die Richtlinie steht in `vercel.json` als **`Content-Security-Policy-Report-Only`**.
In diesem Modus **blockiert der Browser nichts** – er meldet nur, was er blockieren
*würde*. Das ist Absicht: Eine zu enge Richtlinie legt sonst die Seite lahm.

Verstöße landen über `/api/csp-report` in den **Vercel-Logs** (Projekt → Logs, nach
`CSP-Verstoß` filtern) und zusätzlich immer in der Browser-Konsole.

> **Achtung, Hobby-Plan:** Vercel hält Laufzeit-Logs dort nur **eine Stunde**.
> Meldungen über Tage zu sammeln funktioniert so nicht – sie sind verfallen, bevor
> man nachsieht. Für eine echte Sammlung bräuchte der Endpunkt einen dauerhaften
> Speicher (z. B. eine Supabase-Tabelle) oder den Pro-Plan.

**Ablauf zum Scharfschalten (ohne dauerhafte Sammlung):**

1. Live-Seite öffnen, Browser-Konsole auf (Safari: ⌥⌘C), alle Hauptwege einmal
   durchklicken: Startseite, Suche mit Karte, Werkstattprofil mit Karte, Login,
   Teile, Fahrzeugschein-Scan. Verstöße stehen als `[Report Only]` in der Konsole.
2. Die Richtlinie mit Googles offizieller CSP-Liste für die Maps JavaScript API
   abgleichen – Google lädt zur Laufzeit von mehr Domains als nur
   `maps.googleapis.com`.
3. Fehlende Quellen in `vercel.json` ergänzen – oder, wenn eine Quelle dort nichts
   zu suchen hat, die Ursache im Code beheben.
4. Erst wenn die Konsole sauber ist: den Header-Schlüssel von
   `Content-Security-Policy-Report-Only` auf `Content-Security-Policy` ändern.

**Was die Richtlinie heute leistet – und was nicht:**

`script-src` enthält `'unsafe-inline'`, weil `assets/app.js` 77 Inline-`onclick`-Handler
erzeugt und `index.html` ein Inline-Skript hat. Damit schützt die Richtlinie **nicht**
vor XSS über eingeschleustes Inline-JavaScript. Sie begrenzt aber, von **welchen
fremden Servern** überhaupt Skripte, Bilder und Verbindungen kommen dürfen – ein
Angreifer kann also keine Daten an eine eigene Domain ausleiten.

Echten XSS-Schutz gäbe es erst, wenn die Inline-Handler durch `addEventListener`
ersetzt werden und `'unsafe-inline'` verschwindet. Das ist ein eigenes Vorhaben.

## Vor dem Launch – offene Punkte

Diese Schritte lassen sich nicht im Code erledigen:

- **Auth → URL Configuration:** `https://carfixo.de` als Site-URL und als Redirect-URL
  eintragen (zusätzlich `http://localhost:8000/app.html` fürs lokale Testen).
  Ohne das laufen die Links aus „Passwort vergessen" ins Leere.
- **Auth → Sign In / Providers → Email:** „Minimum password length" von 6 auf **8** anheben
  und bei „Password requirements" Buchstaben + Ziffern verlangen – beides passt dann zur
  Prüfung im Frontend.
  „Prevent use of leaked passwords" lässt sich **nicht** aktivieren, das ist ein Pro-Feature.
  Die Prüfung übernimmt stattdessen das Frontend direkt über die HaveIBeenPwned-API
  (`validateNewPassword` in `assets/app.js`) – gleiche Datenquelle, ohne Abo.
- **Google-Maps-Schlüssel** eintragen (siehe „Karten" oben): Browser-Key in
  `assets/config.js`, Server-Key als Vercel-Umgebungsvariable `GOOGLE_MAPS_SERVER_KEY`.
  Beide Schlüssel einschränken und ein Budget mit Warnung setzen. Solange das offen ist,
  läuft Carfixo auf Leaflet + OpenStreetMap weiter – funktioniert, sieht nur anders aus.
- **Migrationen eingespielt** (2026-10-19): `2026-10-18_vertrauensfelder_und_beispielbetriebe.sql`
  und `2026-10-19_kuendigung_2fa_csp.sql`. Admin-Zugang braucht seitdem den zweiten Faktor
  (eingerichtet für das Admin-Konto).
- **`db/2026-10-21_stripe.sql` einspielen** (Online-Zahlung). Rückwärtskompatibel: die
  bestehende App läuft damit unverändert weiter.
- **Stripe einrichten** (siehe Abschnitt „Online-Zahlung“ unten): Konto anlegen, Connect
  aktivieren, Secrets `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` in Supabase hinterlegen,
  Webhook auf `stripe-webhook` zeigen lassen. Erst im Testmodus, dann live.
- **Beispielbetriebe ausblenden** (siehe „Testkonten“).
- **Rechtstexte** in `legal.html` anwaltlich prüfen lassen; die offenen Fragen stehen in
  `docs/rechtstexte-pruefhinweise.md`. Der Kündigungsbutton „Verträge hier kündigen“
  (`app.html#/kuendigen`) ist fertig und in jeder Fußzeile.
- **Datenschutzverträge (Art. 28 DSGVO):** Supabase – im Dashboard unter Organization →
  Legal Documents anfordern und unterschreiben. Vercel – DPA gilt erst ab Pro-Tarif
  (Hobby ist zudem nur nicht-kommerziell erlaubt). Resend – gilt mit den AGB, Kopie unter
  Settings → Documents.
- **CSP scharfschalten**, sobald die Report-Only-Logs mehrere Tage ruhig sind
  (siehe „Content-Security-Policy“ oben).
- **Auth-E-Mails (Registrierung, Passwort zurücksetzen):** laufen **nicht** über
  `notify-dispatch`, sondern über Supabase Auth. Ohne eigenen SMTP-Server sind es nur
  2 Mails pro Stunde. Unter **Authentication → Emails → SMTP Settings** Resend eintragen
  (Host `smtp.resend.com`, Port `465`, Benutzer `resend`, Passwort = eigener Resend-API-Key,
  Absender `no-reply@carfixo.de`), danach unter **Authentication → Rate Limits** das
  E-Mail-Limit anheben. Resend Free erlaubt 100 Mails pro Tag.

Bereits erledigt (nicht erneut einrichten):
- Der pg_cron-Job `carfixo-daily-reminders` läuft täglich um 6:00 UTC.
- Benachrichtigungen laufen per Trigger an die Edge Function `notify-dispatch`
  – ein Database-Webhook wird **nicht** benötigt.
- **E-Mail-Versand ist aktiv und getestet:** Resend-Key hinterlegt, Domain
  `carfixo.de` verifiziert, Absender `Carfixo <no-reply@carfixo.de>`.
  Ende-zu-Ende geprüft (Insert → Trigger → Function → Resend): `emailed: true`.
- **Web-Push** ist vollständig: Service Worker (`sw.js`), Geräte-Anmeldung im Konto,
  Versand über `notify-dispatch`.

## Online-Zahlung (Stripe Connect)

- Modell: **Direct Charges auf Standard-Konten**. Jeder Betrieb verbindet im Profil sein
  eigenes Stripe-Konto und ist Zahlungsempfänger. Stripe-Gebühren, Erstattungen und
  Rückbuchungen laufen über sein Konto. Carfixo nimmt kein Geld an und erhebt keine Gebühr.
- Verbinden dürfen nur **verifizierte** Betriebe (keine Beispielbetriebe).
- Kunden zahlen **nach der Reparatur** (Status „Abholbereit“ oder „Abgeschlossen“). Betrag:
  Buchungspreis + freigegebene Zusatzarbeiten (`booking_amount_due`).
- Edge Functions:
  - `stripe`: Aktionen `status`, `connect`, `checkout`, `refund`; prüft das Nutzer-Token selbst
  - `stripe-webhook`: einzige Stelle, die Buchungen als bezahlt oder erstattet markiert; prüft
    Stripe-Signatur, Konto und Sitzungs-ID
- Ohne `STRIPE_SECRET_KEY` zeigt die App „Bald verfügbar“, und Kunden zahlen vor Ort.
- Webhook im Stripe-Dashboard: Endpunkt
  `https://boozzfiroukraekyijfq.supabase.co/functions/v1/stripe-webhook`, Typ
  **„Ereignisse in verbundenen Konten“**, Ereignisse `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
  `charge.refunded`, `account.updated`, `account.application.deauthorized`.
- Tests: `node tests/zahlung.js` (Oberfläche). Datenbank- und Webhook-Logik wurden lokal
  gegen Postgres 16 bzw. das Stripe-SDK geprüft.
