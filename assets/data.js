// ============================================================
// Carfixo – Stammdaten: Kategorien, Services, Marken, Orte,
// Preisorientierung, Warnleuchten, Geräusche, Notfälle
// ============================================================
"use strict";

// 13 Hauptkategorien (Schlüssel = DB-Werte) mit Unterkategorien
const CATS = {
  reparatur: { icon: "🔧", name: "Reparatur & Diagnose", services: ["Motor","Getriebe","Bremsen","Kupplung","Fahrwerk","Stoßdämpfer","Federn","Lenkung","Elektrik","Batterie","Lichtmaschine","Anlasser","Auspuff","Katalysator","Dieselpartikelfilter","Kühlung","Kühler","Wasserpumpe","Ölverlust","Kühlmittelverlust","Startprobleme","Motorkontrollleuchte","Warnleuchte","Geräusche","Vibrationen","Zahnriemen","Steuerkette","Turbolader","Klimakompressor","Fensterheber","Zentralverriegelung","Sensoren","ABS / ESP","Airbag","Fehlerspeicher auslesen"] },
  inspektion: { icon: "🛠️", name: "Inspektion & Wartung", services: ["Kleine Inspektion","Große Inspektion","Ölwechsel","Nach Herstellervorgabe","Bremsflüssigkeit","Filterwechsel","Zündkerzen","Wartungsintervall"] },
  reifen: { icon: "🛞", name: "Reifen & Felgen", services: ["Reifenwechsel","Montage","Wuchten","Einlagerung","Felgenreparatur","Achsvermessung","Reifenreparatur","RDKS-Service"] },
  karosserie: { icon: "🚘", name: "Karosserie & Unfall", services: ["Unfallinstandsetzung","Dellenentfernung","Hagelschaden","Rostbeseitigung","Stoßstange","Kotflügel","Ausbeulen ohne Lackieren","Gutachten-Vorbereitung"] },
  lack: { icon: "🎨", name: "Lackierung & Folierung", services: ["Lackierung","Folierung","Smart Repair","Steinschlag-Lack","Scheibentönung","Teilfolierung","Lackversiegelung"] },
  pflege: { icon: "✨", name: "Aufbereitung & Pflege", services: ["Innenreinigung","Außenreinigung","Komplettaufbereitung","Lederreinigung","Lederpflege","Politur","Lackaufbereitung","Lackversiegelung","Keramikversiegelung","Kratzer entfernen","Geruchsentfernung","Ozonbehandlung","Tierhaarentfernung","Fleckenentfernung","Motorraumreinigung","Felgenreinigung","Scheibenversiegelung","Cabrioverdeckpflege","Kunststoffpflege","Scheinwerferaufbereitung","Verkaufsaufbereitung","Leasingrückgabe-Aufbereitung","Wohnmobil-Aufbereitung","Motorrad-Aufbereitung","Innenraumdesinfektion","Nikotingeruch entfernen","Wasserflecken entfernen","Flugrost entfernen"] },
  klima: { icon: "❄️", name: "Klimaanlage", services: ["Klimaservice","Klimareparatur","Klimadesinfektion","Kältemittel","Klimakompressor"] },
  tuev: { icon: "📋", name: "TÜV & Prüfung", services: ["HU","AU","HU + AU","TÜV-Vorbereitung","Mängelbeseitigung vor HU","Nachprüfung","Sicherheitscheck","Gebrauchtwagencheck","Bremsenprüfung","Lichttest","Abgasuntersuchung","Klimaanlagencheck","Batteriecheck","Sommercheck","Wintercheck","Urlaubscheck","Unfallcheck","Fahrzeugbewertung","Oldtimer-Gutachten","H-Kennzeichen-Vorbereitung","Änderungsabnahme","Einzelabnahme","Tuning-Abnahme","Gasprüfung","Wohnmobil-Prüfung","Reifencheck","Achsvermessung","Prüfbericht erklären","Kaufberatung vor Gebrauchtwagenkauf"] },
  tuning: { icon: "🏎️", name: "Tuning & Codierung", services: ["Chiptuning","Softwareoptimierung","Leistungssteigerung","Leistungsprüfung","Prüfstand","Fahrwerkstuning","Tieferlegung","Gewindefahrwerk","Luftfahrwerk","Spurverbreiterung","Felgen","Reifen","Auspuffanlage","Sportauspuff","Downpipe","Ansaugsystem","Ladeluftkühler","Bremsanlage","Carbonteile","Bodykit","Diffusor","Spoiler","Folierung","Scheibentönung","Ambientebeleuchtung","Innenraumumbau","Codierungen","Freischaltungen","Apple CarPlay Nachrüstung","Android Auto Nachrüstung","Rückfahrkamera","Dashcam","Kennfeldoptimierung","Rückrüstung","Tuning-Abnahme"] },
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

// ============================================================
// FAHRZEUGDATENBANK (Beta)
// Struktur ist so aufgebaut, dass sie später 1:1 durch eine
// echte Fahrzeugdaten-API ersetzt werden kann – alle Zugriffe
// laufen über die vehicleLookup()-Funktionen weiter unten.
// ============================================================

// Marke → Modelle
const BRANDS = {
  "Abarth":["500","595","695","124 Spider"],
  "Alfa Romeo":["Giulia","Giulietta","Stelvio","Tonale","MiTo","159","4C"],
  "Aston Martin":["Vantage","DB11","DB12","DBX"],
  "Audi":["A1","A2","A3","A4","A5","A6","A7","A8","Q2","Q3","Q4 e-tron","Q5","Q7","Q8","TT","R8","e-tron GT","RS-Modelle"],
  "Bentley":["Continental GT","Flying Spur","Bentayga"],
  "BMW":["1er","2er","3er","4er","5er","6er","7er","8er","X1","X2","X3","X4","X5","X6","X7","Z3","Z4","i3","i4","i5","iX","iX1","iX3","M-Modelle"],
  "BYD":["Atto 3","Dolphin","Seal","Han","Tang"],
  "Chevrolet":["Spark","Aveo","Cruze","Captiva","Camaro","Corvette"],
  "Citroën":["C1","C3","C3 Aircross","C4","C5 Aircross","Berlingo","Jumpy","Jumper","DS3","DS4"],
  "Cupra":["Leon","Formentor","Born","Ateca","Tavascan","Terramar"],
  "Dacia":["Sandero","Duster","Logan","Jogger","Spring","Lodgy","Dokker"],
  "DS":["DS 3","DS 4","DS 7","DS 9"],
  "Ferrari":["488","F8","Roma","Portofino","296","SF90","Purosangue"],
  "Fiat":["500","500e","500X","Panda","Tipo","Punto","Ducato","Doblo","Talento"],
  "Ford":["Ka","Fiesta","Focus","Mondeo","Kuga","Puma","EcoSport","Edge","Explorer","S-MAX","Galaxy","Mustang","Mustang Mach-E","Ranger","Transit","Tourneo"],
  "Genesis":["G70","G80","GV60","GV70","GV80"],
  "Honda":["Jazz","Civic","CR-V","HR-V","ZR-V","Accord","e:Ny1","Honda e"],
  "Hyundai":["i10","i20","i30","i40","Bayon","Kona","Tucson","Santa Fe","Ioniq","Ioniq 5","Ioniq 6","Staria"],
  "Infiniti":["Q30","Q50","QX30","QX70"],
  "Jaguar":["XE","XF","XJ","F-Pace","E-Pace","I-Pace","F-Type"],
  "Jeep":["Renegade","Compass","Cherokee","Grand Cherokee","Wrangler","Avenger","Gladiator"],
  "Kia":["Picanto","Rio","Ceed","XCeed","Stonic","Niro","Sportage","Sorento","EV6","EV9","Soul","Optima"],
  "Lada":["Niva","Vesta","Granta"],
  "Lamborghini":["Huracán","Aventador","Revuelto","Urus"],
  "Land Rover":["Defender","Discovery","Discovery Sport","Range Rover","Range Rover Sport","Range Rover Velar","Range Rover Evoque"],
  "Lexus":["CT","IS","ES","NX","RX","UX","LC"],
  "Maserati":["Ghibli","Quattroporte","Levante","Grecale","MC20"],
  "Mazda":["2","3","6","CX-3","CX-30","CX-5","CX-60","MX-5","MX-30"],
  "Mercedes-Benz":["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","CLA","CLS","SL","SLK/SLC","GLA","GLB","GLC","GLE","GLS","G-Klasse","V-Klasse","Vito","Sprinter","Citan","EQA","EQB","EQC","EQE","EQS","AMG GT"],
  "MG":["MG3","MG4","MG5","ZS","HS","Marvel R"],
  "Mini":["Cooper","Clubman","Countryman","Cabrio","Paceman","Electric"],
  "Mitsubishi":["Space Star","Colt","ASX","Eclipse Cross","Outlander","Pajero","L200"],
  "Nissan":["Micra","Note","Juke","Qashqai","X-Trail","Leaf","Ariya","Navara","370Z","GT-R"],
  "Opel":["Adam","Karl","Corsa","Astra","Insignia","Mokka","Crossland","Grandland","Zafira","Meriva","Combo","Vivaro","Movano"],
  "Peugeot":["107","108","208","2008","308","3008","408","508","5008","Partner","Rifter","Expert","Boxer"],
  "Polestar":["Polestar 1","Polestar 2","Polestar 3","Polestar 4"],
  "Porsche":["911","718 Boxster","718 Cayman","Panamera","Macan","Cayenne","Taycan"],
  "Renault":["Twingo","Clio","Captur","Megane","Megane E-Tech","Austral","Arkana","Scenic","Espace","Kangoo","Trafic","Master","Zoe"],
  "Rolls-Royce":["Ghost","Phantom","Cullinan","Spectre"],
  "Saab":["9-3","9-5"],
  "Seat":["Mii","Ibiza","Leon","Toledo","Ateca","Arona","Tarraco","Alhambra"],
  "Skoda":["Citigo","Fabia","Rapid","Scala","Octavia","Superb","Kamiq","Karoq","Kodiaq","Enyaq"],
  "Smart":["ForTwo","ForFour","#1","#3"],
  "Ssangyong":["Tivoli","Korando","Rexton","Musso"],
  "Subaru":["Impreza","XV","Forester","Outback","Levorg","BRZ","Solterra"],
  "Suzuki":["Alto","Swift","Ignis","Baleno","Vitara","S-Cross","Jimny","Across"],
  "Tesla":["Model 3","Model S","Model X","Model Y","Cybertruck"],
  "Toyota":["Aygo","Aygo X","Yaris","Yaris Cross","Corolla","C-HR","RAV4","Camry","Prius","Supra","Land Cruiser","Hilux","Proace","bZ4X"],
  "Volkswagen":["up!","Polo","Golf","Jetta","Passat","Arteon","Scirocco","Beetle","T-Roc","T-Cross","Taigo","Tiguan","Touran","Touareg","Sharan","Caddy","Transporter","Multivan","Crafter","Amarok","ID.3","ID.4","ID.5","ID.7","ID. Buzz"],
  "Volvo":["C30","V40","V60","V90","S60","S90","XC40","XC60","XC90","C40","EX30","EX90"],
};

// Modell → Baureihen/Generationen mit Bauzeitraum [von, bis]
const SERIES = {
  "Audi|A1":[["8X (2010–2018)",2010,2018],["GB (ab 2018)",2018,2026]],
  "Audi|A3":[["8L (1996–2003)",1996,2003],["8P (2003–2012)",2003,2012],["8V (2012–2020)",2012,2020],["8Y (ab 2020)",2020,2026]],
  "Audi|A4":[["B6 (2000–2004)",2000,2004],["B7 (2004–2008)",2004,2008],["B8 (2007–2015)",2007,2015],["B9 (ab 2015)",2015,2026]],
  "Audi|A5":[["8T (2007–2016)",2007,2016],["F5 (ab 2016)",2016,2026]],
  "Audi|A6":[["C6 (2004–2011)",2004,2011],["C7 (2011–2018)",2011,2018],["C8 (ab 2018)",2018,2026]],
  "Audi|Q3":[["8U (2011–2018)",2011,2018],["F3 (ab 2018)",2018,2026]],
  "Audi|Q5":[["8R (2008–2016)",2008,2016],["FY (ab 2016)",2016,2026]],
  "Audi|Q7":[["4L (2005–2015)",2005,2015],["4M (ab 2015)",2015,2026]],
  "Audi|TT":[["8N (1998–2006)",1998,2006],["8J (2006–2014)",2006,2014],["8S (2014–2023)",2014,2023]],
  "BMW|1er":[["E81/E87 (2004–2013)",2004,2013],["F20/F21 (2011–2019)",2011,2019],["F40 (ab 2019)",2019,2026]],
  "BMW|2er":[["F22/F23 (2013–2021)",2013,2021],["F44 Gran Coupé (ab 2019)",2019,2026],["G42 (ab 2021)",2021,2026]],
  "BMW|3er":[["E46 (1998–2007)",1998,2007],["E90/E91 (2005–2013)",2005,2013],["F30/F31 (2012–2019)",2012,2019],["G20/G21 (ab 2019)",2019,2026]],
  "BMW|4er":[["F32/F33/F36 (2013–2020)",2013,2020],["G22/G23/G26 (ab 2020)",2020,2026]],
  "BMW|5er":[["E39 (1995–2004)",1995,2004],["E60/E61 (2003–2010)",2003,2010],["F10/F11 (2010–2017)",2010,2017],["G30/G31 (2017–2023)",2017,2023],["G60 (ab 2023)",2023,2026]],
  "BMW|7er":[["E65/E66 (2001–2008)",2001,2008],["F01/F02 (2008–2015)",2008,2015],["G11/G12 (2015–2022)",2015,2022],["G70 (ab 2022)",2022,2026]],
  "BMW|X1":[["E84 (2009–2015)",2009,2015],["F48 (2015–2022)",2015,2022],["U11 (ab 2022)",2022,2026]],
  "BMW|X3":[["E83 (2003–2010)",2003,2010],["F25 (2010–2017)",2010,2017],["G01 (ab 2017)",2017,2026]],
  "BMW|X5":[["E53 (1999–2006)",1999,2006],["E70 (2006–2013)",2006,2013],["F15 (2013–2018)",2013,2018],["G05 (ab 2018)",2018,2026]],
  "Mercedes-Benz|A-Klasse":[["W168 (1997–2004)",1997,2004],["W169 (2004–2012)",2004,2012],["W176 (2012–2018)",2012,2018],["W177 (ab 2018)",2018,2026]],
  "Mercedes-Benz|B-Klasse":[["W245 (2005–2011)",2005,2011],["W246 (2011–2018)",2011,2018],["W247 (ab 2018)",2018,2026]],
  "Mercedes-Benz|C-Klasse":[["W203 (2000–2007)",2000,2007],["W204 (2007–2014)",2007,2014],["W205 (2014–2021)",2014,2021],["W206 (ab 2021)",2021,2026]],
  "Mercedes-Benz|E-Klasse":[["W211 (2002–2009)",2002,2009],["W212 (2009–2016)",2009,2016],["W213 (2016–2023)",2016,2023],["W214 (ab 2023)",2023,2026]],
  "Mercedes-Benz|S-Klasse":[["W220 (1998–2005)",1998,2005],["W221 (2005–2013)",2005,2013],["W222 (2013–2020)",2013,2020],["W223 (ab 2020)",2020,2026]],
  "Mercedes-Benz|GLC":[["X253 (2015–2022)",2015,2022],["X254 (ab 2022)",2022,2026]],
  "Mercedes-Benz|GLA":[["X156 (2013–2020)",2013,2020],["H247 (ab 2020)",2020,2026]],
  "Mercedes-Benz|Sprinter":[["W906 (2006–2018)",2006,2018],["W907/910 (ab 2018)",2018,2026]],
  "Volkswagen|Polo":[["9N (2001–2009)",2001,2009],["6R/6C (2009–2017)",2009,2017],["AW (ab 2017)",2017,2026]],
  "Volkswagen|Golf":[["IV (1997–2006)",1997,2006],["V (2003–2009)",2003,2009],["VI (2008–2013)",2008,2013],["VII (2012–2020)",2012,2020],["VIII (ab 2019)",2019,2026]],
  "Volkswagen|Passat":[["B6 (2005–2010)",2005,2010],["B7 (2010–2015)",2010,2015],["B8 (2014–2023)",2014,2023],["B9 (ab 2023)",2023,2026]],
  "Volkswagen|Tiguan":[["I (5N, 2007–2016)",2007,2016],["II (AD1, 2016–2024)",2016,2024],["III (ab 2024)",2024,2026]],
  "Volkswagen|Touran":[["I (1T, 2003–2015)",2003,2015],["II (5T, ab 2015)",2015,2026]],
  "Volkswagen|T-Roc":[["A11 (ab 2017)",2017,2026]],
  "Volkswagen|Transporter":[["T4 (1990–2003)",1990,2003],["T5 (2003–2015)",2003,2015],["T6/T6.1 (2015–2024)",2015,2024],["T7 (ab 2021)",2021,2026]],
  "Volkswagen|up!":[["AA (2011–2023)",2011,2023]],
  "Opel|Corsa":[["C (2000–2006)",2000,2006],["D (2006–2014)",2006,2014],["E (2014–2019)",2014,2019],["F (ab 2019)",2019,2026]],
  "Opel|Astra":[["G (1998–2005)",1998,2005],["H (2004–2010)",2004,2010],["J (2009–2015)",2009,2015],["K (2015–2021)",2015,2021],["L (ab 2021)",2021,2026]],
  "Opel|Insignia":[["A (2008–2017)",2008,2017],["B (2017–2022)",2017,2022]],
  "Ford|Fiesta":[["MK6 (2002–2008)",2002,2008],["MK7 (2008–2017)",2008,2017],["MK8 (2017–2023)",2017,2023]],
  "Ford|Focus":[["MK2 (2004–2011)",2004,2011],["MK3 (2010–2018)",2010,2018],["MK4 (ab 2018)",2018,2026]],
  "Ford|Kuga":[["I (2008–2012)",2008,2012],["II (2012–2019)",2012,2019],["III (ab 2019)",2019,2026]],
  "Skoda|Fabia":[["I (1999–2007)",1999,2007],["II (2007–2014)",2007,2014],["III (2014–2021)",2014,2021],["IV (ab 2021)",2021,2026]],
  "Skoda|Octavia":[["I (1996–2010)",1996,2010],["II (2004–2013)",2004,2013],["III (2012–2020)",2012,2020],["IV (ab 2020)",2020,2026]],
  "Skoda|Superb":[["I (2001–2008)",2001,2008],["II (2008–2015)",2008,2015],["III (2015–2023)",2015,2023],["IV (ab 2023)",2023,2026]],
  "Seat|Ibiza":[["6L (2002–2008)",2002,2008],["6J (2008–2017)",2008,2017],["KJ (ab 2017)",2017,2026]],
  "Seat|Leon":[["1M (1999–2006)",1999,2006],["1P (2005–2012)",2005,2012],["5F (2012–2020)",2012,2020],["KL (ab 2020)",2020,2026]],
  "Toyota|Yaris":[["XP9 (2005–2011)",2005,2011],["XP13 (2011–2020)",2011,2020],["XP21 (ab 2020)",2020,2026]],
  "Toyota|Corolla":[["E12 (2001–2007)",2001,2007],["E16 (2013–2019)",2013,2019],["E21 (ab 2019)",2019,2026]],
  "Toyota|RAV4":[["XA3 (2005–2013)",2005,2013],["XA4 (2013–2018)",2013,2018],["XA5 (ab 2018)",2018,2026]],
  "Renault|Clio":[["III (2005–2012)",2005,2012],["IV (2012–2019)",2012,2019],["V (ab 2019)",2019,2026]],
  "Renault|Megane":[["III (2008–2016)",2008,2016],["IV (2016–2023)",2016,2023]],
  "Hyundai|i30":[["FD (2007–2012)",2007,2012],["GD (2012–2017)",2012,2017],["PD (ab 2017)",2017,2026]],
  "Hyundai|Tucson":[["TL (2015–2020)",2015,2020],["NX4 (ab 2020)",2020,2026]],
  "Kia|Ceed":[["ED (2006–2012)",2006,2012],["JD (2012–2018)",2012,2018],["CD (ab 2018)",2018,2026]],
  "Kia|Sportage":[["SL (2010–2015)",2010,2015],["QL (2015–2021)",2015,2021],["NQ5 (ab 2021)",2021,2026]],
  "Porsche|911":[["996 (1997–2006)",1997,2006],["997 (2004–2012)",2004,2012],["991 (2011–2019)",2011,2019],["992 (ab 2019)",2019,2026]],
  "Porsche|Cayenne":[["955/957 (2002–2010)",2002,2010],["958 (2010–2017)",2010,2017],["9YA (ab 2017)",2017,2026]],
  "Porsche|Macan":[["95B (ab 2014)",2014,2026]],
  "Fiat|500":[["312 (ab 2007)",2007,2026]],
  "Mini|Cooper":[["R50/R53 (2001–2006)",2001,2006],["R56 (2006–2013)",2006,2013],["F56 (2014–2023)",2014,2023],["J01 (ab 2023)",2023,2026]],
  "Volvo|XC60":[["I (2008–2017)",2008,2017],["II (ab 2017)",2017,2026]],
  "Volvo|XC90":[["I (2002–2014)",2002,2014],["II (ab 2015)",2015,2026]],
  "Mazda|3":[["BK (2003–2009)",2003,2009],["BL (2009–2013)",2009,2013],["BM (2013–2019)",2013,2019],["BP (ab 2019)",2019,2026]],
  "Mazda|CX-5":[["KE (2012–2017)",2012,2017],["KF (ab 2017)",2017,2026]],
  "Peugeot|208":[["I (2012–2019)",2012,2019],["II (ab 2019)",2019,2026]],
  "Peugeot|308":[["I (2007–2013)",2007,2013],["II (2013–2021)",2013,2021],["III (ab 2021)",2021,2026]],
  "Tesla|Model 3":[["Pre-Facelift (2017–2023)",2017,2023],["Highland (ab 2023)",2023,2026]],
  "Tesla|Model Y":[["Juniper/Standard (ab 2020)",2020,2026]],
  "Nissan|Qashqai":[["J10 (2006–2013)",2006,2013],["J11 (2013–2021)",2013,2021],["J12 (ab 2021)",2021,2026]],
  "Dacia|Duster":[["I (2010–2018)",2010,2018],["II (2018–2024)",2018,2024],["III (ab 2024)",2024,2026]],
  "Dacia|Sandero":[["I (2008–2012)",2008,2012],["II (2012–2020)",2012,2020],["III (ab 2020)",2020,2026]],
};

// Motorisierungen: "Marke|Modell" → [{n: Name, f: Kraftstoff, ps: [PS-Optionen], t: erlaubte Getriebe (optional)}]
// Für nicht gelistete Modelle greifen Marken-Defaults, danach generische Auswahl.
const ENGINE_DB = {
  "BMW|1er":[{n:"114i",f:"Benzin",ps:[102]},{n:"116i",f:"Benzin",ps:[109,122,136]},{n:"118i",f:"Benzin",ps:[136,140,143,170]},{n:"120i",f:"Benzin",ps:[170,178,184]},{n:"125i",f:"Benzin",ps:[218,224]},{n:"M135i/M140i",f:"Benzin",ps:[306,320,326,340]},{n:"116d",f:"Diesel",ps:[116]},{n:"118d",f:"Diesel",ps:[136,143,150]},{n:"120d",f:"Diesel",ps:[163,184,190]},{n:"125d",f:"Diesel",ps:[218,224]}],
  "BMW|3er":[{n:"316i",f:"Benzin",ps:[102,115,122,136]},{n:"318i",f:"Benzin",ps:[136,143,156]},{n:"320i",f:"Benzin",ps:[150,170,184]},{n:"328i",f:"Benzin",ps:[245]},{n:"330i",f:"Benzin",ps:[252,258]},{n:"335i/340i",f:"Benzin",ps:[306,326,360]},{n:"316d",f:"Diesel",ps:[116,122]},{n:"318d",f:"Diesel",ps:[136,143,150]},{n:"320d",f:"Diesel",ps:[163,184,190]},{n:"330d",f:"Diesel",ps:[231,245,258,265]},{n:"335d",f:"Diesel",ps:[286,313]},{n:"330e (Plug-in)",f:"Plug-in-Hybrid",ps:[252,292],t:["Automatik"]},{n:"M3",f:"Benzin",ps:[420,431,450,480,510]}],
  "BMW|5er":[{n:"520i",f:"Benzin",ps:[170,184,190]},{n:"528i/530i",f:"Benzin",ps:[245,252,258,272]},{n:"540i",f:"Benzin",ps:[333,340]},{n:"518d",f:"Diesel",ps:[136,150]},{n:"520d",f:"Diesel",ps:[163,184,190,197]},{n:"525d",f:"Diesel",ps:[204,218,231]},{n:"530d",f:"Diesel",ps:[231,245,258,265,286]},{n:"535d",f:"Diesel",ps:[286,299,313]},{n:"530e (Plug-in)",f:"Plug-in-Hybrid",ps:[252,292],t:["Automatik"]},{n:"M5",f:"Benzin",ps:[560,600,625]}],
  "BMW|X1":[{n:"sDrive18i",f:"Benzin",ps:[136,140,150]},{n:"sDrive20i/xDrive20i",f:"Benzin",ps:[178,184,192,204]},{n:"sDrive18d",f:"Diesel",ps:[136,143,150]},{n:"xDrive20d",f:"Diesel",ps:[163,177,184,190]},{n:"xDrive25e (Plug-in)",f:"Plug-in-Hybrid",ps:[220,245],t:["Automatik"]}],
  "BMW|X3":[{n:"xDrive20i",f:"Benzin",ps:[184]},{n:"xDrive30i",f:"Benzin",ps:[245,252]},{n:"M40i",f:"Benzin",ps:[354,360]},{n:"xDrive18d/20d",f:"Diesel",ps:[150,163,184,190]},{n:"xDrive30d",f:"Diesel",ps:[249,258,265,286]},{n:"M40d",f:"Diesel",ps:[326,340]}],
  "BMW|X5":[{n:"xDrive40i",f:"Benzin",ps:[333,340,381]},{n:"xDrive50i",f:"Benzin",ps:[408,449,530]},{n:"xDrive25d",f:"Diesel",ps:[218,231]},{n:"xDrive30d",f:"Diesel",ps:[235,245,258,265,286,298]},{n:"xDrive40d",f:"Diesel",ps:[306,313,340,352]},{n:"xDrive45e (Plug-in)",f:"Plug-in-Hybrid",ps:[394],t:["Automatik"]},{n:"M50d",f:"Diesel",ps:[381,400]}],
  "BMW|i3":[{n:"i3 (60Ah–120Ah)",f:"Elektro",ps:[170],t:["Automatik"]},{n:"i3s",f:"Elektro",ps:[184],t:["Automatik"]}],
  "BMW|i4":[{n:"eDrive35",f:"Elektro",ps:[286],t:["Automatik"]},{n:"eDrive40",f:"Elektro",ps:[340],t:["Automatik"]},{n:"M50",f:"Elektro",ps:[544],t:["Automatik"]}],
  "Audi|A3":[{n:"1.0/30 TFSI",f:"Benzin",ps:[110,116]},{n:"1.4/35 TFSI",f:"Benzin",ps:[122,125,140,150]},{n:"1.8/2.0 TFSI",f:"Benzin",ps:[160,180,190]},{n:"S3",f:"Benzin",ps:[265,280,300,310,333]},{n:"RS3",f:"Benzin",ps:[367,400]},{n:"1.6 TDI/30 TDI",f:"Diesel",ps:[90,105,110,116]},{n:"2.0 TDI/35 TDI",f:"Diesel",ps:[136,143,150,184,200]},{n:"40 TFSI e (Plug-in)",f:"Plug-in-Hybrid",ps:[204,245],t:["Automatik","DSG / Doppelkupplung"]}],
  "Audi|A4":[{n:"1.8/2.0 TFSI (35/40/45)",f:"Benzin",ps:[150,170,190,204,245,252]},{n:"S4",f:"Benzin",ps:[333,354]},{n:"RS4",f:"Benzin",ps:[450]},{n:"2.0 TDI (35/40)",f:"Diesel",ps:[122,136,143,150,163,177,190,204]},{n:"3.0 TDI (45/50)",f:"Diesel",ps:[218,231,240,272,286]}],
  "Audi|A6":[{n:"2.0 TFSI (45)",f:"Benzin",ps:[190,204,245,252,265]},{n:"3.0 TFSI (55)",f:"Benzin",ps:[300,333,340]},{n:"2.0 TDI (35/40)",f:"Diesel",ps:[150,163,190,204]},{n:"3.0 TDI (45/50)",f:"Diesel",ps:[218,231,245,272,286]},{n:"S6/RS6",f:"Benzin",ps:[420,450,560,600,630]}],
  "Audi|Q3":[{n:"1.4/35 TFSI",f:"Benzin",ps:[150]},{n:"2.0/40-45 TFSI",f:"Benzin",ps:[170,180,190,230,245]},{n:"RS Q3",f:"Benzin",ps:[310,340,367,400]},{n:"2.0 TDI (35/40)",f:"Diesel",ps:[140,150,177,190,200]}],
  "Audi|Q5":[{n:"2.0 TFSI (45)",f:"Benzin",ps:[180,211,224,230,245,252,265]},{n:"SQ5",f:"Benzin",ps:[354]},{n:"2.0 TDI (35/40)",f:"Diesel",ps:[143,150,163,177,190,204]},{n:"3.0 TDI (50/SQ5)",f:"Diesel",ps:[240,245,258,286,313,341]},{n:"55 TFSI e (Plug-in)",f:"Plug-in-Hybrid",ps:[299,367],t:["Automatik"]}],
  "Mercedes-Benz|A-Klasse":[{n:"A140–A200 (Benzin)",f:"Benzin",ps:[82,95,102,116,122,136,150,163]},{n:"A250",f:"Benzin",ps:[211,218,224]},{n:"A35/A45 AMG",f:"Benzin",ps:[306,381,421]},{n:"A160d–A220d",f:"Diesel",ps:[90,95,109,116,136,150,177,190]},{n:"A250e (Plug-in)",f:"Plug-in-Hybrid",ps:[218],t:["Automatik","DSG / Doppelkupplung"]}],
  "Mercedes-Benz|C-Klasse":[{n:"C160–C200",f:"Benzin",ps:[129,136,156,163,184,204]},{n:"C250–C300",f:"Benzin",ps:[204,211,245,258]},{n:"C43/C63 AMG",f:"Benzin",ps:[367,390,476,510]},{n:"C180d–C220d",f:"Diesel",ps:[116,122,136,150,163,170,194,200]},{n:"C300d",f:"Diesel",ps:[231,245,265]},{n:"C300e (Plug-in)",f:"Plug-in-Hybrid",ps:[313],t:["Automatik"]}],
  "Mercedes-Benz|E-Klasse":[{n:"E200–E250",f:"Benzin",ps:[184,197,204,211]},{n:"E300–E450",f:"Benzin",ps:[245,258,299,333,367]},{n:"E53/E63 AMG",f:"Benzin",ps:[435,571,612]},{n:"E200d–E220d",f:"Diesel",ps:[136,150,160,163,194,197,200]},{n:"E300d–E400d",f:"Diesel",ps:[231,245,265,286,330,340]},{n:"E300e (Plug-in)",f:"Plug-in-Hybrid",ps:[312,313],t:["Automatik"]}],
  "Mercedes-Benz|GLC":[{n:"GLC200–GLC300",f:"Benzin",ps:[184,197,204,211,245,258]},{n:"GLC43/63 AMG",f:"Benzin",ps:[367,390,476,510]},{n:"GLC200d–GLC220d",f:"Diesel",ps:[163,170,194,197]},{n:"GLC300d",f:"Diesel",ps:[245,265]},{n:"GLC300e (Plug-in)",f:"Plug-in-Hybrid",ps:[313,320],t:["Automatik"]}],
  "Volkswagen|Polo":[{n:"1.0 MPI/TSI",f:"Benzin",ps:[60,65,75,80,95,110,115]},{n:"1.2/1.4 TSI",f:"Benzin",ps:[60,70,86,90,105,110,125,150]},{n:"GTI",f:"Benzin",ps:[180,192,200,207]},{n:"1.4/1.6 TDI",f:"Diesel",ps:[75,80,90,95,105]}],
  "Volkswagen|Golf":[{n:"1.0 TSI",f:"Benzin",ps:[85,90,110,115]},{n:"1.2/1.4/1.5 TSI",f:"Benzin",ps:[105,110,122,125,130,140,150]},{n:"GTI",f:"Benzin",ps:[200,211,220,230,245,265]},{n:"R",f:"Benzin",ps:[270,300,310,320,333]},{n:"1.6 TDI",f:"Diesel",ps:[90,105,110,115]},{n:"2.0 TDI/GTD",f:"Diesel",ps:[110,115,140,150,170,184,200]},{n:"eHybrid/GTE (Plug-in)",f:"Plug-in-Hybrid",ps:[204,245],t:["DSG / Doppelkupplung","Automatik"]},{n:"e-Golf",f:"Elektro",ps:[115,136],t:["Automatik"]}],
  "Volkswagen|Passat":[{n:"1.4/1.5 TSI",f:"Benzin",ps:[122,125,150]},{n:"1.8/2.0 TSI",f:"Benzin",ps:[160,180,190,220,272,280]},{n:"1.6 TDI",f:"Diesel",ps:[105,120]},{n:"2.0 TDI",f:"Diesel",ps:[110,140,150,170,177,184,190,200,240]},{n:"GTE (Plug-in)",f:"Plug-in-Hybrid",ps:[218,245],t:["DSG / Doppelkupplung"]}],
  "Volkswagen|Tiguan":[{n:"1.4/1.5 TSI",f:"Benzin",ps:[122,125,130,150,160]},{n:"2.0 TSI",f:"Benzin",ps:[180,190,220,230,245]},{n:"2.0 TDI",f:"Diesel",ps:[110,115,140,150,177,190,200,240]},{n:"eHybrid (Plug-in)",f:"Plug-in-Hybrid",ps:[245],t:["DSG / Doppelkupplung"]}],
  "Volkswagen|Touran":[{n:"1.2/1.4/1.5 TSI",f:"Benzin",ps:[105,110,125,140,150]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[90,105,110,115,140,150,177,190]}],
  "Volkswagen|ID.3":[{n:"Pure/Pro (45–58 kWh)",f:"Elektro",ps:[126,145,150,170,204],t:["Automatik"]},{n:"Pro S/GTX",f:"Elektro",ps:[204,231,326],t:["Automatik"]}],
  "Volkswagen|ID.4":[{n:"Pure/Pro",f:"Elektro",ps:[148,170,174,204,286],t:["Automatik"]},{n:"GTX",f:"Elektro",ps:[299,340],t:["Automatik"]}],
  "Opel|Corsa":[{n:"1.0/1.2 (Benzin)",f:"Benzin",ps:[60,65,69,75,90,100,101,130]},{n:"OPC/GSi",f:"Benzin",ps:[150,192,207]},{n:"1.3/1.5 Diesel",f:"Diesel",ps:[75,95,102]},{n:"Corsa-e",f:"Elektro",ps:[136,156],t:["Automatik"]}],
  "Opel|Astra":[{n:"1.0–1.4 Turbo",f:"Benzin",ps:[105,110,125,130,140,145,150]},{n:"1.6 Turbo/OPC",f:"Benzin",ps:[170,180,200,280]},{n:"1.5/1.6 Diesel",f:"Diesel",ps:[95,105,110,122,130,136,160]},{n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[180,225],t:["Automatik"]}],
  "Ford|Fiesta":[{n:"1.0 EcoBoost",f:"Benzin",ps:[95,100,101,125,140,155]},{n:"1.25/1.6 (Benzin)",f:"Benzin",ps:[60,82,96,105,120]},{n:"ST",f:"Benzin",ps:[182,200]},{n:"1.5 TDCi",f:"Diesel",ps:[75,85,95,120]}],
  "Ford|Focus":[{n:"1.0 EcoBoost",f:"Benzin",ps:[100,101,125,155]},{n:"1.5/1.6 EcoBoost",f:"Benzin",ps:[150,182]},{n:"ST/RS",f:"Benzin",ps:[250,280,350]},{n:"1.5/2.0 TDCi/EcoBlue",f:"Diesel",ps:[95,105,120,150,190]}],
  "Ford|Kuga":[{n:"1.5 EcoBoost",f:"Benzin",ps:[120,150,182]},{n:"1.5/2.0 Diesel",f:"Diesel",ps:[120,150,163,180,190]},{n:"2.5 PHEV",f:"Plug-in-Hybrid",ps:[225],t:["Automatik"]}],
  "Skoda|Octavia":[{n:"1.0/1.2/1.4/1.5 TSI",f:"Benzin",ps:[86,105,110,115,122,140,150]},{n:"RS (Benzin)",f:"Benzin",ps:[220,230,245,265]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[90,105,110,115,116,143,150,184,200]},{n:"iV (Plug-in)",f:"Plug-in-Hybrid",ps:[204,245],t:["DSG / Doppelkupplung"]}],
  "Skoda|Fabia":[{n:"1.0 MPI/TSI",f:"Benzin",ps:[60,65,75,80,95,110,116]},{n:"1.2/1.4 TSI",f:"Benzin",ps:[86,90,105,110,125]},{n:"1.4/1.6 TDI",f:"Diesel",ps:[75,90,105]}],
  "Seat|Leon":[{n:"1.0/1.2/1.4/1.5 TSI",f:"Benzin",ps:[86,105,110,115,125,130,140,150]},{n:"Cupra",f:"Benzin",ps:[265,280,290,300]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[90,105,110,115,150,184]},{n:"e-Hybrid",f:"Plug-in-Hybrid",ps:[204],t:["DSG / Doppelkupplung"]}],
  "Seat|Ibiza":[{n:"1.0 MPI/TSI",f:"Benzin",ps:[65,75,80,95,110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"1.4/1.6 TDI",f:"Diesel",ps:[75,80,90,105]}],
  "Toyota|Yaris":[{n:"1.0/1.5 (Benzin)",f:"Benzin",ps:[69,72,111,125]},{n:"Hybrid",f:"Hybrid",ps:[100,116,130],t:["Automatik"]},{n:"GR Yaris",f:"Benzin",ps:[261,280]}],
  "Toyota|Corolla":[{n:"1.2/2.0 (Benzin)",f:"Benzin",ps:[116,170]},{n:"1.8/2.0 Hybrid",f:"Hybrid",ps:[122,140,180,196],t:["Automatik"]}],
  "Toyota|RAV4":[{n:"2.0/2.5 (Benzin)",f:"Benzin",ps:[152,175]},{n:"2.5 Hybrid",f:"Hybrid",ps:[218,222],t:["Automatik"]},{n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[306],t:["Automatik"]},{n:"2.0/2.2 D-4D",f:"Diesel",ps:[124,136,150]}],
  "Renault|Clio":[{n:"0.9/1.0 TCe",f:"Benzin",ps:[65,75,90,100]},{n:"1.2/1.3 TCe",f:"Benzin",ps:[100,118,120,130,140]},{n:"RS",f:"Benzin",ps:[200,220]},{n:"1.5 dCi",f:"Diesel",ps:[75,85,90,110]},{n:"E-Tech Hybrid",f:"Hybrid",ps:[140,145],t:["Automatik"]}],
  "Hyundai|i30":[{n:"1.0/1.4/1.5 T-GDI",f:"Benzin",ps:[100,110,120,140,159]},{n:"N/N Performance",f:"Benzin",ps:[250,275,280]},{n:"1.6 CRDi",f:"Diesel",ps:[95,110,115,136]}],
  "Hyundai|Tucson":[{n:"1.6 T-GDI",f:"Benzin",ps:[132,150,177,180]},{n:"1.6/2.0 CRDi",f:"Diesel",ps:[115,136,185]},{n:"Hybrid/Plug-in",f:"Hybrid",ps:[230,265],t:["Automatik"]}],
  "Kia|Ceed":[{n:"1.0/1.4/1.5 T-GDI",f:"Benzin",ps:[100,120,140,160]},{n:"GT",f:"Benzin",ps:[204]},{n:"1.4/1.6 CRDi",f:"Diesel",ps:[90,110,115,136]}],
  "Kia|Sportage":[{n:"1.6 T-GDI",f:"Benzin",ps:[132,150,177,180]},{n:"1.6/1.7/2.0 CRDi",f:"Diesel",ps:[115,116,136,141,185]},{n:"Hybrid/Plug-in",f:"Hybrid",ps:[230,265],t:["Automatik"]}],
  "Porsche|911":[{n:"Carrera",f:"Benzin",ps:[301,325,345,350,370,385,394]},{n:"Carrera S/GTS",f:"Benzin",ps:[381,400,420,430,450,480]},{n:"Turbo/Turbo S",f:"Benzin",ps:[480,520,540,560,580,650]},{n:"GT3/GT3 RS",f:"Benzin",ps:[435,475,500,510,525]}],
  "Porsche|Macan":[{n:"Macan (Basis)",f:"Benzin",ps:[252,265]},{n:"S/GTS",f:"Benzin",ps:[340,354,380,381,440]},{n:"Turbo",f:"Benzin",ps:[400,440]},{n:"S Diesel",f:"Diesel",ps:[258]},{n:"Macan Electric",f:"Elektro",ps:[360,408,516,639],t:["Automatik"]}],
  "Porsche|Cayenne":[{n:"Cayenne (Basis)",f:"Benzin",ps:[300,340,353]},{n:"S/GTS",f:"Benzin",ps:[400,420,440,460,474]},{n:"Turbo",f:"Benzin",ps:[500,520,550]},{n:"Diesel/S Diesel",f:"Diesel",ps:[245,262,385]},{n:"E-Hybrid",f:"Plug-in-Hybrid",ps:[340,416,462,680],t:["Automatik"]}],
  "Tesla|Model 3":[{n:"Standard/RWD",f:"Elektro",ps:[239,283,325],t:["Automatik"]},{n:"Long Range",f:"Elektro",ps:[351,441,498],t:["Automatik"]},{n:"Performance",f:"Elektro",ps:[513,534,460],t:["Automatik"]}],
  "Tesla|Model Y":[{n:"RWD",f:"Elektro",ps:[299],t:["Automatik"]},{n:"Long Range",f:"Elektro",ps:[378,514],t:["Automatik"]},{n:"Performance",f:"Elektro",ps:[534],t:["Automatik"]}],
  "Fiat|500":[{n:"1.0/1.2 (Benzin)",f:"Benzin",ps:[69,70]},{n:"0.9 TwinAir",f:"Benzin",ps:[80,85,105]},{n:"Abarth",f:"Benzin",ps:[135,145,160,165,180]},{n:"1.3 Diesel",f:"Diesel",ps:[75,95]}],
  "Mini|Cooper":[{n:"One",f:"Benzin",ps:[75,90,98,102]},{n:"Cooper",f:"Benzin",ps:[115,116,120,136]},{n:"Cooper S",f:"Benzin",ps:[163,170,175,178,184,192,204]},{n:"JCW",f:"Benzin",ps:[211,218,231]},{n:"One D/Cooper D",f:"Diesel",ps:[90,95,112,116]},{n:"Cooper SE (Elektro)",f:"Elektro",ps:[184],t:["Automatik"]}],
  "Dacia|Duster":[{n:"1.0/1.2/1.3 TCe",f:"Benzin",ps:[90,100,101,125,130,150]},{n:"1.5 dCi/Blue dCi",f:"Diesel",ps:[90,109,110,115]},{n:"ECO-G (LPG)",f:"Autogas (LPG/CNG)",ps:[100]}],
  "Dacia|Sandero":[{n:"1.0 SCe/TCe",f:"Benzin",ps:[65,67,75,90,100]},{n:"1.5 dCi",f:"Diesel",ps:[75,90,95]},{n:"ECO-G (LPG)",f:"Autogas (LPG/CNG)",ps:[100]}],
  "Nissan|Qashqai":[{n:"1.2/1.3 DIG-T",f:"Benzin",ps:[115,140,158,160]},{n:"1.5/1.6 dCi",f:"Diesel",ps:[110,115,130]},{n:"e-Power",f:"Hybrid",ps:[190],t:["Automatik"]}],
  "Volvo|XC60":[{n:"T4/T5/B5 (Benzin)",f:"Benzin",ps:[190,250,254]},{n:"D3/D4/B4 (Diesel)",f:"Diesel",ps:[150,163,190,197]},{n:"D5",f:"Diesel",ps:[215,220,235]},{n:"T6/T8 Plug-in",f:"Plug-in-Hybrid",ps:[340,390,455],t:["Automatik"]}],
  "Mazda|3":[{n:"Skyactiv-G",f:"Benzin",ps:[100,120,122,150,165]},{n:"Skyactiv-X",f:"Benzin",ps:[180,186]},{n:"Skyactiv-D",f:"Diesel",ps:[105,116,150]}],
  "Peugeot|208":[{n:"1.2 PureTech",f:"Benzin",ps:[75,82,100,110,130]},{n:"GTi",f:"Benzin",ps:[200,208]},{n:"1.5 BlueHDi",f:"Diesel",ps:[100,102]},{n:"e-208",f:"Elektro",ps:[136,156],t:["Automatik"]}],
};

// Marken-Fallback für nicht kuratierte Modelle
const ENGINE_BRAND_DEFAULT = {
  "Tesla":[{n:"Standard Range",f:"Elektro",ps:[283,306],t:["Automatik"]},{n:"Long Range",f:"Elektro",ps:[440,514],t:["Automatik"]},{n:"Performance/Plaid",f:"Elektro",ps:[534,760,1020],t:["Automatik"]}],
  "Polestar":[{n:"Standard Range",f:"Elektro",ps:[272,299],t:["Automatik"]},{n:"Long Range/Dual",f:"Elektro",ps:[408,476,517],t:["Automatik"]}],
  "BYD":[{n:"Elektro",f:"Elektro",ps:[204,218,313,517],t:["Automatik"]}],
  "Smart":[{n:"Benzin (ForTwo/ForFour)",f:"Benzin",ps:[61,66,71,82,90,109]},{n:"EQ / Elektro",f:"Elektro",ps:[82,272,428],t:["Automatik"]}],
};
// Generischer Fallback
const ENGINE_GENERIC = [
  {n:"1.0–1.2 (Benzin)",f:"Benzin",ps:[60,65,70,75,80,90,100,110,120]},
  {n:"1.4–1.6 (Benzin)",f:"Benzin",ps:[90,100,110,122,130,140,150,163]},
  {n:"1.8–2.0 (Benzin)",f:"Benzin",ps:[140,150,163,180,190,204,220,245]},
  {n:"2.5–4.0 (Benzin)",f:"Benzin",ps:[218,245,286,306,340,400,450,510]},
  {n:"1.4–1.6 Diesel",f:"Diesel",ps:[75,90,95,105,110,116,120]},
  {n:"2.0 Diesel",f:"Diesel",ps:[136,143,150,163,177,184,190,204]},
  {n:"2.5–3.0 Diesel",f:"Diesel",ps:[204,218,231,245,258,286,313]},
  {n:"Hybrid",f:"Hybrid",ps:[122,140,180,218,230],t:["Automatik"]},
  {n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[204,225,245,306,340],t:["Automatik","DSG / Doppelkupplung"]},
  {n:"Elektro",f:"Elektro",ps:[136,150,170,204,231,286,340,408],t:["Automatik"]},
];

const BODIES = ["Limousine","Kombi","Coupé","Cabriolet","Schrägheck","SUV / Geländewagen","Van","Kleinwagen","Pickup","Transporter"];
const FUELS = ["Benzin","Diesel","Hybrid","Plug-in-Hybrid","Elektro","Autogas (LPG/CNG)","Wasserstoff"];
const TRANS = ["Manuell","Automatik","DSG / Doppelkupplung"];
const PS_LIST = [45,54,60,68,75,82,90,95,102,110,116,122,131,136,140,150,163,170,184,190,204,218,231,245,258,272,286,306,326,340,360,400,420,450,476,510,550,585,625];
const KM_STEPS = [[10000,"bis 10.000 km"],[25000,"bis 25.000 km"],[50000,"bis 50.000 km"],[75000,"bis 75.000 km"],[100000,"bis 100.000 km"],[125000,"bis 125.000 km"],[150000,"bis 150.000 km"],[200000,"bis 200.000 km"],[250000,"bis 250.000 km"],[300000,"über 250.000 km"]];

// ---------- Lookup-API (später durch echte Fahrzeugdaten-API ersetzbar) ----------
const VehicleData = {
  brands() { return Object.keys(BRANDS); },
  models(brand) { return BRANDS[brand] || []; },
  // → [{label, from, to}]
  series(brand, model) {
    const raw = SERIES[brand + "|" + model];
    if (!raw) return [{ label: "Keine Angabe", from: 1990, to: 2026 }];
    return raw.map(([label, from, to]) => ({ label, from, to })).concat([{ label: "Keine Angabe", from: 1990, to: 2026 }]);
  },
  years(brand, model, seriesLabel) {
    const s = this.series(brand, model).find(x => x.label === seriesLabel);
    const from = s ? s.from : 1990, to = s ? Math.min(s.to, 2026) : 2026;
    const out = [];
    for (let y = to; y >= from; y--) out.push(y);
    return out;
  },
  engines(brand, model) {
    return ENGINE_DB[brand + "|" + model] || ENGINE_BRAND_DEFAULT[brand] || ENGINE_GENERIC;
  },
  engine(brand, model, engineName) {
    return this.engines(brand, model).find(e => e.n === engineName) || null;
  },
  fuels(brand, model, engineName) {
    const e = this.engine(brand, model, engineName);
    return e ? [e.f] : FUELS;
  },
  ps(brand, model, engineName) {
    const e = this.engine(brand, model, engineName);
    return e ? e.ps : PS_LIST;
  },
  transmissions(brand, model, engineName) {
    const e = this.engine(brand, model, engineName);
    if (e?.t) return e.t;
    if (e?.f === "Elektro") return ["Automatik"];
    return TRANS;
  },
};

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
  "Chiptuning": [350, 800, "inkl. Abstimmung"],
  "Tieferlegung": [400, 900, "inkl. Achsvermessung"],
  "Scheibentönung": [180, 450, "je nach Fahrzeug"],
  "Komplettaufbereitung": [250, 700, "innen + außen"],
  "Lackaufbereitung": [200, 600, ""],
  "HU + AU": [120, 160, ""],
  "Gebrauchtwagencheck": [50, 150, ""],
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
