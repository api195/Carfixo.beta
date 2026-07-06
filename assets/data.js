// ============================================================
// Carfixo – Stammdaten: Kategorien, Services, Marken, Orte
// ============================================================
"use strict";

// 8 Kategorien (Schlüssel = DB-Werte) mit Unterbereichen (services)
const CATS = {
  reparatur: { icon: "🔧", name: "Reparatur & Diagnose", services: ["Bremsen","Motor","Getriebe","Auspuff","Fahrwerk","Elektrik","Diagnose","Zahnriemen","Kupplung","Unfallinstandsetzung"] },
  inspektion: { icon: "🛠️", name: "Inspektion & Wartung", services: ["Kleine Inspektion","Große Inspektion","Ölwechsel","Nach Herstellervorgabe","Bremsflüssigkeit","Filterwechsel"] },
  reifen: { icon: "🛞", name: "Reifen & Felgen", services: ["Reifenwechsel","Montage","Wuchten","Einlagerung","Felgenreparatur","Achsvermessung"] },
  pflege: { icon: "✨", name: "Aufbereitung & Pflege", services: ["Innenreinigung","Außenaufbereitung","Politur","Keramikversiegelung","Geruchsentfernung","Lederpflege"] },
  lack: { icon: "🎨", name: "Lackierung & Folierung", services: ["Lackierung","Folierung","Smart Repair","Steinschlag","Scheibentönung"] },
  tuning: { icon: "🏎️", name: "Tuning & Codierung", services: ["Softwareoptimierung","Codierung","Auspuffanlage","Fahrwerk","Felgen","Optik","Leistungssteigerung"] },
  tuev: { icon: "📋", name: "TÜV / HU / AU", services: ["HU","AU","Vorabcheck","Nachuntersuchung","Änderungsabnahme","Gutachten"] },
  klima: { icon: "❄️", name: "Klima & Elektrik", services: ["Klimaservice","Klimareparatur","Elektrik-Diagnose","Batterie","Standheizung"] },
};

// Die 4 Welten (Gruppierung der Kategorien für Suche/Anzeige)
const WORLDS = [
  { key: "werkstatt", icon: "🔧", name: "Werkstatt", cats: ["reparatur","inspektion","reifen","klima"] },
  { key: "tuning", icon: "🏎️", name: "Tuning", cats: ["tuning"] },
  { key: "pflege", icon: "✨", name: "Aufbereitung", cats: ["pflege","lack"] },
  { key: "tuev", icon: "📋", name: "TÜV & Prüfung", cats: ["tuev"] },
];

