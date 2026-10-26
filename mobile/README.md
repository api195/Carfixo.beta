# Carfixo – iPhone-App

Capacitor-Hülle um die Web-App. Die Seiten (`app.html`, `legal.html`, `assets/`)
kommen aus dem Hauptordner. `build-www.js` kopiert sie nach `mobile/www` und
bindet die Capacitor-Skripte und `assets/native.js` ein. Die Website auf
carfixo.de bleibt davon unberührt.

## Auf dem Mac starten

Voraussetzungen: Xcode (App Store), Node.js LTS (nodejs.org), der Code per
GitHub Desktop geklont.

```bash
cd ~/Documents/GitHub/carfixo.beta/mobile
npm install
npm run ios        # baut www/, synchronisiert ins Xcode-Projekt, öffnet Xcode
```

In Xcode:
1. Links das blaue **App**-Projekt → Ziel **App** → **Signing & Capabilities** →
   **Team** = dein Developer-Account. Bundle Identifier: `de.carfixo.app`.
2. Oben ein Gerät wählen (Simulator oder das per Kabel verbundene iPhone) → ▶.
3. Echtes iPhone beim ersten Mal: Einstellungen → Datenschutz & Sicherheit →
   **Entwicklermodus** einschalten, iPhone neu starten.

Nach jeder Änderung an der Web-App: `npm run ios` (oder `npm run build && npx cap sync ios`).

## Was in der App anders ist

| Thema | Im Browser | In der App |
| --- | --- | --- |
| `/api/*` | relativ | `https://carfixo.de/api/*` (CORS in `vercel.json`) |
| Stripe, PDFs, externe Links | gleiche Seite / neuer Tab | Safari-Fenster über der App (`@capacitor/browser`); nach dem Schließen wird die Ansicht neu geladen |
| Links in E-Mails (Bestätigung, Passwort) | zurück zur Seite | `https://carfixo.de/app.html` (öffnet vorerst Safari) |
| Karte | Google Maps, wenn Key gesetzt | immer Leaflet (Browser-Key ist auf carfixo.de beschränkt) |
| Push | Web-Push | vorerst Hinweis „kommt mit dem nächsten Update“ |

Test ohne Mac: `node tests/app-ios.js` (vorher `npm install && npm run build` hier im Ordner).

## Native Funktionen (seit 26.10.2026)

| Funktion | Umsetzung |
| --- | --- |
| Vibration | `@capacitor/haptics` |
| Face ID (Anmeldung, App-Sperre) | `@capgo/capacitor-native-biometric`, Zugangsdaten im iOS-Schlüsselbund; `NSFaceIDUsageDescription` in `Info.plist` |
| Wisch vom Rand zurück | `CarfixoViewController` in `AppDelegate.swift` (`allowsBackForwardNavigationGestures`), im Storyboard eingetragen |
| Geräusch aufnehmen | Web-API `MediaRecorder`; `NSMicrophoneUsageDescription` in `Info.plist` |
| Route | `maps://` öffnet Apple Karten |

Nach dem Holen dieser Änderungen einmal `npm install` und `npm run ios` – sonst fehlen die
neuen Plugins in Xcode.

## Nächste Schritte

- Native Push über APNs (`@capacitor/push-notifications`, Schlüssel aus dem Apple-Developer-Konto)
- Live-Aktivität auf dem Sperrbildschirm / Dynamic Island für den laufenden Auftrag: braucht
  eine Widget-Erweiterung in Xcode (ActivityKit) und Updates per APNs – erst nach dem Push
- Universal Links, damit E-Mail-Links direkt die App öffnen
