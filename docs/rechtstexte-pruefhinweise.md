# Rechtstexte – Hinweise für die anwaltliche Prüfung

Stand: 21. Oktober 2026. Gehört zu `legal.html`. Die Texte dort sind sauber formuliert,
aber **nicht anwaltlich geprüft**. Diese Liste sammelt, was bei der Prüfung besonders
angesehen werden sollte und welche Entscheidungen bewusst getroffen wurden.

## Eckdaten

- Anbieter: Abdulhamid Sucu, Einzelunternehmen, Geschäftsbezeichnung „Carfixo“,
  Reutlinger Straße 37, 50739 Köln (Wohnadresse, bewusst gewählt)
- Kleinunternehmer nach § 19 UStG, keine USt-IdNr., keine Wirtschafts-IdNr. bekannt,
  kein Handelsregistereintrag
- Kontakt nur per E-Mail (info@carfixo.de), **keine Telefonnummer** – bewusste Entscheidung
- Alle Leistungen von Carfixo sind derzeit kostenlos, auch „Premium“
- Online-Zahlung: Stripe Connect, Direct Charges auf Standard-Konten der Betriebe.
  Der Betrieb ist Zahlungsempfänger, Carfixo nimmt kein Geld an und erhebt keine Gebühr.

## Bitte prüfen

### Hoch

1. **Widerrufsrecht bei Buchungen über Carfixo (Fernabsatz).** Kunde und Betrieb schließen den
   Reparaturvertrag über die App, also im Fernabsatz. Fragen: Muss der Betrieb vor der Buchung in
   der App über das Widerrufsrecht belehren (Art. 246a EGBGB)? Muss Carfixo als Plattform dafür
   Felder bzw. einen Ablauf bereitstellen? Gilt die seit 19.06.2026 vorgeschriebene
   elektronische Widerrufsfunktion („Vertrag widerrufen“, Richtlinie (EU) 2023/2673) auch für
   diese Buchungen, und wer muss sie auf der Plattform anbieten? Technisch ließe sie sich wie der
   Kündigungsbutton bauen.
2. **Kein Telefon im Impressum.** Nach EuGH C-649/17 genügt ein schneller elektronischer
   Kontaktweg, wenn E-Mails zügig beantwortet werden. Reicht das hier?
3. **Auftragsverarbeitungsverträge – derzeit NICHT vollständig erfüllt.** Die
   Datenschutzerklärung sagt, mit jedem Auftragsverarbeiter bestehe ein Vertrag nach
   Art. 28 DSGVO. Stand 21.10.2026 stimmt das nur für Resend. Supabase: DPA noch nicht
   unterschrieben. Vercel: bleibt vorerst auf Hobby, dafür gibt es keinen DPA. Vor dem
   Start mit echten Nutzern beides erledigen, sonst ist die Aussage falsch.
   Ursprünglicher Hinweis: Supabase: DPA muss im Dashboard angefordert und
   unterschrieben werden. Vercel: Der DPA gilt laut Vercel nur für Pro- und Enterprise-Kunden;
   Hobby ist außerdem nur für nicht-kommerzielle Nutzung erlaubt. Für den Launch ist Vercel Pro
   vorgesehen. Resend: DPA gilt mit Annahme der AGB und ist vorunterschrieben im Dashboard
   abrufbar.

### Mittel

4. **§ 312 Abs. 1a BGB (Bezahlen mit Daten).** Ob für die kostenlosen Konten
   Verbraucherschutzpflichten (insbesondere ein Widerrufsrecht) gelten. Annahme: nein, weil die Daten
   ausschließlich zur Leistungserbringung verarbeitet werden. Keine Werbung, kein Tracking.
5. **Haftung bei unentgeltlicher Leistung.** Die AGB nutzen die übliche Klausel
   (wesentliche Vertragspflichten). Denkbar wäre eine weitergehende Beschränkung auf Vorsatz und
   grobe Fahrlässigkeit (Rechtsgedanke §§ 521, 599 BGB).