const BRANDS = {
  "BMW":["1er","2er","3er","4er","5er","7er","X1","X3","X5","Z4","i3","i4"],
  "Audi":["A1","A3","A4","A5","A6","Q2","Q3","Q5","Q7","TT","e-tron"],
  "Mercedes-Benz":["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","CLA","GLA","GLC","GLE","Vito"],
  "Volkswagen":["Polo","Golf","Passat","Arteon","T-Roc","Tiguan","Touran","Touareg","Caddy","ID.3","ID.4","up!"],
  "Opel":["Corsa","Astra","Insignia","Mokka","Crossland","Grandland","Zafira"],
  "Ford":["Fiesta","Focus","Mondeo","Kuga","Puma","EcoSport","S-MAX","Transit"],
  "Seat":["Ibiza","Leon","Ateca","Arona","Tarraco","Alhambra"],
  "Skoda":["Fabia","Octavia","Superb","Kamiq","Karoq","Kodiaq","Scala"],
  "Porsche":["911","718 Boxster/Cayman","Panamera","Macan","Cayenne","Taycan"],
  "Toyota":["Aygo","Yaris","Corolla","C-HR","RAV4","Camry","Prius"],
  "Renault":["Twingo","Clio","Captur","Megane","Kadjar","Scenic","Zoe"],
  "Hyundai":["i10","i20","i30","Kona","Tucson","Santa Fe","Ioniq"],
  "Kia":["Picanto","Rio","Ceed","Stonic","Sportage","Niro","Sorento"],
  "Nissan":["Micra","Note","Juke","Qashqai","X-Trail","Leaf"],
  "Mazda":["2","3","6","CX-3","CX-30","CX-5","MX-5"],
  "Peugeot":["108","208","308","508","2008","3008","5008"],
  "Tesla":["Model 3","Model S","Model X","Model Y"],
};
const SERIES = {
  "BMW|1er":["E87","F20","F40"],"BMW|3er":["E46","E90","E91","F30","F31","G20","G21"],
  "BMW|5er":["E60","F10","F11","G30","G31"],"BMW|X3":["E83","F25","G01"],"BMW|X5":["E70","F15","G05"],
  "Audi|A3":["8P","8V","8Y"],"Audi|A4":["B7","B8","B9"],"Audi|A6":["C6","C7","C8"],"Audi|Q5":["8R","FY"],
  "Mercedes-Benz|A-Klasse":["W169","W176","W177"],"Mercedes-Benz|C-Klasse":["W204","W205","W206"],
  "Mercedes-Benz|E-Klasse":["W212","W213"],"Mercedes-Benz|GLC":["X253","X254"],
  "Volkswagen|Polo":["9N","6R","AW"],"Volkswagen|Golf":["V","VI","VII","VIII"],
  "Volkswagen|Passat":["B6","B7","B8"],"Volkswagen|Tiguan":["I (5N)","II (AD1)"],
  "Opel|Corsa":["D","E","F"],"Opel|Astra":["H","J","K","L"],
  "Ford|Fiesta":["MK7","MK8"],"Ford|Focus":["MK3","MK4"],
  "Skoda|Octavia":["II","III","IV"],"Skoda|Fabia":["II","III","IV"],
  "Seat|Leon":["1P","5F","KL"],"Porsche|911":["997","991","992"],
  "Toyota|Yaris":["XP13","XP21"],"Renault|Clio":["IV","V"],
  "Hyundai|i30":["GD","PD"],"Kia|Ceed":["JD","CD"],"Peugeot|208":["I","II"],
};
const BODIES = ["Limousine","Kombi","Coupé","Cabriolet","Schrägheck","SUV / Geländewagen","Van","Kleinwagen","Pickup"];
const FUELS = ["Benzin","Diesel","Hybrid","Plug-in-Hybrid","Elektro","Autogas (LPG/CNG)"];
const TRANS = ["Manuell","Automatik","DSG / Doppelkupplung"];
const PS_LIST = [60,75,90,102,110,116,122,136,150,163,184,190,204,231,245,286,306,340,400,450,510];
const ENGINES = {
  "BMW":["116i","118i","118d","316i","318i","320i","330i","340i","316d","318d","320d","330d","520d","530d","M-Modell","Elektro","Sonstige"],
  "Mercedes-Benz":["A180","A200","A220d","C180","C200","C220d","C300","E200","E220d","E350","GLC220d","AMG","Elektro","Sonstige"],
  "Audi":["1.0 TFSI","1.4 TFSI","2.0 TFSI","3.0 TFSI","30 TDI","35 TDI","2.0 TDI","3.0 TDI","S/RS","e-tron","Sonstige"],
  "Volkswagen":["1.0 TSI","1.2 TSI","1.4 TSI","1.5 TSI","2.0 TSI","1.6 TDI","2.0 TDI","GTI","GTD","R","Elektro","Sonstige"],
  "Tesla":["Standard Range","Long Range","Performance","Plaid"],
};
const ENGINE_DEFAULT = ["1.0","1.2","1.4","1.5","1.6","1.8","2.0","2.2","2.5","3.0","Elektro","Sonstige"];
const KM_STEPS = [[25000,"bis 25.000 km"],[50000,"bis 50.000 km"],[75000,"bis 75.000 km"],[100000,"bis 100.000 km"],[150000,"bis 150.000 km"],[200000,"bis 200.000 km"],[250000,"bis 250.000 km"],[300000,"über 250.000 km"]];

// Kölner Stadtteile mit Koordinaten (für Umkreis/Distanz & Onboarding)
const DISTRICTS = {
  "Innenstadt":[50.9375,6.9603],"Deutz":[50.9396,6.9757],"Ehrenfeld":[50.9515,6.9173],
  "Nippes":[50.9645,6.9530],"Lindenthal":[50.9256,6.8784],"Sülz":[50.9166,6.9280],
  "Kalk":[50.9403,7.0100],"Mülheim":[50.9631,7.0080],"Porz":[50.8860,7.0580],
  "Chorweiler":[51.0280,6.8980],"Rodenkirchen":[50.8930,6.9950],"Zollstock":[50.9070,6.9430],
  "Dellbrück":[50.9760,7.0640],"Bickendorf":[50.9600,6.8870],"Weiden":[50.9400,6.8330],
};
const CITY_CENTER = [50.9375, 6.9603];

