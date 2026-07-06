// ============================================================
// Carfixo – Stammdaten: Kategorien, Services, Marken, Orte,
// Preisorientierung, Warnleuchten, Geräusche, Notfälle
// ============================================================
"use strict";

// 13 Hauptkategorien (Schlüssel = DB-Werte) mit Unterkategorien
const CATS = {
  reparatur: { icon: "🔧", name: "Reparatur & Diagnose", services: ["Motor","Getriebe","Bremsen","Fahrwerk","Elektrik","Batterie","Auspuff","Kupplung","Steuerkette","Zahnriemen","Motorkontrollleuchte","Geräusche","Vibrationen","Ölverlust","Kühlmittelverlust","Startprobleme"] },
  inspektion: { icon: "🛠️", name: "Inspektion & Wartung", services: ["Kleine Inspektion","Große Inspektion","Ölwechsel","Nach Herstellervorgabe","Bremsflüssigkeit","Filterwechsel","Zündkerzen","Wartungsintervall"] },
  reifen: { icon: "🛞", name: "Reifen & Felgen", services: ["Reifenwechsel","Montage","Wuchten","Einlagerung","Felgenreparatur","Achsvermessung","Reifenreparatur","RDKS-Service"] },
  karosserie: { icon: "🚘", name: "Karosserie & Unfall", services: ["Unfallinstandsetzung","Dellenentfernung","Hagelschaden","Rostbeseitigung","Stoßstange","Kotflügel","Ausbeulen ohne Lackieren","Gutachten-Vorbereitung"] },
  lack: { icon: "🎨", name: "Lackierung & Folierung", services: ["Lackierung","Folierung","Smart Repair","Steinschlag-Lack","Scheibentönung","Teilfolierung","Lackversiegelung"] },
  pflege: { icon: "✨", name: "Aufbereitung & Pflege", services: ["Innenreinigung","Außenaufbereitung","Politur","Keramikversiegelung","Geruchsentfernung","Lederpflege","Motorwäsche","Polsterreinigung"] },
  klima: { icon: "❄️", name: "Klimaanlage", services: ["Klimaservice","Klimareparatur","Klimadesinfektion","Kältemittel","Klimakompressor"] },
  tuev: { icon: "📋", name: "TÜV / HU / AU", services: ["HU","AU","Vorabcheck","Nachuntersuchung","Änderungsabnahme","Gutachten","Gasanlagenprüfung"] },
  tuning: { icon: "🏎️", name: "Tuning & Codierung", services: ["Softwareoptimierung","Codierung","Auspuffanlage","Fahrwerk-Tuning","Felgen-Umbau","Optik","Leistungssteigerung","Eintragung"] },
  autoglas: { icon: "🪟", name: "Autoglas", services: ["Steinschlagreparatur","Frontscheibe wechseln","Seitenscheibe","Heckscheibe","Scheibenversiegelung","Kalibrierung Assistenzsysteme"] },
  schluessel: { icon: "🔑", name: "Schlüssel & Fahrzeugdiagnose", services: ["Schlüssel nachmachen","Schlüssel anlernen","Funkschlüssel-Reparatur","Wegfahrsperre","Steuergeräte-Diagnose","Fehlerspeicher auslesen"] },
  oldtimer: { icon: "🚗", name: "Oldtimer", services: ["Oldtimer-Wartung","Restauration","Vergaser-Einstellung","H-Kennzeichen-Vorbereitung","Ersatzteilsuche","Wertgutachten"] },
  eauto: { icon: "⚡", name: "E-Auto & Hybrid", services: ["HV-Batterie-Check","E-Antrieb-Diagnose","Ladeelektronik","Hybrid-Service","HV-Reparatur","Wallbox-Beratung","Batteriezertifikat"] },
};

