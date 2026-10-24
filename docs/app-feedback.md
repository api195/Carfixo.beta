# iPhone-App – Rückmeldungen für die Überarbeitung

Gesammelt beim ersten Start im Simulator (23.10.2026). Noch nicht umgesetzt.

## 1. Karte kaputt
Die Kartenkacheln zeigen „API KEY REQUIRED“ (CARTO). CARTO liefert der App
(Herkunft `capacitor://localhost`) keine freien Kacheln aus. In der App einen
anderen Kartenanbieter nutzen, idealerweise mit modernem, nativem Look.

## 2. Design
- Gefällt nicht, wirkt nicht modern genug.
- Zu kompliziert: weniger Text, weniger Kästen, klarere Wege.

## 3. Schwarze Balken oben und unten
Kopfleiste und Tab-Leiste wirken wie schwarze Balken. Inhalt soll bis an den
Rand gehen (randlos, durchscheinend/verschwommen statt massiv schwarz).

## 4. Tab-Leiste unten
- „Notfall“ raus aus der Leiste (bleibt über die Startseite erreichbar).
- Ganz vorne neuer Tab **Home**: Startseite wie auf der Website.
- Alle anderen Tabs rücken eins nach rechts.
- Heute (nicht angemeldet): Suche · Diagnose · Teile · Notfall · Login
  → neu: Home · Suche · Diagnose · Teile · Login
- Entschieden: nur in der App, die Website bleibt. Aufträge kommt aus der Leiste.
  Vorbild: CHECK24 und Uber, freie Hand bei der Umsetzung.

## Umsetzung, Runde 1 (23.10.2026)
- Karte: MapLibre + OpenFreeMap im Carfixo-Dunkel, Rückfall Leaflet/CARTO.
- Home nach Uber/CHECK24: Gruß, große Frage, Suchfeld, 8 Leistungs-Kacheln,
  laufender Auftrag mit Fortschritt, Vergleichs-Banner, Diagnose/Notfall/Teile,
  Garage (angemeldet), Top-Betriebe als Karussell, Vertrauenszeile.
- Randlos: kein Kopfbalken mehr (weicher Verlauf), Tab-Leiste als schwebende Glas-Pille.
- Tabs: Home · Suche · Diagnose · Teile · Login/Konto. Aufträge und Fahrzeuge über Home
  (Apple empfiehlt höchstens 5 Tabs).
- Suche: weniger Text, Diagnose-Werbung ausgeblendet, Filter und Karte als Chips.
- Vorschau im Browser: app.html?appui=1

## Rückmeldungen, Runde 2 (23.10.2026)
1. **Echte Bilder für die Kategorien** statt Icons auf den Home-Kacheln
   (Reparatur, Inspektion, Reifen, TÜV, Pflege, Karosserie, Klima, Tuning).
   Bildrechte klären: eigene Fotos, lizenzfreie Fotos (z. B. Unsplash/Pexels-Lizenz)
   oder KI-generiert – keine Bilder ohne Nutzungsrecht.
2. **Diagnose zu voll gepackt** – moderner und übersichtlicher machen
   (Schritt für Schritt statt alles auf einer Seite).
3. Zum Durchtesten: je ein Kunden-, Betriebs- und Admin-Login.

## Umsetzung, Runde 2 (24.10.2026)
1. Home-Kacheln zeigen echte Fotos (Unsplash-Lizenz, lokal gespeichert).
   Herkunft und Fotografen: `docs/bildnachweise.md`.
2. Diagnose in drei Schritten: Problem → Anzeichen (Warnleuchte/Geräusch) →
   Details (Fahrzeug, Dringlichkeit, Foto). Warnleuchten und Geräusche per Umschalter
   statt einer langen Liste. Fortschrittsbalken oben, ein Schritt
   pro Bildschirm. Ergebnis als einzelne Karten je möglicher Ursache, „Angaben
   ändern“ führt zurück. Gilt für App und Website.
3. Testkonten für Kunde und Werkstatt angelegt (siehe README, „Testkonten“).
   Passwörter stehen nicht im Repository. Admin bleibt das Inhaberkonto.