const BK_STATUS = {
  confirmed:["Gebucht","b-blue"], ready:["Termin bestätigt","b-purple"],
  in_progress:["In Arbeit","b-gold"], completed:["Abgeschlossen","b-green"],
  cancelled:["Storniert","b-red"],
};

// Einfache regelbasierte Beta-„KI"-Analyse (ehrlich als Beta gekennzeichnet)
const AI_RULES = [
  { kw:["quietsch","bremse","bremsen","schleif"], cat:"reparatur", service:"Bremsen", guess:"Verschlissene Bremsbeläge oder -scheiben", conf:"hoch" },
  { kw:["motorkontrollleuchte","mkl","motorleuchte","check engine"], cat:"reparatur", service:"Diagnose", guess:"Fehlereintrag im Motorsteuergerät – Diagnose nötig", conf:"hoch" },
  { kw:["klima","kühlt nicht","warme luft"], cat:"klima", service:"Klimaservice", guess:"Kältemittel niedrig oder Kompressorproblem", conf:"mittel" },
  { kw:["batterie","springt nicht an","startet nicht","anlasser"], cat:"klima", service:"Batterie", guess:"Schwache Batterie oder Anlasser-/Ladeproblem", conf:"mittel" },
  { kw:["reifen","platt","profil","vibrier"], cat:"reifen", service:"Reifenwechsel", guess:"Reifenschaden oder Unwucht", conf:"mittel" },
  { kw:["klapper","poltern","fahrwerk","stoßdämpfer","schlägt"], cat:"reparatur", service:"Fahrwerk", guess:"Ausgeschlagene Fahrwerkskomponente (Koppelstange, Traggelenk)", conf:"mittel" },
  { kw:["öl","ölfleck","verliert","tropft"], cat:"reparatur", service:"Motor", guess:"Undichtigkeit (Ölwanne, Ventildeckel, Simmerring)", conf:"mittel" },
  { kw:["kupplung","rutscht","gang"], cat:"reparatur", service:"Kupplung", guess:"Verschlissene Kupplung oder Getriebeproblem", conf:"mittel" },
  { kw:["auspuff","laut","brummt","abgas"], cat:"reparatur", service:"Auspuff", guess:"Undichte oder defekte Abgasanlage", conf:"mittel" },
  { kw:["kratzer","delle","beule","lack"], cat:"lack", service:"Smart Repair", guess:"Lack-/Karosserieschaden – Smart Repair möglich", conf:"mittel" },
  { kw:["tüv","hu","plakette"], cat:"tuev", service:"HU", guess:"Hauptuntersuchung fällig", conf:"hoch" },
  { kw:["zahnriemen","steuerkette","rasselt"], cat:"reparatur", service:"Zahnriemen", guess:"Zahnriemen-/Steuerkettenservice empfohlen", conf:"mittel" },
];
function aiAnalyze(text) {
  const t = (text || "").toLowerCase();
  const hits = AI_RULES.filter(r => r.kw.some(k => t.includes(k)));
  return hits.slice(0, 3);
}

// Helfer
function carLabel(v) {
  if (!v) return "";
  const parts = [v.make + " " + v.model];
  if (v.series && v.series !== "Keine Angabe") parts[0] += " " + v.series;
  if (v.engine) parts.push(v.engine);
  if (v.fuel) parts.push(v.fuel);
  if (v.power_ps) parts.push(v.power_ps + " PS");
  if (v.year) parts.push("BJ " + v.year);
  return parts.join(" · ");
}
function distKm(a, b) {
  if (!a || !b || a[0] == null || b[0] == null) return null;
  const R = 6371, dLat = (b[0]-a[0]) * Math.PI/180, dLng = (b[1]-a[1]) * Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function fmtDate(d){ try { return new Date(d).toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"}); } catch(e){ return String(d); } }
function fmtDateTime(d){ try { return new Date(d).toLocaleString("de-DE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); } catch(e){ return String(d); } }
function fmtEur(n){ return (Math.round(Number(n)*100)/100).toLocaleString("de-DE",{minimumFractionDigits:0,maximumFractionDigits:2}) + " €"; }
function stars(avg){ const n = Math.round(Number(avg)||0); return "★".repeat(n) + "☆".repeat(5-n); }