// Die 4 Welten (Gruppierung für Suche/Anzeige)
const WORLDS = [
  { key: "werkstatt", icon: "🔧", name: "Werkstatt", cats: ["reparatur","inspektion","reifen","klima","karosserie","autoglas","schluessel","eauto","oldtimer"] },
  { key: "tuning", icon: "🏎️", name: "Tuning", cats: ["tuning"] },
  { key: "pflege", icon: "✨", name: "Aufbereitung", cats: ["pflege","lack"] },
  { key: "tuev", icon: "📋", name: "TÜV & Prüfung", cats: ["tuev"] },
];

const BRANDS = {
  "Alfa Romeo":["Giulia","Giulietta","Stelvio","Tonale","MiTo"],
  "Audi":["A1","A3","A4","A5","A6","A7","A8","Q2","Q3","Q5","Q7","Q8","TT","e-tron","RS-Modelle"],
  "BMW":["1er","2er","3er","4er","5er","6er","7er","8er","X1","X2","X3","X4","X5","X6","X7","Z4","i3","i4","iX","M-Modelle"],
  "BYD":["Atto 3","Dolphin","Seal","Han","Tang"],
  "Citroën":["C1","C3","C4","C5","Berlingo","Jumper","DS3"],
  "Cupra":["Leon","Formentor","Born","Ateca","Tavascan"],
  "Dacia":["Sandero","Duster","Logan","Jogger","Spring"],
  "Fiat":["500","Panda","Tipo","Punto","Ducato","Doblo"],
  "Ford":["Fiesta","Focus","Mondeo","Kuga","Puma","EcoSport","S-MAX","Galaxy","Mustang","Ranger","Transit"],
  "Honda":["Jazz","Civic","CR-V","HR-V","Accord","e:Ny1"],
  "Hyundai":["i10","i20","i30","Kona","Tucson","Santa Fe","Ioniq 5","Ioniq 6","Bayon"],
  "Jaguar":["XE","XF","F-Pace","E-Pace","I-Pace","F-Type"],
  "Jeep":["Renegade","Compass","Wrangler","Grand Cherokee","Avenger"],
  "Kia":["Picanto","Rio","Ceed","Stonic","Sportage","Niro","Sorento","EV6","EV9"],
  "Land Rover":["Defender","Discovery","Range Rover","Range Rover Sport","Evoque","Velar"],
  "Mazda":["2","3","6","CX-3","CX-30","CX-5","CX-60","MX-5","MX-30"],
  "Mercedes-Benz":["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","CLA","CLS","GLA","GLB","GLC","GLE","GLS","V-Klasse","Vito","Sprinter","EQA","EQB","EQC","EQE","EQS","AMG-Modelle"],
  "Mini":["Cooper","Cooper S","Clubman","Countryman","Cabrio","Electric"],
  "Mitsubishi":["Space Star","ASX","Eclipse Cross","Outlander","L200"],
  "Nissan":["Micra","Note","Juke","Qashqai","X-Trail","Leaf","Ariya","Navara"],
  "Opel":["Corsa","Astra","Insignia","Mokka","Crossland","Grandland","Zafira","Combo","Vivaro"],
  "Peugeot":["108","208","308","408","508","2008","3008","5008","Partner","Boxer"],
  "Polestar":["Polestar 1","Polestar 2","Polestar 3","Polestar 4"],
  "Porsche":["911","718 Boxster/Cayman","Panamera","Macan","Cayenne","Taycan"],
  "Renault":["Twingo","Clio","Captur","Megane","Austral","Scenic","Kangoo","Zoe","Master"],
  "Seat":["Ibiza","Leon","Ateca","Arona","Tarraco","Alhambra","Mii"],
  "Skoda":["Fabia","Octavia","Superb","Kamiq","Karoq","Kodiaq","Scala","Enyaq","Citigo"],
  "Smart":["ForTwo","ForFour","#1","#3"],
  "Subaru":["Impreza","XV","Forester","Outback","BRZ"],
  "Suzuki":["Swift","Ignis","Vitara","S-Cross","Jimny"],
  "Tesla":["Model 3","Model S","Model X","Model Y","Cybertruck"],
  "Toyota":["Aygo","Yaris","Corolla","C-HR","RAV4","Camry","Prius","Hilux","Proace","bZ4X"],
  "Volkswagen":["Polo","Golf","Passat","Arteon","T-Roc","T-Cross","Tiguan","Touran","Touareg","Sharan","Caddy","Transporter","Amarok","ID.3","ID.4","ID.5","ID.7","ID. Buzz","up!"],
  "Volvo":["V40","V60","V90","S60","S90","XC40","XC60","XC90","EX30","EX90"],
};
const SERIES = {
  "BMW|1er":["E81/E87","F20/F21","F40"],"BMW|2er":["F22","F44 Gran Coupé","G42"],
  "BMW|3er":["E46","E90/E91","F30/F31","G20/G21"],"BMW|4er":["F32/F33","G22/G23"],
  "BMW|5er":["E60/E61","F10/F11","G30/G31","G60"],"BMW|7er":["E65","F01","G11","G70"],
  "BMW|X1":["E84","F48","U11"],"BMW|X3":["E83","F25","G01"],"BMW|X5":["E70","F15","G05"],
  "Audi|A1":["8X","GB"],"Audi|A3":["8P","8V","8Y"],"Audi|A4":["B7","B8","B9"],
  "Audi|A5":["8T","F5"],"Audi|A6":["C6","C7","C8"],"Audi|Q3":["8U","F3"],"Audi|Q5":["8R","FY"],
  "Mercedes-Benz|A-Klasse":["W169","W176","W177"],"Mercedes-Benz|B-Klasse":["W245","W246","W247"],
  "Mercedes-Benz|C-Klasse":["W204","W205","W206"],"Mercedes-Benz|E-Klasse":["W211","W212","W213","W214"],
  "Mercedes-Benz|S-Klasse":["W221","W222","W223"],"Mercedes-Benz|GLC":["X253","X254"],
  "Volkswagen|Polo":["9N","6R/6C","AW"],"Volkswagen|Golf":["IV","V","VI","VII","VIII"],
  "Volkswagen|Passat":["B6","B7","B8","B9"],"Volkswagen|Tiguan":["I (5N)","II (AD1)","III"],
  "Volkswagen|Touran":["I (1T)","II (5T)"],"Volkswagen|Transporter":["T5","T6","T6.1","T7"],
  "Opel|Corsa":["D","E","F"],"Opel|Astra":["H","J","K","L"],
  "Ford|Fiesta":["MK6","MK7","MK8"],"Ford|Focus":["MK2","MK3","MK4"],"Ford|Kuga":["I","II","III"],
  "Skoda|Octavia":["I","II","III","IV"],"Skoda|Fabia":["I","II","III","IV"],"Skoda|Superb":["II","III","IV"],
  "Seat|Ibiza":["6L","6J","KJ"],"Seat|Leon":["1M","1P","5F","KL"],
  "Porsche|911":["996","997","991","992"],"Porsche|Cayenne":["955","958","9YA"],
  "Toyota|Yaris":["XP9","XP13","XP21"],"Toyota|Corolla":["E12","E16","E21"],
  "Renault|Clio":["III","IV","V"],"Renault|Megane":["III","IV","E-Tech"],
  "Hyundai|i30":["FD","GD","PD"],"Hyundai|Tucson":["TL","NX4"],
  "Kia|Ceed":["ED","JD","CD"],"Kia|Sportage":["QL","NQ5"],
  "Peugeot|208":["I","II"],"Peugeot|308":["I","II","III"],
  "Fiat|500":["312 (Benzin)","500e"],"Mini|Cooper":["R56","F56","J01"],
  "Volvo|XC60":["I","II"],"Mazda|3":["BL","BM","BP"],
  "Mercedes-Benz|Sprinter":["W906","W907"],"Tesla|Model 3":["Pre-Facelift","Highland"],
};
const BODIES = ["Limousine","Kombi","Coupé","Cabriolet","Schrägheck","SUV / Geländewagen","Van","Kleinwagen","Pickup","Transporter"];
const FUELS = ["Benzin","Diesel","Hybrid","Plug-in-Hybrid","Elektro","Autogas (LPG/CNG)","Wasserstoff"];
const TRANS = ["Manuell","Automatik","DSG / Doppelkupplung"];
const PS_LIST = [45,54,60,68,75,82,90,95,102,110,116,122,131,136,140,150,163,170,184,190,204,218,231,245,258,272,286,306,326,340,360,400,420,450,476,510,550,585,625];
const ENGINES = {
  "BMW":["114i","116i","118i","120i","118d","120d","316i","318i","320i","330i","340i","316d","318d","320d","330d","520i","520d","530d","540i","M-Modell","Elektro (i)","Sonstige"],
  "Mercedes-Benz":["A160","A180","A200","A220d","A250","C180","C200","C220d","C300","E200","E220d","E300","E350","GLC200","GLC220d","AMG","EQ (Elektro)","Sonstige"],
  "Audi":["25 TFSI","30 TFSI","35 TFSI","40 TFSI","45 TFSI","2.0 TFSI","3.0 TFSI","30 TDI","35 TDI","40 TDI","2.0 TDI","3.0 TDI","S/RS","e-tron","Sonstige"],
  "Volkswagen":["1.0 TSI","1.2 TSI","1.4 TSI","1.5 TSI","2.0 TSI","1.6 TDI","2.0 TDI","GTI","GTD","R","ID (Elektro)","Sonstige"],
  "Tesla":["Standard Range","Long Range","Performance","Plaid"],
  "Porsche":["Basis","S","GTS","Turbo","Turbo S","GT3","E-Hybrid","Elektro (Taycan)"],
};
const ENGINE_DEFAULT = ["1.0","1.2","1.4","1.5","1.6","1.8","2.0","2.2","2.5","3.0","Elektro","Hybrid","Sonstige"];
const KM_STEPS = [[10000,"bis 10.000 km"],[25000,"bis 25.000 km"],[50000,"bis 50.000 km"],[75000,"bis 75.000 km"],[100000,"bis 100.000 km"],[125000,"bis 125.000 km"],[150000,"bis 150.000 km"],[200000,"bis 200.000 km"],[250000,"bis 250.000 km"],[300000,"über 250.000 km"]];