6. **Gerichtsstand Köln (AGB Betriebe).** Eine Gerichtsstandsvereinbarung wirkt nur zwischen
   Kaufleuten (§ 38 ZPO). Carfixo ist als nicht eingetragener Kleinunternehmer womöglich kein
   Kaufmann. Formuliert ist „soweit gesetzlich zulässig“.
7. **Kennzeichnung „Hervorgehoben“** (erledigt 21.10.2026). Premium-Betriebe stehen oben und
   heißen „Hervorgehoben“, solange Premium kostenlos ist. Sobald Premium Geld kostet, muss das
   Label auf „Anzeige“/„Gesponsert“ wechseln (§ 5a Abs. 4 UWG) – siehe Abschnitt Ranking.
8. **Stripe Connect.** Ob der Abschnitt § 5a der Bedingungen für Betriebe ausreicht, damit Betriebe
   Carfixo als Plattform für ihr Stripe-Konto berechtigen. Auch zu prüfen: Muss Carfixo zusätzlich
   auf das Stripe Connected Account Agreement verlinken?
9. **Aufsichtsrechtlich (ZAG).** Annahme: Carfixo erbringt keinen Zahlungsdienst, weil das Geld
   über Stripe direkt an den Betrieb fließt und Carfixo es nie verwahrt.

10a. **Klarna.** Bei Zahlung mit Klarna verarbeitet Klarna Bank AB Daten (u. a. Bonität)
    als eigener Verantwortlicher. In der Datenschutzerklärung ergänzt; prüfen, ob das
    so genügt.

### Niedrig

10. **Datenschutzbeauftragter.** Annahme: nicht nötig (unter 20 Personen, keine umfangreiche
    systematische Überwachung, Art. 37 Abs. 1 lit. b DSGVO).
11. **Verbraucherstreitbeilegung.** Hinweis „nicht bereit und nicht verpflichtet“ steht drin, weil
    AGB verwendet werden (§ 36 VSBG). Die EU-OS-Plattform ist eingestellt, der Link entfällt.
12. **P2B-Verordnung.** Carfixo ist ein kleines Unternehmen und deshalb vom förmlichen internen
    Beschwerdesystem (Art. 11) und der Benennung von Mediatoren (Art. 12) ausgenommen.
    Beschwerden laufen per E-Mail.
13. **DSA.** Art. 16 und 17 (Meldeweg, Begründung) sind umgesetzt. Von Art. 20–28 ist Carfixo
    als Kleinunternehmen weitgehend ausgenommen (Art. 19).
14. **Mindestalter 18** steht in den AGB. Die App prüft das Alter nicht.

## Wenn sich etwas ändert, Texte anpassen

- Sortierlogik der Suche (`assets/app.js`, Sortierung „Empfohlen“) → Abschnitt „Ranking“
- Stornoregel (`STORNO_HINWEIS` in `assets/app.js`) → AGB § 6
- Neue Drittanbieter, Analyse- oder Marketingdienste → Datenschutz; ab dann ist ein
  Einwilligungsbanner Pflicht
- Kostenpflichtige Leistungen (Premium-Abo, Provision) → AGB § 4 bzw. § 4 Betriebe,
  Muster-Widerrufsbelehrung, Widerrufsbutton, Kleinunternehmergrenze beachten

## iPhone-App: Kartendienst OpenFreeMap (neu)
In der App kommen Karten von OpenFreeMap (tiles.openfreemap.org) statt CARTO, weil CARTO
der App keine Kacheln ohne API-Schlüssel ausliefert. Prüfen: Betreiber/Sitz für die
Datenschutzerklärung ergänzen, Drittlandbezug klären, ob ein Auftragsverarbeitungsvertrag
nötig/möglich ist (öffentlicher Dienst ohne Vertrag – ggf. als eigenständig Verantwortlicher
einordnen). Eintrag steht in legal.html unter „Karten“.
