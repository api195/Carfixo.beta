// ============================================================
// Carfixo – helles Design aus dem dunklen ableiten
//
// Liest assets/app.css und schreibt assets/light.css: für jede Regel mit
// dunklen Farben eine Gegenregel unter html[data-theme="light"]. So bleibt
// das helle Design vollständig, auch wenn app.css wächst.
//
//   node tools/theme/make-light.js      (nach jeder Änderung an app.css)
//
// Von Hand gepflegte Feinheiten stehen unten in HANDARBEIT.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const css = fs.readFileSync(path.join(ROOT, "assets", "app.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const P = 'html[data-theme="light"]';

// Dunkle Flächen -> helle Flächen
const FLAECHE = {
  "#05070D": "#F3F5F9", "#080B14": "#EEF1F6", "#0A0E1A": "#F3F5F9", "#0A101E": "#FFFFFF",
  "#0C111D": "#FFFFFF", "#101726": "#F8FAFD", "#111827": "#FFFFFF", "#111725": "#FFFFFF",
  "#141B29": "#EEF1F6", "#171E2B": "#E9EDF3", "#1A2233": "#EEF1F6", "#222B3B": "#F1F4F8",
};
// Helle Pastell-Schrift (für dunklen Grund) -> kräftige Schrift für hellen Grund
const SCHRIFT = {
  "#C9D3E3": "#2A3445", "#EBC172": "#9A6400", "#8FE7BF": "#0E8A55", "#FF9C9C": "#C62B2B",
  "#7D8AA0": "#7A8698", "#5F6E82": "#8592A6", "#93A5BC": "#5B6678", "#EAF0F9": "#0E1523",
};
// Auf farbigen Knöpfen, Badges usw. bleibt weiße Schrift weiß
const FARBIG = /#2E77FF|#0A47C2|#1E6BFF|var\(--blue\)|var\(--green\)|var\(--red\)|#2BD58A|#FF5C5C|#E5484D|gradient\(135deg/i;
const SEL_FARBIG = /\.btn|\.on\b|Go\b|Promo|avatar|badge|Dot|Pulse|\.red|\.green|fCount|Rank|::selection/i;

function rgbaHell(a) { return `rgba(15,23,42,${a})`; }
function mappeWert(prop, v, regel) {
  let n = v;
  // weiße Transparenz (Linien, Flächen) -> dunkle Transparenz
  n = n.replace(/rgba\(255,\s*255,\s*255,\s*([.\d]+)\)/g, (_, a) => rgbaHell(a));
  // dunkle Transparenz-Flächen (Glas, Topbar, Karten) -> weißes Glas
  n = n.replace(/rgba\((?:3,5,10|5,7,13|6,9,16|8,12,22|17,23,37|10,14,26),\s*([.\d]+)\)/g, (m, a) =>
    /backdrop|sheetBack|lightbox|modal\b/i.test(regel.sel) ? m : `rgba(255,255,255,${Math.max(+a, 0.82)})`);
  for (const [d, h] of Object.entries(FLAECHE)) n = n.replace(new RegExp(d + "(?![0-9A-Fa-f])", "gi"), h);
  if (prop === "color" || prop === "fill" || prop === "stroke") {
    for (const [d, h] of Object.entries(SCHRIFT)) n = n.replace(new RegExp(d + "(?![0-9A-Fa-f])", "gi"), h);
    if (/^#fff(fff)?$/i.test(n.trim()) && !FARBIG.test(regel.body) && !SEL_FARBIG.test(regel.sel)) n = "var(--ink)";
  }
  return n;
}

// ---------- einfacher Parser: @media-Blöcke und Regeln ----------
const out = [];
function lauf(text, prelude) {
  let i = 0;
  while (i < text.length) {
    const auf = text.indexOf("{", i);
    if (auf < 0) break;
    const kopf = text.slice(i, auf).trim();
    // passende schließende Klammer finden
    let tiefe = 1, j = auf + 1;
    while (j < text.length && tiefe) { if (text[j] === "{") tiefe++; else if (text[j] === "}") tiefe--; j++; }
    const inhalt = text.slice(auf + 1, j - 1);
    if (kopf.startsWith("@media") || kopf.startsWith("@supports")) lauf(inhalt, kopf);
    else if (!kopf.startsWith("@")) regel(kopf, inhalt, prelude);
    i = j;
  }
}
function regel(sel, body, prelude) {
  if (sel.includes(":root") || sel === "*") return;
  const neu = [];
  for (const d of body.split(";")) {
    const k = d.indexOf(":");
    if (k < 0) continue;
    const prop = d.slice(0, k).trim(), val = d.slice(k + 1).trim();
    if (!/^(background|background-color|background-image|border|border-[a-z-]+|box-shadow|outline|color|fill|stroke|caret-color)$/.test(prop)) continue;
    const m = mappeWert(prop, val, { sel, body });
    if (m !== val) neu.push(`${prop}:${m}`);
  }
  if (!neu.length) return;
  // "html.appui x" -> 'html[data-theme="light"].appui x', sonst Präfix davor
  const s = sel.split(",").map(x => x.trim())
    .map(x => /^html\b/.test(x) ? x.replace(/^html/, P) : `${P} ${x}`).join(",");
  out.push({ prelude, text: `${s}{${neu.join(";")}}` });
}
lauf(css, null);

const HANDARBEIT = `
${P}{--bg:#F3F5F9;--bg2:#EEF1F6;--panel:#FFFFFF;--panel2:#F8FAFD;--line:rgba(15,23,42,.09);--line2:rgba(15,23,42,.16);
  --ink:#0E1523;--muted:#5B6678;--blue2:#1E6BFF;--green:#12A866;--gold:#C98500;--red:#E0393E;--purple:#7C5CFF;color-scheme:light}
${P} body::before{background:radial-gradient(1100px 640px at 12% -8%,rgba(30,107,255,.08),transparent 60%),linear-gradient(180deg,#F7F9FC 0%,#F3F5F9 100%)}
${P} body::after{background-image:linear-gradient(rgba(15,23,42,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.03) 1px,transparent 1px)}
${P} .card{box-shadow:0 1px 2px rgba(15,23,42,.05),0 6px 18px rgba(15,23,42,.05)}
${P} input,${P} select,${P} textarea{background:#fff;color:var(--ink)}
${P} .topNav a:hover,${P} .topNav a.on{color:var(--ink)}
${P} .hmTileImg{background:linear-gradient(160deg,#F1F3F7,#E6EAF0);box-shadow:inset 0 0 0 1px rgba(15,23,42,.05)}
${P} .hmTile{color:#2A3445}
${P} .hmSearch input{background:none}
${P} .tabbar a{color:#8592A6}
${P} .tabbar a.on{color:var(--blue)}
${P} .hmTitle{color:var(--ink)}
${P} ::selection{background:rgba(30,107,255,.2)}
`;

const gruppen = new Map();
for (const r of out) { if (!gruppen.has(r.prelude)) gruppen.set(r.prelude, []); gruppen.get(r.prelude).push(r.text); }
let erg = "/* Automatisch erzeugt aus app.css von tools/theme/make-light.js – nicht von Hand ändern. */\n";
for (const [pre, regeln] of gruppen) erg += pre ? `${pre}{\n${regeln.join("\n")}\n}\n` : regeln.join("\n") + "\n";
erg += "/* Handarbeit */" + HANDARBEIT;
fs.writeFileSync(path.join(ROOT, "assets", "light.css"), erg);
console.log(`light.css: ${out.length} Regeln`);