// Kölner Stadtteile (Schnellauswahl) – Suche funktioniert deutschlandweit über Geocoding
const DISTRICTS = {
  "Innenstadt":[50.9375,6.9603],"Deutz":[50.9396,6.9757],"Ehrenfeld":[50.9515,6.9173],
  "Nippes":[50.9645,6.9530],"Lindenthal":[50.9256,6.8784],"Sülz":[50.9166,6.9280],
  "Kalk":[50.9403,7.0100],"Mülheim":[50.9631,7.0080],"Porz":[50.8860,7.0580],
  "Chorweiler":[51.0280,6.8980],"Rodenkirchen":[50.8930,6.9950],"Zollstock":[50.9070,6.9430],
  "Dellbrück":[50.9760,7.0640],"Bickendorf":[50.9600,6.8870],"Weiden":[50.9400,6.8330],
};
const CITY_CENTER = [50.9375, 6.9603];
const RADIUS_STEPS = [5, 10, 25, 50];

const BK_STATUS = {
  confirmed:["Gebucht","b-blue"], ready:["Termin bestätigt","b-purple"],
  vehicle_received:["Fahrzeug angenommen","b-blue"], diagnosing:["Diagnose läuft","b-gold"],
  in_progress:["Reparatur läuft","b-gold"], approval_needed:["Zusatzfreigabe nötig","b-red"],
  ready_for_pickup:["Fahrzeug abholbereit","b-green"], completed:["Abgeschlossen","b-green"],
  cancelled:["Storniert","b-red"],
};
// Reihenfolge für die Status-Timeline des Kunden
const BK_FLOW = ["confirmed","ready","vehicle_received","diagnosing","in_progress","ready_for_pickup","completed"];

