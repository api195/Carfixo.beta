// ============================================================
// Carfixo – Seiten für die iPhone-App zusammenstellen
//
// Kopiert app.html, legal.html und assets/ aus dem Hauptordner nach
// mobile/www und bindet dort die Capacitor-Skripte ein. Die Website auf
// carfixo.de bleibt davon unberührt. Ausführen:  npm run build
// (danach "npx cap sync ios"; "npm run ios" macht beides und öffnet Xcode).
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(__dirname, "www");
const NM = path.join(__dirname, "node_modules", "@capacitor");

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(path.join(WWW, "assets", "native"), { recursive: true });

// Nur was die App braucht: keine Startseite, kein Admin, kein Service Worker.
for (const f of ["app.html", "legal.html", "favicon.png", "favicon.svg", "icon-192.png"]) {
  fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
}
fs.cpSync(path.join(ROOT, "assets"), path.join(WWW, "assets"), {
  recursive: true,
  filter: (src) => !/admin\.js$|hero\.jpg$/.test(src),
});

// Capacitor-Laufzeit und Plugins als fertige Browser-Skripte (kein Bundler nötig)
const PLUGINS = ["app", "browser", "status-bar", "splash-screen"];
fs.copyFileSync(path.join(NM, "core", "dist", "capacitor.js"), path.join(WWW, "assets", "native", "capacitor.js"));
for (const p of PLUGINS) {
  fs.copyFileSync(path.join(NM, p, "dist", "plugin.js"), path.join(WWW, "assets", "native", `${p}.js`));
}

// Vektorkarte für die App (assets/maps.js lädt sie nur in der App)
for (const f of ["maplibre-gl.js", "maplibre-gl.css"]) {
  fs.copyFileSync(path.join(__dirname, "node_modules", "maplibre-gl", "dist", f), path.join(WWW, "assets", "vendor", f));
}

const capTags = ["capacitor", ...PLUGINS].map(n => `<script src="assets/native/${n}.js"></script>`).join("\n");

function einbinden(datei) {
  const p = path.join(WWW, datei);
  let html = fs.readFileSync(p, "utf8");
  html = html.replace("</head>", `${capTags}\n</head>`);
  html = html.replace("</body>", '<script src="assets/native.js"></script>\n</body>');
  // Logo und "Startseite" führen in der App zu Home statt zur Website.
  html = html.replace(/href="index\.html"/g, 'href="app.html#/home"');
  fs.writeFileSync(p, html);
}
einbinden("app.html");
einbinden("legal.html");

// Capacitor startet index.html – direkt weiter in die App.
fs.writeFileSync(path.join(WWW, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>Carfixo</title>' +
  '<style>html,body{margin:0;background:#05070D}</style>' +
  '<script>location.replace("app.html" + (location.hash || "#/home"))</script>\n');

// Verweise in app.js auf index.html (z. B. "Zur Startseite") ebenfalls umbiegen.
const appJs = path.join(WWW, "assets", "app.js");
fs.writeFileSync(appJs, fs.readFileSync(appJs, "utf8").replace(/href="index\.html"/g, 'href="app.html#/home"'));

const n = (d) => fs.readdirSync(d, { recursive: true }).length;
console.log(`www/ fertig: ${n(WWW)} Dateien`);