// ---------- Preisorientierung (unverbindlich!) ----------
// Spannen in € für ein Mittelklasse-Fahrzeug; Multiplikator nach Fahrzeugklasse
const PRICE_GUIDE = {
  "Bremsen": [250, 450, "Bremsbeläge + ggf. Scheiben (vorne)"],
  "Ölwechsel": [90, 180, "inkl. Öl und Filter"],
  "Kleine Inspektion": [150, 300, ""],
  "Große Inspektion": [300, 650, ""],
  "Klimaservice": [80, 180, "inkl. Kältemittel"],
  "HU": [120, 160, "HU + AU gesamt"],
  "AU": [40, 80, ""],
  "Reifenwechsel": [30, 80, "umstecken & wuchten"],
  "Montage": [60, 140, "4 Reifen auf Felge"],
  "Batterie": [150, 350, "inkl. Batterie + Anlernen"],
  "Zahnriemen": [500, 1100, "inkl. Wasserpumpe"],
  "Steuerkette": [900, 2200, ""],
  "Kupplung": [800, 1800, ""],
  "Auspuff": [200, 700, "je nach Bauteil"],
  "Motorkontrollleuchte": [60, 120, "Diagnose / Fehlerspeicher"],
  "Fehlerspeicher auslesen": [40, 90, ""],
  "Achsvermessung": [80, 160, ""],
  "Steinschlagreparatur": [80, 150, ""],
  "Frontscheibe wechseln": [400, 900, "inkl. Kalibrierung teurer"],
  "Politur": [150, 400, ""],
  "Keramikversiegelung": [400, 1200, ""],
  "Innenreinigung": [80, 250, ""],
  "Softwareoptimierung": [400, 900, "inkl. Abstimmung"],
  "Fahrwerk": [300, 900, "je nach Bauteil"],
  "Stoßdämpfer": [400, 800, "pro Achse"],
  "Getriebe": [500, 3500, "stark bauteilabhängig"],
  "Motor": [200, 5000, "stark befundabhängig"],
  "Ölverlust": [150, 800, "je nach Leckstelle"],
  "Startprobleme": [80, 500, "Diagnose + Ursache"],
  "Dellenentfernung": [80, 300, "pro Delle"],
  "Smart Repair": [80, 300, ""],
};
// Fahrzeugklassen-Multiplikator (grob nach PS + Marke)
function vehicleFactor(v) {
  if (!v) return 1;
  let f = 1;
  const premium = ["BMW","Mercedes-Benz","Audi","Porsche","Land Rover","Jaguar","Tesla","Volvo","Polestar"];
  if (premium.includes(v.make)) f += 0.25;
  if ((v.power_ps || 0) > 250) f += 0.2;
  else if ((v.power_ps || 0) > 150) f += 0.1;
  if (v.make === "Porsche") f += 0.3;
  return f;
}
function priceRange(service, v) {
  const g = PRICE_GUIDE[service];
  if (!g) return null;
  const f = vehicleFactor(v);
  const lo = Math.round(g[0] * f / 10) * 10, hi = Math.round(g[1] * f / 10) * 10;
  return { lo, hi, note: g[2] };
}

// ---------- Warnleuchten & Geräusche (Diagnose) ----------
const WARNING_LIGHTS = [
  { k: "mkl", icon: "🟡", name: "Motorkontrollleuchte", sev: "mittel", cat: "reparatur", service: "Motorkontrollleuchte", guess: "Fehlereintrag im Motorsteuergerät – Auslesen empfohlen" },
  { k: "oel", icon: "🔴", name: "Öldruck", sev: "hoch", cat: "reparatur", service: "Motor", guess: "Öldruckproblem – nicht weiterfahren, Ölstand prüfen" },
  { k: "kuehl", icon: "🔴", name: "Kühlmitteltemperatur", sev: "hoch", cat: "reparatur", service: "Kühlmittelverlust", guess: "Überhitzung oder Kühlmittelverlust – anhalten und prüfen lassen" },
  { k: "batt", icon: "🔴", name: "Batterie / Ladekontrolle", sev: "hoch", cat: "reparatur", service: "Batterie", guess: "Lichtmaschine oder Batterie lädt nicht" },
  { k: "brems", icon: "🔴", name: "Bremse / ABS", sev: "hoch", cat: "reparatur", service: "Bremsen", guess: "Bremsanlage prüfen lassen – Beläge, Flüssigkeit oder ABS-Sensor" },
  { k: "airbag", icon: "🟡", name: "Airbag", sev: "mittel", cat: "reparatur", service: "Elektrik", guess: "Fehler im Rückhaltesystem" },
  { k: "reifen", icon: "🟡", name: "Reifendruck (RDKS)", sev: "mittel", cat: "reifen", service: "Reifenreparatur", guess: "Druckverlust oder RDKS-Sensor" },
  { k: "esp", icon: "🟡", name: "ESP / Traktion", sev: "mittel", cat: "reparatur", service: "Elektrik", guess: "Fahrdynamikregelung meldet Fehler" },
  { k: "vorgluh", icon: "🟡", name: "Vorglühen / Abgas (Diesel)", sev: "mittel", cat: "reparatur", service: "Motorkontrollleuchte", guess: "Glühanlage oder Abgassystem (AGR, DPF)" },
];
const SOUNDS = [
  { k: "quietschen", name: "Quietschen beim Bremsen", cat: "reparatur", service: "Bremsen", guess: "Verschlissene Bremsbeläge oder -scheiben" },
  { k: "schleifen", name: "Schleifen / Kratzen", cat: "reparatur", service: "Bremsen", guess: "Bremsen oder Radlager" },
  { k: "klappern", name: "Klappern / Poltern", cat: "reparatur", service: "Fahrwerk", guess: "Koppelstange, Traggelenk oder Stabilisator" },
  { k: "brummen", name: "Brummen (geschwindigkeitsabhängig)", cat: "reparatur", service: "Fahrwerk", guess: "Radlager oder Reifen" },
  { k: "pfeifen", name: "Pfeifen / Heulen", cat: "reparatur", service: "Motor", guess: "Riemen, Turbolader oder Servopumpe" },
  { k: "rasseln", name: "Rasseln beim Start", cat: "reparatur", service: "Steuerkette", guess: "Steuerkette oder Kettenspanner" },
  { k: "knacken", name: "Knacken beim Lenken", cat: "reparatur", service: "Fahrwerk", guess: "Antriebswelle / Gelenk" },
  { k: "auspuff_laut", name: "Lauter Auspuff / Dröhnen", cat: "reparatur", service: "Auspuff", guess: "Undichte oder defekte Abgasanlage" },
];
const EMERGENCY_TYPES = [
  { k: "startet_nicht", icon: "🔋", name: "Auto startet nicht" },
  { k: "batterie", icon: "⚡", name: "Batterie leer" },
  { k: "reifen_platt", icon: "🛞", name: "Reifen platt" },
  { k: "unfall", icon: "💥", name: "Unfall" },
  { k: "rote_leuchte", icon: "🔴", name: "Rote Warnleuchte" },
  { k: "ueberhitzt", icon: "🌡️", name: "Auto überhitzt" },
  { k: "panne", icon: "🚧", name: "Panne unterwegs" },
  { k: "abschlepp", icon: "🚛", name: "Abschleppdienst nötig" },
];

// Regelbasierte Beta-Analyse (Freitext)
const AI_RULES = [
  { kw:["quietsch","bremse","bremsen","schleif"], cat:"reparatur", service:"Bremsen", guess:"Verschlissene Bremsbeläge oder -scheiben", conf:"hoch" },
  { kw:["motorkontrollleuchte","mkl","motorleuchte","check engine","gelbe leuchte"], cat:"reparatur", service:"Motorkontrollleuchte", guess:"Fehlereintrag im Motorsteuergerät – Diagnose nötig", conf:"hoch" },
  { kw:["klima","kühlt nicht","warme luft"], cat:"klima", service:"Klimaservice", guess:"Kältemittel niedrig oder Kompressorproblem", conf:"mittel" },
  { kw:["batterie","springt nicht an","startet nicht","anlasser","orgelt"], cat:"reparatur", service:"Startprobleme", guess:"Schwache Batterie, Anlasser oder Ladeproblem", conf:"mittel" },
  { kw:["reifen","platt","profil","vibrier","unwucht"], cat:"reifen", service:"Reifenreparatur", guess:"Reifenschaden oder Unwucht", conf:"mittel" },
  { kw:["klapper","poltern","fahrwerk","stoßdämpfer","schlägt","knackt"], cat:"reparatur", service:"Fahrwerk", guess:"Ausgeschlagene Fahrwerkskomponente (Koppelstange, Traggelenk)", conf:"mittel" },
  { kw:["öl","ölfleck","verliert","tropft"], cat:"reparatur", service:"Ölverlust", guess:"Undichtigkeit (Ölwanne, Ventildeckel, Simmerring)", conf:"mittel" },
  { kw:["kühlmittel","kühlwasser","überhitzt","temperatur"], cat:"reparatur", service:"Kühlmittelverlust", guess:"Kühlsystem undicht oder Thermostat defekt", conf:"mittel" },
  { kw:["kupplung","rutscht","gang","schaltet schwer"], cat:"reparatur", service:"Kupplung", guess:"Verschlissene Kupplung oder Getriebeproblem", conf:"mittel" },
  { kw:["auspuff","laut","brummt","dröhnt","abgas"], cat:"reparatur", service:"Auspuff", guess:"Undichte oder defekte Abgasanlage", conf:"mittel" },
  { kw:["kratzer","delle","beule","lack","rost"], cat:"karosserie", service:"Dellenentfernung", guess:"Lack-/Karosserieschaden – Smart Repair möglich", conf:"mittel" },
  { kw:["tüv","hu","plakette"], cat:"tuev", service:"HU", guess:"Hauptuntersuchung fällig", conf:"hoch" },
  { kw:["zahnriemen","steuerkette","rasselt"], cat:"reparatur", service:"Zahnriemen", guess:"Zahnriemen-/Steuerkettenservice empfohlen", conf:"mittel" },
  { kw:["scheibe","steinschlag","riss","glas"], cat:"autoglas", service:"Steinschlagreparatur", guess:"Glasschaden – Reparatur oft ohne Scheibentausch möglich", conf:"hoch" },
  { kw:["schlüssel","funk","zentralverriegelung","wegfahrsperre"], cat:"schluessel", service:"Funkschlüssel-Reparatur", guess:"Schlüssel- oder Verriegelungsproblem", conf:"mittel" },
  { kw:["ruckelt","zieht nicht","leistung","notlauf"], cat:"reparatur", service:"Motor", guess:"Zündung, Einspritzung oder Turbolader – Diagnose empfohlen", conf:"mittel" },
];
function aiAnalyze(text) {
  const t = (text || "").toLowerCase();
  return AI_RULES.filter(r => r.kw.some(k => t.includes(k))).slice(0, 3);
}

// ---------- Helfer ----------
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
// "08:00–18:00" → gerade geöffnet?
function isOpenNow(opening_hours) {
  if (!opening_hours) return null;
  const dayKeys = ["so","mo","di","mi","do","fr","sa"];
  const t = opening_hours[dayKeys[new Date().getDay()]];
  if (!t) return false;
  const m = String(t).match(/(\d{1,2})[:.](\d{2})\s*[–\-—]\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  return now >= (+m[1] * 60 + +m[2]) && now <= (+m[3] * 60 + +m[4]);
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function fmtDate(d){ try { return new Date(d).toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"}); } catch(e){ return String(d); } }
function fmtDateTime(d){ try { return new Date(d).toLocaleString("de-DE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); } catch(e){ return String(d); } }
function fmtEur(n){ return (Math.round(Number(n)*100)/100).toLocaleString("de-DE",{minimumFractionDigits:0,maximumFractionDigits:2}) + " €"; }
function stars(avg){ const n = Math.round(Number(avg)||0); return "★".repeat(n) + "☆".repeat(5-n); }
