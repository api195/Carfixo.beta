// ============================================================
// Carfixo – Stammdaten: Kategorien, Services, Marken, Orte,
// Preisorientierung, Warnleuchten, Geräusche, Notfälle
// ============================================================
"use strict";

// 14 Hauptkategorien (Schlüssel = DB-Werte) mit Unterkategorien
const CATS = {
  reparatur: { icon: "", name: "Reparatur & Diagnose", services: ["Motor","Getriebe","Bremsen","Kupplung","Fahrwerk","Stoßdämpfer","Federn","Lenkung","Elektrik","Batterie","Lichtmaschine","Anlasser","Auspuff","Katalysator","Dieselpartikelfilter","Kühlung","Kühler","Wasserpumpe","Ölverlust","Kühlmittelverlust","Startprobleme","Motorkontrollleuchte","Warnleuchte","Geräusche","Vibrationen","Zahnriemen","Steuerkette","Turbolader","Klimakompressor","Fensterheber","Zentralverriegelung","Sensoren","ABS / ESP","Airbag","Fehlerspeicher auslesen","Injektoren","Zündspulen","Glühkerzen","AGR-Ventil","Drosselklappe","Lambdasonde","Kraftstoffpumpe","Hochdruckpumpe","Radlager","Antriebswelle","Differential","Motorlager","Zylinderkopfdichtung","Ventildeckeldichtung","Ölwannendichtung","Motorinstandsetzung","Motortausch","Getriebetausch","Getriebespülung","Automatikgetriebe-Service","Servolenkung","Marderschaden","Kabelbaum-Reparatur","Steuergeräte-Reparatur","Schiebedach-Reparatur","Verdeck-Reparatur","Sitzheizung-Reparatur","Standheizung-Service","Anhängerkupplung nachrüsten","Scheibenwischer / Waschanlage","Hupe"] },
  inspektion: { icon: "", name: "Inspektion & Wartung", services: ["Kleine Inspektion","Große Inspektion","Ölwechsel","Nach Herstellervorgabe","Bremsflüssigkeit","Filterwechsel","Zündkerzen","Wartungsintervall","Innenraum-/Pollenfilter","Luftfilter","Kraftstofffilter","Getriebeölwechsel","Automatikgetriebe-Spülung","Zahnriemenwechsel","Bremsenservice","Batteriewechsel","Scheibenwischerwechsel","Frostschutz-Check","Serviceheft-Pflege / digitales Scheckheft"] },
  reifen: { icon: "", name: "Reifen & Felgen", services: ["Reifenwechsel","Montage","Wuchten","Einlagerung","Felgenreparatur","Achsvermessung","Reifenreparatur","RDKS-Service","Felgenaufbereitung","Felgen hochglanzverdichten","Felgen pulverbeschichten","Felgen lackieren","Felgenversiegelung","Bordsteinschaden-Reparatur","Felgen richten (Höhen-/Seitenschlag)","Alufelgen schweißen","Feinwuchten","Kompletträder-Montage","Winterreifen-Montage","Sommerreifen-Montage","Ganzjahresreifen-Umrüstung","Reifenberatung"] },
  karosserie: { icon: "", name: "Karosserie & Unfall", services: ["Unfallinstandsetzung","Dellenentfernung","Hagelschaden","Rostbeseitigung","Stoßstange","Kotflügel","Ausbeulen ohne Lackieren","Gutachten-Vorbereitung","Smart Repair (Karosserie)","Parkdellen entfernen","Türdellen","Frontschaden","Heckschaden","Wildschaden","Vandalismus-Schaden","Rahmenrichtbank","Schweißarbeiten","Unterbodenschutz","Hohlraumversiegelung","Anbauteile-Montage","Spaltmaße einstellen"] },
  lack: { icon: "", name: "Lackierung & Folierung", services: ["Lackierung","Folierung","Smart Repair","Steinschlag-Lack","Scheibentönung","Teilfolierung","Lackversiegelung","Komplettlackierung","Teillackierung","Stoßstangen-Lackierung","Motorhauben-Lackierung","Felgen lackieren","Bremssattel-Lackierung","Effektlackierung","Mattlackierung","Vollfolierung","Design-Folierung","Dachfolierung","Spiegelkappen-Folierung","Chrom-Delete-Folierung","Lackschutzfolie (PPF)","Steinschlagschutzfolie","Entfolierung","Werbebeschriftung"] },
  pflege: { icon: "", name: "Aufbereitung & Pflege", services: ["Innenreinigung","Außenreinigung","Komplettaufbereitung","Lederreinigung","Lederpflege","Politur","Lackaufbereitung","Lackversiegelung","Keramikversiegelung","Kratzer entfernen","Geruchsentfernung","Ozonbehandlung","Tierhaarentfernung","Fleckenentfernung","Motorraumreinigung","Felgenreinigung","Scheibenversiegelung","Cabrioverdeckpflege","Kunststoffpflege","Scheinwerferaufbereitung","Verkaufsaufbereitung","Leasingrückgabe-Aufbereitung","Wohnmobil-Aufbereitung","Motorrad-Aufbereitung","Innenraumdesinfektion","Nikotingeruch entfernen","Wasserflecken entfernen","Flugrost entfernen","Handwäsche","Trockeneisreinigung","Polsterreinigung","Himmelreinigung","Hologramm-Entfernung","Wachsversiegelung","Interieur-Detailing","Exterieur-Detailing","Show-Car-Finish"] },
  klima: { icon: "", name: "Klimaanlage", services: ["Klimaservice","Klimareparatur","Klimadesinfektion","Kältemittel","Klimakompressor","Klimacheck","Kondensator-Wechsel","Verdampfer-Reinigung","Klimaleitungs-Reparatur","Standheizung / Standklimatisierung"] },
  tuev: { icon: "", name: "TÜV & Prüfung", services: ["HU","AU","HU + AU","TÜV-Vorbereitung","Mängelbeseitigung vor HU","Nachprüfung","Sicherheitscheck","Gebrauchtwagencheck","Bremsenprüfung","Lichttest","Abgasuntersuchung","Klimaanlagencheck","Batteriecheck","Sommercheck","Wintercheck","Urlaubscheck","Unfallcheck","Fahrzeugbewertung","Oldtimer-Gutachten","H-Kennzeichen-Vorbereitung","Änderungsabnahme","Einzelabnahme","Tuning-Abnahme","Gasprüfung","Wohnmobil-Prüfung","Reifencheck","Achsvermessung","Prüfbericht erklären","Kaufberatung vor Gebrauchtwagenkauf"] },
  tuning: { icon: "", name: "Tuning & Codierung", services: ["Chiptuning","Softwareoptimierung","Leistungssteigerung","Leistungsprüfung","Prüfstand","Fahrwerkstuning","Tieferlegung","Gewindefahrwerk","Luftfahrwerk","Spurverbreiterung","Felgen","Reifen","Auspuffanlage","Sportauspuff","Downpipe","Ansaugsystem","Ladeluftkühler","Bremsanlage","Carbonteile","Bodykit","Diffusor","Spoiler","Folierung","Scheibentönung","Ambientebeleuchtung","Innenraumumbau","Codierungen","Freischaltungen","Apple CarPlay Nachrüstung","Android Auto Nachrüstung","Rückfahrkamera","Dashcam","Kennfeldoptimierung","Rückrüstung","Tuning-Abnahme","Stage 1 Tuning","Stage 2 Tuning","Stage 3 Tuning","Getriebe-/DSG-Tuning","Vmax-Anpassung (eintragungsfähig)","Launch Control","Klappenauspuff / Abgasklappensteuerung","Felgenaufbereitung","Felgen hochglanzverdichten","Felgen pulverbeschichten","Airride-Einbau","Sportluftfilter","Fächerkrümmer","Ölkühler-Nachrüstung","Wasser-Methanol-Einspritzung","Turboumbau","Kompressorumbau","Motorumbau","Sperrdifferenzial","Domstrebe / Verstrebungen","Käfigeinbau / Clubsport-Umbau","Schalensitze","Lenkradumbau","Alcantara-Ausstattung","Sitze neu beziehen","Soundanlage / HiFi-Einbau","Subwoofer-Einbau","LED-/Lichtumbau","Scheinwerfer-Umbau","Rückleuchten-Umbau","Grill- / Frontumbau","Heckflügel-Montage","Seitenschweller-Montage","Einzelabnahme / Eintragung","Teilegutachten-Beratung"] },
  autoglas: { icon: "", name: "Autoglas", services: ["Steinschlagreparatur","Frontscheibe wechseln","Seitenscheibe","Heckscheibe","Scheibenversiegelung","Kalibrierung Assistenzsysteme","Panoramadach-Reparatur","Scheibentönung (Folie)","Steinschlag-Check","Scheinwerfer-Abdichtung"] },
  schluessel: { icon: "", name: "Schlüssel & Fahrzeugdiagnose", services: ["Schlüssel nachmachen","Schlüssel anlernen","Funkschlüssel-Reparatur","Wegfahrsperre","Steuergeräte-Diagnose","Fehlerspeicher auslesen","Schlüssel-Notdienst","Schlüsselgehäuse-Reparatur","Keyless-Go anlernen","Schlüsselbatterie wechseln","Zündschloss-Reparatur","Türschloss-Reparatur"] },
  oldtimer: { icon: "", name: "Oldtimer", services: ["Oldtimer-Wartung","Restauration","Vergaser-Einstellung","H-Kennzeichen-Vorbereitung","Ersatzteilsuche","Wertgutachten","Teilrestauration","Vollrestauration","Motorrevision","Blecharbeiten","Innenraum-Neuaufbau","Chrom-Aufarbeitung","Zündung einstellen","Kraftstoffsystem-Reinigung","Einlagerung / Überwinterung"] },
  eauto: { icon: "", name: "E-Auto & Hybrid", services: ["HV-Batterie-Check","E-Antrieb-Diagnose","Ladeelektronik","Hybrid-Service","HV-Reparatur","Wallbox-Beratung","Batteriezertifikat","HV-Batterie-Reparatur","Batteriemodul-Tausch","Software-Update","Wärmepumpen-Service","E-Auto-Inspektion","Ladekabel & Ladezubehör","Rekuperations-Check"] },
  teile: { icon: "", name: "Teile & Zubehör", services: ["Teileverkauf","Teile mit Einbau","Gebrauchtteile","Originalteile (OEM)","Zubehör","Ersatzteil-Bestellung","Teile-Beratung","Altteile-Ankauf"] },
};

// Die 4 Welten (Gruppierung für Suche/Anzeige)
const WORLDS = [
  { key: "werkstatt", icon: "", name: "Werkstatt", cats: ["reparatur","inspektion","reifen","klima","karosserie","autoglas","schluessel","eauto","oldtimer","teile"] },
  { key: "tuning", icon: "", name: "Tuning", cats: ["tuning"] },
  { key: "pflege", icon: "", name: "Aufbereitung", cats: ["pflege","lack"] },
  { key: "tuev", icon: "", name: "TÜV & Prüfung", cats: ["tuev"] },
];

// ============================================================
// TEILE-MARKTPLATZ – Kategorien & Zustände
// ============================================================
const PART_CATS = {
  motor: ["","Motor & Antrieb"],
  auspuff: ["","Auspuff & Abgasanlage"],
  bremsen: ["","Bremsen"],
  fahrwerk: ["","Fahrwerk & Lenkung"],
  felgen: ["","Felgen & Reifen"],
  karosserie: ["","Karosserie & Anbauteile"],
  beleuchtung: ["","Beleuchtung"],
  innenraum: ["","Innenraum"],
  elektrik: ["","Elektrik & Sensoren"],
  klima: ["","Klima & Kühlung"],
  tuningteile: ["","Tuning-Teile"],
  oele: ["","Öle & Flüssigkeiten"],
  pflege: ["","Pflegeprodukte"],
  zubehoer: ["","Zubehör"],
  sonstiges: ["","Sonstiges"],
};
const PART_CONDITIONS = { neu: "Neu", gebraucht: "Gebraucht", generalueberholt: "Generalüberholt" };

// ============================================================
// FAHRZEUGDATENBANK (Beta)
// Struktur ist so aufgebaut, dass sie später 1:1 durch eine
// echte Fahrzeugdaten-API ersetzt werden kann – alle Zugriffe
// laufen über die vehicleLookup()-Funktionen weiter unten.
// ============================================================

// Marke → Modelle
const BRANDS = {
  "Abarth":["500","595","695","124 Spider","500e Abarth","600e"],
  "Aixam":["City","Coupé","Crossline","e-City"],
  "Alfa Romeo":["Giulia","Giulietta","Stelvio","Tonale","MiTo","159","4C","147","156","166","Brera","Spider","GT","Junior","33"],
  "Alpina":["B3","B4","B5","B7","D3","D4","D5","XD3"],
  "Alpine":["A110","A290","A390"],
  "Aston Martin":["Vantage","DB9","DB11","DB12","DBS","DBX","Rapide","Vanquish","Cygnet"],
  "Audi":["A1","A2","A3","A4","A4 Allroad","A5","A6","A6 Allroad","A7","A8","80","100","Q2","Q3","Q4 e-tron","Q5","Q6 e-tron","Q7","Q8","Q8 e-tron","e-tron (SUV)","TT","R8","e-tron GT","Cabriolet (Typ 89)","S1","S3","S4","S5","S6","S7","S8","SQ2","SQ5","SQ7","SQ8","RS2","RS3","RS4","RS5","RS6","RS7","RS Q3","RS Q8","RS e-tron GT","TT RS","TTS"],
  "Bentley":["Continental GT","Flying Spur","Bentayga","Mulsanne","Arnage","Azure"],
  "BMW":["1er","2er","2er Active Tourer","3er","3er GT","4er","5er","5er GT","6er","7er","8er","X1","X2","X3","X4","X5","X6","X7","XM","Z1","Z3","Z4","Z8","i3","i4","i5","i7","i8","iX","iX1","iX2","iX3","M2","M3","M4","M5","M6","M8","X3 M","X4 M","X5 M","X6 M","Z4 M"],
  "BYD":["Atto 3","Dolphin","Dolphin Surf","Seal","Seal U","Sealion 7","Han","Tang"],
  "Cadillac":["ATS","CTS","XT4","XT5","Escalade","Lyriq","BLS","SRX"],
  "Chevrolet":["Spark","Aveo","Cruze","Captiva","Camaro","Corvette","Matiz","Kalos","Lacetti","Nubira","Orlando","Trax","Volt","Silverado","Tahoe"],
  "Chrysler":["300C","PT Cruiser","Voyager","Grand Voyager","Crossfire","Sebring"],
  "Citroën":["C1","C2","C3","C3 Aircross","C4","C4 Cactus","C4 Picasso","C5","C5 Aircross","C5 X","C6","C8","Berlingo","Jumpy","Jumper","Nemo","Saxo","Xsara","Xsara Picasso","SpaceTourer","ë-C4","AMI","DS3","DS4"],
  "Cupra":["Leon","Leon Sportstourer","Formentor","Born","Ateca","Tavascan","Terramar","Raval"],
  "Dacia":["Sandero","Duster","Logan","Jogger","Spring","Lodgy","Dokker","Bigster"],
  "Daewoo":["Matiz","Kalos","Lanos","Nubira","Leganza","Lacetti"],
  "Daihatsu":["Cuore","Sirion","Terios","Materia","Copen","YRV","Charade","Move","Applause"],
  "Dodge":["Challenger","Charger","RAM 1500","Durango","Caliber","Journey","Nitro","Viper"],
  "DS":["DS 3","DS 4","DS 5","DS 7","DS 9","N°8"],
  "Ferrari":["488","F8","Roma","Portofino","296","SF90","Purosangue","458","F430","360","California","812","FF","GTC4Lusso","12Cilindri","Testarossa"],
  "Fiat":["500","500e","500L","500X","600","Panda","Grande Panda","Tipo","Punto","Grande Punto","Bravo","Stilo","Croma","Sedici","Qubo","Fiorino","Freemont","Multipla","Seicento","Cinquecento","Barchetta","Coupé","124 Spider","Ducato","Doblo","Talento","Scudo","Topolino"],
  "Fisker":["Ocean","Karma"],
  "Ford":["Ka","Ka+","Fiesta","Focus","Focus C-MAX","C-MAX","Grand C-MAX","B-MAX","Mondeo","Fusion","Escort","Sierra","Capri","Kuga","Puma","EcoSport","Edge","Explorer","S-MAX","Galaxy","Maverick","Mustang","Mustang Mach-E","Ranger","Ranger Raptor","Transit","Transit Custom","Transit Connect","Transit Courier","Tourneo","Tourneo Custom","Tourneo Connect","Tourneo Courier","F-150"],
  "Genesis":["G70","G80","G90","GV60","GV70","GV80"],
  "Honda":["Jazz","Civic","CR-V","HR-V","ZR-V","Accord","e:Ny1","Honda e","CR-Z","Insight","Legend","Prelude","S2000","FR-V","Stream","NSX"],
  "Hyundai":["i10","i20","i30","i40","ix20","ix35","Getz","Atos","Accent","Matrix","Veloster","Bayon","Kona","Tucson","Santa Fe","Terracan","Ioniq","Ioniq 5","Ioniq 6","Ioniq 9","Inster","Staria","H-1","Nexo"],
  "Ineos":["Grenadier","Quartermaster"],
  "Infiniti":["Q30","Q50","Q60","Q70","QX30","QX50","QX70","FX","G37","M37"],
  "Isuzu":["D-Max","Trooper"],
  "Iveco":["Daily","Massif"],
  "Jaecoo":["7","5"],
  "Jaguar":["XE","XF","XJ","X-Type","S-Type","XK","F-Pace","E-Pace","I-Pace","F-Type"],
  "Jeep":["Renegade","Compass","Cherokee","Grand Cherokee","Wrangler","Avenger","Gladiator","Commander","Patriot","Liberty"],
  "Kia":["Picanto","Rio","Ceed","ProCeed","XCeed","Stonic","Niro","Sportage","Sorento","EV3","EV4","EV5","EV6","EV9","Soul","Optima","Stinger","Venga","Carens","Carnival"],
  "Lada":["Niva","Vesta","Granta","Kalina","Priora","Samara","110","Taiga"],
  "Lamborghini":["Huracán","Aventador","Revuelto","Urus","Temerario","Gallardo","Murciélago","Diablo"],
  "Lancia":["Ypsilon","Delta","Musa","Thema","Thesis","Kappa","Fulvia"],
  "Land Rover":["Defender","Discovery","Discovery Sport","Freelander","Range Rover","Range Rover Sport","Range Rover Velar","Range Rover Evoque"],
  "Leapmotor":["T03","B10","C10"],
  "Lexus":["CT","IS","ES","GS","LS","NX","RX","UX","RZ","LBX","LC","RC","SC","GX"],
  "Ligier":["JS50","JS60","Myli"],
  "Lotus":["Elise","Exige","Evora","Emira","Eletre","Emeya"],
  "Lynk & Co":["01","02","08"],
  "MAN":["TGE"],
  "Maserati":["Ghibli","Quattroporte","Levante","Grecale","MC20","GranTurismo","GranCabrio","Spyder","3200 GT"],
  "Maxus":["eDeliver 3","eDeliver 5","eDeliver 9","T90 EV","Mifa 9"],
  "Mazda":["2","3","5","6","323","626","CX-3","CX-30","CX-5","CX-60","CX-7","CX-80","MX-5","MX-30","RX-7","RX-8","BT-50","Premacy","Tribute"],
  "McLaren":["540C","570S","600LT","720S","765LT","Artura","GT"],
  "Mercedes-Benz":["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","190 (W201)","CLA","CLE","CLK","CLS","SL","SLK/SLC","SLR","SLS AMG","GLA","GLB","GLC","GLE","GLK","GLS","ML","G-Klasse","R-Klasse","V-Klasse","T-Klasse","X-Klasse","Vaneo","Vito","Sprinter","Citan","Marco Polo","EQA","EQB","EQC","EQE","EQS","EQT","EQV","AMG GT","AMG GT 4-Türer","AMG SL","AMG ONE","Maybach S-Klasse","Maybach GLS"],
  "MG":["MG3","MG4","MG5","ZS","HS","EHS","Marvel R","Cyberster"],
  "Mini":["Cooper","Clubman","Countryman","Cabrio","Coupé","Roadster","Paceman","Electric","Aceman"],
  "Mitsubishi":["Space Star","Colt","ASX","Eclipse Cross","Outlander","Pajero","L200","Lancer","Carisma","Galant","Grandis","i-MiEV"],
  "Morgan":["Plus Four","Plus Six","3 Wheeler"],
  "NIO":["ET5","ET7","EL6","EL7","EL8"],
  "Nissan":["Micra","Note","Juke","Qashqai","X-Trail","Leaf","Ariya","Navara","370Z","350Z","GT-R","Almera","Primera","Pixo","Pulsar","Pathfinder","Patrol","Terrano","NV200","Townstar","Primastar","Interstar"],
  "Omoda":["5","9"],
  "Opel":["Adam","Karl","Agila","Corsa","Astra","Insignia","Vectra","Omega","Signum","Tigra","Mokka","Crossland","Grandland","Frontera","Antara","Zafira","Meriva","Cascada","GT","Ampera","Rocks-e","Combo","Vivaro","Movano"],
  "Peugeot":["106","107","108","206","207","208","2008","301","306","307","308","3008","406","407","408","4007","4008","508","5008","607","806","807","1007","RCZ","Bipper","Partner","Rifter","Traveller","Expert","Boxer","iOn"],
  "Polestar":["Polestar 1","Polestar 2","Polestar 3","Polestar 4","Polestar 5"],
  "Porsche":["911","718 Boxster","718 Cayman","Boxster (986/987)","Cayman (987)","Panamera","Macan","Cayenne","Taycan","924","944","968","928","356","914","Carrera GT","918 Spyder"],
  "Renault":["Twingo","Clio","Captur","Megane","Megane E-Tech","Austral","Arkana","Scenic","Espace","Kangoo","Trafic","Master","Zoe","Laguna","Modus","Wind","Koleos","Talisman","Kadjar","R5 E-Tech","R4 E-Tech","Rafale","Symbioz","Alaskan"],
  "Rolls-Royce":["Ghost","Phantom","Cullinan","Spectre","Wraith","Dawn","Silver Shadow","Corniche"],
  "Rover":["25","45","75","Mini (klassisch)"],
  "Saab":["9-3","9-5","900","9000"],
  "Seat":["Mii","Ibiza","Leon","Toledo","Ateca","Arona","Tarraco","Alhambra","Altea","Exeo","Cordoba","Arosa","Marbella","Inca"],
  "Skoda":["Citigo","Fabia","Rapid","Scala","Octavia","Superb","Kamiq","Karoq","Kodiaq","Enyaq","Elroq","Epiq","Yeti","Roomster","Felicia","Favorit"],
  "Smart":["ForTwo","ForFour","Roadster","#1","#3","#5"],
  "Ssangyong":["Tivoli","Korando","Rexton","Musso","Torres","Actyon","Kyron","Rodius"],
  "Subaru":["Impreza","XV","Crosstrek","Forester","Outback","Legacy","Levorg","Justy","Trezia","BRZ","WRX STI","Solterra"],
  "Suzuki":["Alto","Swift","Ignis","Baleno","Vitara","Grand Vitara","S-Cross","SX4","Splash","Wagon R","Celerio","Liana","Kizashi","Jimny","Across","Swace","eVitara"],
  "Tesla":["Model 3","Model S","Model X","Model Y","Cybertruck","Roadster"],
  "Toyota":["Aygo","Aygo X","Yaris","Yaris Cross","Corolla","Corolla Cross","Auris","Avensis","Verso","Corolla Verso","iQ","Urban Cruiser","C-HR","RAV4","Camry","Prius","Supra","GT86","GR86","Celica","MR2","Starlet","Carina","Mirai","Crown","Highlander","Land Cruiser","Hilux","Proace","Proace City","bZ4X"],
  "Trabant":["601","1.1"],
  "VinFast":["VF 6","VF 7","VF 8","VF 9"],
  "Volkswagen":["up!","Lupo","Fox","Polo","Golf","Golf Plus","Golf Sportsvan","Jetta","Bora","Vento","Passat","Passat CC","CC","Arteon","Phaeton","Scirocco","Corrado","Eos","Beetle","New Beetle","Käfer","T-Roc","T-Cross","Taigo","Tiguan","Tiguan Allspace","Touran","Touareg","Sharan","Caddy","Transporter","Multivan","California","Crafter","Amarok","Polo GTI","Golf GTI","Golf GTD","Golf R","T-Roc R","ID.3","ID.4","ID.5","ID.7","ID. Buzz","ID. EVERY1"],
  "Volvo":["C30","C70","V40","V50","V60","V70","V90","S40","S60","S80","S90","240","740","850","940","XC40","XC60","XC70","XC90","C40","EX30","EX40","EC40","EX90","ES90"],
  "Wartburg":["353","1.3"],
  "XPeng":["P7","G6","G9","X9"],
  "Zeekr":["001","7X","X"],
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

// --- Motorisierungen der ausgeschriebenen Performance-Modelle (matchen Kraftstoff + PS) ---
Object.assign(ENGINE_DB, {
  // BMW M
  "BMW|M2":[{n:"M2 (F87)",f:"Benzin",ps:[370,410]},{n:"M2 CS (F87)",f:"Benzin",ps:[450]},{n:"M2 (G87)",f:"Benzin",ps:[460,480]}],
  "BMW|M3":[{n:"M3 (E90/E92)",f:"Benzin",ps:[420]},{n:"M3 (F80)",f:"Benzin",ps:[431,450]},{n:"M3 / Competition (G80)",f:"Benzin",ps:[480,510]},{n:"M3 CS",f:"Benzin",ps:[550]}],
  "BMW|M4":[{n:"M4 (F82)",f:"Benzin",ps:[431,450]},{n:"M4 / Competition (G82)",f:"Benzin",ps:[480,510]},{n:"M4 CSL",f:"Benzin",ps:[550]}],
  "BMW|M5":[{n:"M5 (E60)",f:"Benzin",ps:[507]},{n:"M5 (F10)",f:"Benzin",ps:[560,575]},{n:"M5 / Competition (F90)",f:"Benzin",ps:[600,625]},{n:"M5 (G90, Plug-in-Hybrid)",f:"Plug-in-Hybrid",ps:[727],t:["Automatik"]}],
  "BMW|M6":[{n:"M6 (E63)",f:"Benzin",ps:[507]},{n:"M6 (F13)",f:"Benzin",ps:[560,600]}],
  "BMW|M8":[{n:"M8 / Competition",f:"Benzin",ps:[600,625]}],
  "BMW|X3 M":[{n:"X3 M / Competition",f:"Benzin",ps:[480,510]}],
  "BMW|X4 M":[{n:"X4 M / Competition",f:"Benzin",ps:[480,510]}],
  "BMW|X5 M":[{n:"X5 M / Competition",f:"Benzin",ps:[575,625]}],
  "BMW|X6 M":[{n:"X6 M / Competition",f:"Benzin",ps:[575,625]}],
  "BMW|Z4 M":[{n:"Z4 M40i",f:"Benzin",ps:[340,387]}],
  // Audi S
  "Audi|S1":[{n:"S1 2.0 TFSI",f:"Benzin",ps:[231]}],
  "Audi|S3":[{n:"S3 2.0 TFSI",f:"Benzin",ps:[265,290,300,310,333]}],
  "Audi|S4":[{n:"S4 3.0 TFSI",f:"Benzin",ps:[333,354]},{n:"S4 TDI",f:"Diesel",ps:[347]}],
  "Audi|S5":[{n:"S5 3.0 TFSI",f:"Benzin",ps:[333,354]},{n:"S5 TDI",f:"Diesel",ps:[347]}],
  "Audi|S6":[{n:"S6 4.0 TFSI",f:"Benzin",ps:[420,450]},{n:"S6 TDI",f:"Diesel",ps:[344,349]}],
  "Audi|S7":[{n:"S7 4.0 TFSI",f:"Benzin",ps:[420,450]},{n:"S7 TDI",f:"Diesel",ps:[344,349]}],
  "Audi|S8":[{n:"S8 4.0 TFSI",f:"Benzin",ps:[520,571]}],
  "Audi|SQ2":[{n:"SQ2 2.0 TFSI",f:"Benzin",ps:[300]}],
  "Audi|SQ5":[{n:"SQ5 3.0 TFSI",f:"Benzin",ps:[313,342,354]},{n:"SQ5 TDI",f:"Diesel",ps:[313,341]}],
  "Audi|SQ7":[{n:"SQ7 4.0 TFSI",f:"Benzin",ps:[507]},{n:"SQ7 TDI",f:"Diesel",ps:[435,507]}],
  "Audi|SQ8":[{n:"SQ8 4.0 TFSI",f:"Benzin",ps:[507]},{n:"SQ8 TDI",f:"Diesel",ps:[435]}],
  // Audi RS
  "Audi|RS2":[{n:"RS2 Avant",f:"Benzin",ps:[315]}],
  "Audi|RS3":[{n:"RS3 2.5 TFSI",f:"Benzin",ps:[367,400,401]}],
  "Audi|RS4":[{n:"RS4 Avant",f:"Benzin",ps:[420,450,470]}],
  "Audi|RS5":[{n:"RS5",f:"Benzin",ps:[450,470]}],
  "Audi|RS6":[{n:"RS6 Avant",f:"Benzin",ps:[560,600,630]}],
  "Audi|RS7":[{n:"RS7 Sportback",f:"Benzin",ps:[560,600,630]}],
  "Audi|RS Q3":[{n:"RS Q3",f:"Benzin",ps:[310,340,367,400]}],
  "Audi|RS Q8":[{n:"RS Q8",f:"Benzin",ps:[600,630]}],
  "Audi|RS e-tron GT":[{n:"RS e-tron GT",f:"Elektro",ps:[598,646,925],t:["Automatik"]}],
  "Audi|TT RS":[{n:"TT RS 2.5 TFSI",f:"Benzin",ps:[340,400]}],
  "Audi|TTS":[{n:"TTS 2.0 TFSI",f:"Benzin",ps:[272,286,306,320]}],
  // Mercedes-AMG (eigenständige Modelle)
  "Mercedes-Benz|AMG GT":[{n:"AMG GT (Coupé/Roadster)",f:"Benzin",ps:[476,530,585,639]},{n:"AMG GT 43/53 (Plug-in)",f:"Plug-in-Hybrid",ps:[476,816],t:["Automatik"]}],
  "Mercedes-Benz|AMG GT 4-Türer":[{n:"GT 43/53",f:"Benzin",ps:[367,435]},{n:"GT 63 / S E Performance",f:"Benzin",ps:[585,639]},{n:"GT 63 S E Performance (Plug-in)",f:"Plug-in-Hybrid",ps:[843],t:["Automatik"]}],
  "Mercedes-Benz|AMG SL":[{n:"SL 43",f:"Benzin",ps:[381]},{n:"SL 55 / 63",f:"Benzin",ps:[476,585]},{n:"SL 63 S E Performance (Plug-in)",f:"Plug-in-Hybrid",ps:[816],t:["Automatik"]}],
  "Mercedes-Benz|AMG ONE":[{n:"AMG ONE (F1-Hybrid)",f:"Plug-in-Hybrid",ps:[1063],t:["Automatik"]}],
  "Mercedes-Benz|Maybach S-Klasse":[{n:"Maybach S 580",f:"Benzin",ps:[503]},{n:"Maybach S 680",f:"Benzin",ps:[612]}],
  "Mercedes-Benz|Maybach GLS":[{n:"Maybach GLS 600",f:"Benzin",ps:[558]}],
  // VW GTI/GTD/R
  "Volkswagen|Polo GTI":[{n:"Polo GTI 2.0 TSI",f:"Benzin",ps:[180,200,207]}],
  "Volkswagen|Golf GTI":[{n:"Golf GTI 2.0 TSI",f:"Benzin",ps:[220,230,245,265,300]},{n:"Golf GTI Clubsport",f:"Benzin",ps:[300]}],
  "Volkswagen|Golf GTD":[{n:"Golf GTD 2.0 TDI",f:"Diesel",ps:[170,184,200]}],
  "Volkswagen|Golf R":[{n:"Golf R 2.0 TSI",f:"Benzin",ps:[270,300,310,320,333]}],
  "Volkswagen|T-Roc R":[{n:"T-Roc R 2.0 TSI",f:"Benzin",ps:[300]}],
  "Cupra|Leon Sportstourer":[{n:"1.5/2.0 TSI",f:"Benzin",ps:[150,190,245,300]},{n:"e-Hybrid",f:"Plug-in-Hybrid",ps:[204,245],t:["DSG / Doppelkupplung"]},{n:"2.0 TDI",f:"Diesel",ps:[150]}],
});

// Fahrzeugkategorien nach mobile.de-Vorbild
const BODIES = ["Limousine","Kombi","Kleinwagen","Cabrio/Roadster","Sportwagen/Coupé","SUV/Geländewagen/Pickup","Van/Kleinbus","Transporter","Wohnmobil","Andere"];
// Kraftstoffarten nach mobile.de-Vorbild
const FUELS = ["Benzin","Diesel","Elektro","Hybrid (Benzin/Elektro)","Hybrid (Diesel/Elektro)","Plug-in-Hybrid","Autogas (LPG)","Erdgas (CNG)","Wasserstoff","Ethanol","Andere"];
// Getriebe nach mobile.de-Vorbild
const TRANS = ["Schaltgetriebe","Automatik","Halbautomatik"];
// Weitere mobile.de-Auswahllisten
const COLORS = ["Beige","Blau","Braun","Gelb","Gold","Grau","Grün","Orange","Rot","Schwarz","Silber","Violett","Weiß","Andere"];
const DOORS = ["2/3","4/5","6/7"];
const SEATS = [2,3,4,5,6,7,8,9];
const EZ_MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
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

// --- Zusätzliche kuratierte Motorisierungen (Beta-Ausbau 2) ---
Object.assign(ENGINE_DB, {
  "Audi|A1":[{n:"25 TFSI",f:"Benzin",ps:[95]},{n:"30 TFSI",f:"Benzin",ps:[110,116]},{n:"35 TFSI",f:"Benzin",ps:[150]},{n:"40 TFSI",f:"Benzin",ps:[200,207]},{n:"1.6 TDI",f:"Diesel",ps:[90,105,116]}],
  "Audi|A5":[{n:"2.0 TFSI (40/45)",f:"Benzin",ps:[190,204,245,252,265]},{n:"S5",f:"Benzin",ps:[333,354]},{n:"RS5",f:"Benzin",ps:[450]},{n:"2.0 TDI (35/40)",f:"Diesel",ps:[150,163,190,204]},{n:"3.0 TDI (50)",f:"Diesel",ps:[218,231,286]}],
  "Audi|Q2":[{n:"30 TFSI",f:"Benzin",ps:[110,116]},{n:"35 TFSI",f:"Benzin",ps:[150]},{n:"40 TFSI quattro",f:"Benzin",ps:[190]},{n:"30/35 TDI",f:"Diesel",ps:[116,150]}],
  "Audi|Q7":[{n:"45/55 TFSI",f:"Benzin",ps:[245,333,340]},{n:"SQ7",f:"Benzin",ps:[435,507]},{n:"45/50 TDI",f:"Diesel",ps:[231,245,286]},{n:"60 TFSI e (Plug-in)",f:"Plug-in-Hybrid",ps:[381,462],t:["Automatik"]}],
  "Audi|TT":[{n:"1.8/2.0 TFSI (40/45)",f:"Benzin",ps:[180,197,211,230,245]},{n:"TTS",f:"Benzin",ps:[272,286,306,320]},{n:"TT RS",f:"Benzin",ps:[340,400]},{n:"2.0 TDI",f:"Diesel",ps:[184]}],
  "Audi|e-tron GT":[{n:"e-tron GT quattro",f:"Elektro",ps:[476,530],t:["Automatik"]},{n:"RS e-tron GT",f:"Elektro",ps:[598,646,925],t:["Automatik"]}],
  "BMW|2er":[{n:"218i",f:"Benzin",ps:[136,140,156]},{n:"220i",f:"Benzin",ps:[178,184]},{n:"M235i/M240i",f:"Benzin",ps:[306,326,340,374]},{n:"216d/218d",f:"Diesel",ps:[116,136,150]},{n:"220d",f:"Diesel",ps:[163,184,190]}],
  "BMW|4er":[{n:"420i",f:"Benzin",ps:[163,170,184]},{n:"430i",f:"Benzin",ps:[245,252,258]},{n:"M440i",f:"Benzin",ps:[374]},{n:"418d/420d",f:"Diesel",ps:[136,150,163,184,190]},{n:"430d",f:"Diesel",ps:[231,245,258,286]},{n:"M4",f:"Benzin",ps:[431,450,480,510,530]}],
  "BMW|7er":[{n:"730i/740i",f:"Benzin",ps:[258,326,333,340,381]},{n:"750i",f:"Benzin",ps:[408,449,530]},{n:"730d",f:"Diesel",ps:[211,231,245,258,265,286,298]},{n:"740d",f:"Diesel",ps:[299,313,320,340,352]},{n:"745e/750e (Plug-in)",f:"Plug-in-Hybrid",ps:[394,489],t:["Automatik"]},{n:"i7 (Elektro)",f:"Elektro",ps:[449,544,660],t:["Automatik"]}],
  "BMW|Z4":[{n:"sDrive20i",f:"Benzin",ps:[156,163,184,197]},{n:"sDrive23i/28i/30i",f:"Benzin",ps:[204,218,245,258]},{n:"sDrive35i/M40i",f:"Benzin",ps:[306,340]}],
  "BMW|X2":[{n:"sDrive18i/20i",f:"Benzin",ps:[136,140,178,192]},{n:"M35i",f:"Benzin",ps:[300,306,317]},{n:"sDrive18d/xDrive20d",f:"Diesel",ps:[136,150,163,190]},{n:"iX2 (Elektro)",f:"Elektro",ps:[204,313],t:["Automatik"]}],
  "BMW|iX":[{n:"xDrive40",f:"Elektro",ps:[326],t:["Automatik"]},{n:"xDrive50",f:"Elektro",ps:[523],t:["Automatik"]},{n:"M60",f:"Elektro",ps:[619],t:["Automatik"]}],
  "Mercedes-Benz|B-Klasse":[{n:"B160–B200",f:"Benzin",ps:[102,109,122,136,156,163]},{n:"B250",f:"Benzin",ps:[211,224]},{n:"B160d–B220d",f:"Diesel",ps:[90,95,109,116,136,150,177,190]}],
  "Mercedes-Benz|CLA":[{n:"CLA180–CLA250",f:"Benzin",ps:[122,136,163,190,211,218,224]},{n:"CLA35/45 AMG",f:"Benzin",ps:[306,381,421]},{n:"CLA180d–CLA220d",f:"Diesel",ps:[109,116,136,150,177,190]},{n:"CLA250e (Plug-in)",f:"Plug-in-Hybrid",ps:[218],t:["Automatik","DSG / Doppelkupplung"]}],
  "Mercedes-Benz|GLA":[{n:"GLA180–GLA250",f:"Benzin",ps:[122,136,156,163,211,224]},{n:"GLA35/45 AMG",f:"Benzin",ps:[306,381,421]},{n:"GLA180d–GLA220d",f:"Diesel",ps:[109,116,136,150,177,190]}],
  "Mercedes-Benz|GLB":[{n:"GLB180–GLB250",f:"Benzin",ps:[136,163,224]},{n:"GLB35 AMG",f:"Benzin",ps:[306]},{n:"GLB180d–GLB220d",f:"Diesel",ps:[116,150,190]}],
  "Mercedes-Benz|GLE":[{n:"GLE350–GLE450",f:"Benzin",ps:[258,272,333,367,381]},{n:"GLE53/63 AMG",f:"Benzin",ps:[435,571,612]},{n:"GLE250d–GLE400d",f:"Diesel",ps:[204,231,245,272,286,330,340]},{n:"GLE350de/500e (Plug-in)",f:"Plug-in-Hybrid",ps:[320,333],t:["Automatik"]}],
  "Mercedes-Benz|S-Klasse":[{n:"S350–S450",f:"Benzin",ps:[306,333,367,381,435]},{n:"S500–S580",f:"Benzin",ps:[435,455,503]},{n:"S350d–S400d",f:"Diesel",ps:[258,286,330,340]},{n:"S580e (Plug-in)",f:"Plug-in-Hybrid",ps:[510],t:["Automatik"]},{n:"S63/S65 AMG",f:"Benzin",ps:[585,612,630,802]}],
  "Mercedes-Benz|Vito":[{n:"Vito 111–124 CDI",f:"Diesel",ps:[102,114,136,163,190,237]},{n:"eVito (Elektro)",f:"Elektro",ps:[116,204],t:["Automatik"]}],
  "Mercedes-Benz|Sprinter":[{n:"211–319 CDI",f:"Diesel",ps:[114,143,163,170,190]},{n:"eSprinter (Elektro)",f:"Elektro",ps:[116,136,204],t:["Automatik"]}],
  "Volkswagen|up!":[{n:"1.0 MPI",f:"Benzin",ps:[60,65,75]},{n:"1.0 TSI",f:"Benzin",ps:[90,115]},{n:"GTI",f:"Benzin",ps:[115]},{n:"e-up! (Elektro)",f:"Elektro",ps:[82,83],t:["Automatik"]},{n:"1.0 EcoFuel (CNG)",f:"Autogas (LPG/CNG)",ps:[68]}],
  "Volkswagen|T-Roc":[{n:"1.0 TSI",f:"Benzin",ps:[110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"2.0 TSI (R)",f:"Benzin",ps:[190,300]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[115,150]}],
  "Volkswagen|T-Cross":[{n:"1.0 TSI",f:"Benzin",ps:[95,110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"1.6 TDI",f:"Diesel",ps:[95]}],
  "Volkswagen|Arteon":[{n:"1.5/2.0 TSI",f:"Benzin",ps:[150,190,280]},{n:"2.0 TDI",f:"Diesel",ps:[150,190,200,240]},{n:"eHybrid",f:"Plug-in-Hybrid",ps:[218],t:["DSG / Doppelkupplung"]}],
  "Volkswagen|Touareg":[{n:"3.0 V6 TSI",f:"Benzin",ps:[340]},{n:"3.0 V6 TDI",f:"Diesel",ps:[204,231,262,286]},{n:"4.0 V8 TDI",f:"Diesel",ps:[421]},{n:"eHybrid/R",f:"Plug-in-Hybrid",ps:[381,462],t:["Automatik"]}],
  "Volkswagen|Caddy":[{n:"1.0/1.5 TSI",f:"Benzin",ps:[84,102,114,116]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[75,102,110,122,150]},{n:"TGI (CNG)",f:"Autogas (LPG/CNG)",ps:[110,131]}],
  "Volkswagen|Transporter":[{n:"2.0 TSI",f:"Benzin",ps:[150,204]},{n:"2.0 TDI",f:"Diesel",ps:[84,90,102,110,114,140,150,180,199,204]},{n:"e-Transporter",f:"Elektro",ps:[136],t:["Automatik"]}],
  "Volkswagen|Sharan":[{n:"1.4/2.0 TSI",f:"Benzin",ps:[150,220]},{n:"2.0 TDI",f:"Diesel",ps:[115,140,150,177,184]}],
  "Volkswagen|ID.7":[{n:"Pro",f:"Elektro",ps:[286],t:["Automatik"]},{n:"GTX",f:"Elektro",ps:[340],t:["Automatik"]}],
  "Volkswagen|ID. Buzz":[{n:"Pro",f:"Elektro",ps:[204,286],t:["Automatik"]},{n:"GTX",f:"Elektro",ps:[340],t:["Automatik"]}],
  "Opel|Mokka":[{n:"1.2 Turbo",f:"Benzin",ps:[100,130,136]},{n:"1.4 Turbo",f:"Benzin",ps:[140,152]},{n:"1.5 Diesel",f:"Diesel",ps:[102,110]},{n:"1.6 CDTI",f:"Diesel",ps:[110,136]},{n:"Mokka-e (Elektro)",f:"Elektro",ps:[136,156],t:["Automatik"]}],
  "Opel|Insignia":[{n:"1.4/1.5/2.0 Turbo",f:"Benzin",ps:[140,145,165,170,200,230,260]},{n:"GSi/OPC",f:"Benzin",ps:[230,325]},{n:"1.5/1.6/2.0 Diesel",f:"Diesel",ps:[110,122,136,170,174,210]}],
  "Opel|Grandland":[{n:"1.2 Turbo",f:"Benzin",ps:[130,136]},{n:"1.6 Turbo",f:"Benzin",ps:[180]},{n:"1.5 Diesel",f:"Diesel",ps:[130]},{n:"Hybrid/Hybrid4 (Plug-in)",f:"Plug-in-Hybrid",ps:[224,300],t:["Automatik"]}],
  "Opel|Crossland":[{n:"1.2 / 1.2 Turbo",f:"Benzin",ps:[83,110,130]},{n:"1.5 Diesel",f:"Diesel",ps:[102,110,120]}],
  "Opel|Zafira":[{n:"1.4/1.6/1.8 (Benzin)",f:"Benzin",ps:[120,140,170,200]},{n:"1.6/2.0 CDTI",f:"Diesel",ps:[120,134,136,165,170]},{n:"Zafira-e Life",f:"Elektro",ps:[136],t:["Automatik"]}],
  "Ford|Puma":[{n:"1.0 EcoBoost (Mildhybrid)",f:"Benzin",ps:[125,155]},{n:"ST",f:"Benzin",ps:[170,200]}],
  "Ford|Mondeo":[{n:"1.0/1.5 EcoBoost",f:"Benzin",ps:[125,160,165]},{n:"2.0 EcoBoost",f:"Benzin",ps:[203,240]},{n:"1.5/2.0 TDCi",f:"Diesel",ps:[120,150,180,190,210]},{n:"2.0 Hybrid",f:"Hybrid",ps:[187],t:["Automatik"]}],
  "Ford|S-MAX":[{n:"1.5/2.0 EcoBoost",f:"Benzin",ps:[160,165,240]},{n:"2.0 TDCi/EcoBlue",f:"Diesel",ps:[120,150,180,190,240]},{n:"2.5 FHEV (Hybrid)",f:"Hybrid",ps:[190],t:["Automatik"]}],
  "Ford|Ranger":[{n:"2.0 EcoBlue",f:"Diesel",ps:[170,205,213]},{n:"3.0 V6 Diesel",f:"Diesel",ps:[240,250]},{n:"Raptor 3.0 V6",f:"Benzin",ps:[292]}],
  "Ford|Transit":[{n:"2.0 EcoBlue",f:"Diesel",ps:[105,130,170,185]},{n:"E-Transit (Elektro)",f:"Elektro",ps:[184,269],t:["Automatik"]}],
  "Skoda|Superb":[{n:"1.4/1.5 TSI",f:"Benzin",ps:[125,150]},{n:"2.0 TSI",f:"Benzin",ps:[190,220,272,280]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[120,122,150,190,200]},{n:"iV (Plug-in)",f:"Plug-in-Hybrid",ps:[218],t:["DSG / Doppelkupplung"]}],
  "Skoda|Scala":[{n:"1.0 TSI",f:"Benzin",ps:[95,110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"1.6 TDI",f:"Diesel",ps:[115]}],
  "Skoda|Kamiq":[{n:"1.0 TSI",f:"Benzin",ps:[95,110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"1.6 TDI",f:"Diesel",ps:[115]}],
  "Skoda|Karoq":[{n:"1.0/1.5 TSI",f:"Benzin",ps:[110,115,150]},{n:"2.0 TSI",f:"Benzin",ps:[190]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[115,116,150,190]}],
  "Skoda|Kodiaq":[{n:"1.4/1.5 TSI",f:"Benzin",ps:[125,150]},{n:"2.0 TSI (RS)",f:"Benzin",ps:[180,190,245]},{n:"2.0 TDI",f:"Diesel",ps:[150,190,200]}],
  "Skoda|Citigo":[{n:"1.0 MPI",f:"Benzin",ps:[60,75]},{n:"e iV (Elektro)",f:"Elektro",ps:[83],t:["Automatik"]}],
  "Skoda|Enyaq":[{n:"60",f:"Elektro",ps:[179,204],t:["Automatik"]},{n:"80/85",f:"Elektro",ps:[204,286],t:["Automatik"]},{n:"RS",f:"Elektro",ps:[299,340],t:["Automatik"]}],
  "Seat|Arona":[{n:"1.0 TSI",f:"Benzin",ps:[95,110,115]},{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"1.6 TDI",f:"Diesel",ps:[95]}],
  "Seat|Ateca":[{n:"1.0/1.5 TSI",f:"Benzin",ps:[110,115,150]},{n:"2.0 TSI",f:"Benzin",ps:[190]},{n:"1.6/2.0 TDI",f:"Diesel",ps:[115,150]},{n:"Cupra Ateca",f:"Benzin",ps:[300]}],
  "Seat|Alhambra":[{n:"1.4/2.0 TSI",f:"Benzin",ps:[150,220]},{n:"2.0 TDI",f:"Diesel",ps:[115,140,150,177,184]}],
  "Seat|Mii":[{n:"1.0 MPI",f:"Benzin",ps:[60,75]},{n:"electric",f:"Elektro",ps:[83],t:["Automatik"]}],
  "Toyota|Aygo":[{n:"1.0 VVT-i",f:"Benzin",ps:[68,69,72]}],
  "Toyota|Aygo X":[{n:"1.0 VVT-i",f:"Benzin",ps:[72]}],
  "Toyota|C-HR":[{n:"1.2 Turbo",f:"Benzin",ps:[116]},{n:"1.8/2.0 Hybrid",f:"Hybrid",ps:[122,140,184,197],t:["Automatik"]}],
  "Toyota|Prius":[{n:"1.8/2.0 Hybrid",f:"Hybrid",ps:[122,136,152],t:["Automatik"]},{n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[122,223],t:["Automatik"]}],
  "Toyota|Hilux":[{n:"2.4/2.8 D-4D",f:"Diesel",ps:[150,204,224]}],
  "Toyota|Land Cruiser":[{n:"2.8 D-4D",f:"Diesel",ps:[177,204,205]},{n:"4.0 V6",f:"Benzin",ps:[249,282]}],
  "Toyota|bZ4X":[{n:"FWD",f:"Elektro",ps:[204],t:["Automatik"]},{n:"AWD",f:"Elektro",ps:[218],t:["Automatik"]}],
  "Renault|Twingo":[{n:"SCe/TCe",f:"Benzin",ps:[65,70,75,90,95]},{n:"Electric",f:"Elektro",ps:[82],t:["Automatik"]}],
  "Renault|Captur":[{n:"TCe",f:"Benzin",ps:[90,100,130,140,155]},{n:"dCi",f:"Diesel",ps:[90,95,110,115]},{n:"E-Tech (Hybrid/Plug-in)",f:"Hybrid",ps:[145,160],t:["Automatik"]}],
  "Renault|Megane":[{n:"TCe",f:"Benzin",ps:[100,115,130,140,160]},{n:"dCi",f:"Diesel",ps:[90,110,115,150]},{n:"RS",f:"Benzin",ps:[280,300]}],
  "Renault|Megane E-Tech":[{n:"EV40",f:"Elektro",ps:[130],t:["Automatik"]},{n:"EV60",f:"Elektro",ps:[220],t:["Automatik"]}],
  "Renault|Zoe":[{n:"R90/R110",f:"Elektro",ps:[88,92,109],t:["Automatik"]},{n:"R135",f:"Elektro",ps:[135],t:["Automatik"]}],
  "Renault|Kangoo":[{n:"TCe",f:"Benzin",ps:[100,130]},{n:"Blue dCi",f:"Diesel",ps:[75,95,115]},{n:"E-Tech (Elektro)",f:"Elektro",ps:[122],t:["Automatik"]}],
  "Peugeot|108":[{n:"1.0/1.2 VTi",f:"Benzin",ps:[68,72,82]}],
  "Peugeot|2008":[{n:"1.2 PureTech",f:"Benzin",ps:[82,100,110,130,155]},{n:"1.5 BlueHDi",f:"Diesel",ps:[100,110,120,130]},{n:"e-2008",f:"Elektro",ps:[136,156],t:["Automatik"]}],
  "Peugeot|3008":[{n:"1.2/1.6 PureTech",f:"Benzin",ps:[130,165,180]},{n:"1.5/2.0 BlueHDi",f:"Diesel",ps:[130,150,180]},{n:"Hybrid/Hybrid4 (Plug-in)",f:"Plug-in-Hybrid",ps:[225,300],t:["Automatik"]},{n:"e-3008",f:"Elektro",ps:[210,230,320],t:["Automatik"]}],
  "Peugeot|508":[{n:"1.6 PureTech",f:"Benzin",ps:[180,225]},{n:"1.5/2.0 BlueHDi",f:"Diesel",ps:[130,160,180]},{n:"Hybrid (Plug-in)",f:"Plug-in-Hybrid",ps:[225,360],t:["Automatik"]}],
  "Citroën|C1":[{n:"1.0/1.2 VTi",f:"Benzin",ps:[68,72,82]}],
  "Citroën|C3":[{n:"1.2 PureTech",f:"Benzin",ps:[82,83,110]},{n:"1.5/1.6 BlueHDi",f:"Diesel",ps:[75,100,102]},{n:"ë-C3 (Elektro)",f:"Elektro",ps:[113],t:["Automatik"]}],
  "Citroën|Berlingo":[{n:"1.2 PureTech",f:"Benzin",ps:[110,130]},{n:"1.5 BlueHDi",f:"Diesel",ps:[75,100,102,130]},{n:"ë-Berlingo",f:"Elektro",ps:[136],t:["Automatik"]}],
  "Fiat|Panda":[{n:"1.0 Hybrid",f:"Hybrid",ps:[70]},{n:"0.9 TwinAir",f:"Benzin",ps:[85,90]},{n:"1.2 (Benzin)",f:"Benzin",ps:[69]},{n:"1.3 Multijet",f:"Diesel",ps:[75,95]}],
  "Fiat|Tipo":[{n:"1.0/1.4 (Benzin)",f:"Benzin",ps:[95,100,120]},{n:"1.3/1.6 Multijet",f:"Diesel",ps:[95,120,130]}],
  "Fiat|Ducato":[{n:"2.2/2.3 Multijet",f:"Diesel",ps:[120,140,160,180]},{n:"E-Ducato (Elektro)",f:"Elektro",ps:[122],t:["Automatik"]}],
  "Fiat|500e":[{n:"500e (24/42 kWh)",f:"Elektro",ps:[95,118],t:["Automatik"]}],
  "Hyundai|i10":[{n:"1.0/1.2 MPI",f:"Benzin",ps:[63,67,79,84,87]},{n:"N Line 1.0 T-GDI",f:"Benzin",ps:[90,100]}],
  "Hyundai|i20":[{n:"1.0 T-GDI",f:"Benzin",ps:[100,120]},{n:"1.2 MPI",f:"Benzin",ps:[79,84]},{n:"N/N Performance",f:"Benzin",ps:[204]}],
  "Hyundai|Kona":[{n:"1.0/1.6 T-GDI",f:"Benzin",ps:[120,198]},{n:"Hybrid",f:"Hybrid",ps:[141],t:["Automatik","DSG / Doppelkupplung"]},{n:"Elektro (39/64 kWh)",f:"Elektro",ps:[136,204],t:["Automatik"]}],
  "Hyundai|Ioniq 5":[{n:"58 kWh",f:"Elektro",ps:[170],t:["Automatik"]},{n:"77 kWh",f:"Elektro",ps:[229,325],t:["Automatik"]},{n:"N",f:"Elektro",ps:[650],t:["Automatik"]}],
  "Kia|Picanto":[{n:"1.0/1.2 MPI",f:"Benzin",ps:[63,67,79,84]},{n:"1.0 T-GDI",f:"Benzin",ps:[100]}],
  "Kia|Rio":[{n:"1.0 T-GDI",f:"Benzin",ps:[100,120]},{n:"1.2 MPI",f:"Benzin",ps:[84]}],
  "Kia|Niro":[{n:"Hybrid",f:"Hybrid",ps:[129,141],t:["DSG / Doppelkupplung","Automatik"]},{n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[141,183],t:["DSG / Doppelkupplung"]},{n:"EV (64 kWh)",f:"Elektro",ps:[204],t:["Automatik"]}],
  "Kia|EV6":[{n:"Standard (58 kWh)",f:"Elektro",ps:[170],t:["Automatik"]},{n:"Long Range (77 kWh)",f:"Elektro",ps:[229,325],t:["Automatik"]},{n:"GT",f:"Elektro",ps:[585],t:["Automatik"]}],
  "Nissan|Micra":[{n:"1.0 IG-T",f:"Benzin",ps:[71,92,100,117]},{n:"1.5 dCi",f:"Diesel",ps:[90]}],
  "Nissan|Juke":[{n:"1.0 DIG-T",f:"Benzin",ps:[114,117]},{n:"1.6 DIG-T (Nismo)",f:"Benzin",ps:[190,200,214,218]},{n:"1.5 dCi",f:"Diesel",ps:[110]},{n:"Hybrid",f:"Hybrid",ps:[143],t:["Automatik"]}],
  "Nissan|Leaf":[{n:"40 kWh",f:"Elektro",ps:[150],t:["Automatik"]},{n:"e+ 62 kWh",f:"Elektro",ps:[217],t:["Automatik"]}],
  "Mazda|2":[{n:"Skyactiv-G",f:"Benzin",ps:[75,90,115]},{n:"Hybrid (Yaris-Basis)",f:"Hybrid",ps:[116],t:["Automatik"]}],
  "Mazda|6":[{n:"Skyactiv-G",f:"Benzin",ps:[145,165,194]},{n:"Skyactiv-D",f:"Diesel",ps:[150,175,184]}],
  "Mazda|CX-3":[{n:"Skyactiv-G",f:"Benzin",ps:[120,121,150]},{n:"Skyactiv-D",f:"Diesel",ps:[105,115]}],
  "Mazda|CX-30":[{n:"Skyactiv-G/X",f:"Benzin",ps:[122,150,186]},{n:"Skyactiv-D",f:"Diesel",ps:[116]}],
  "Mazda|MX-5":[{n:"1.5 Skyactiv-G",f:"Benzin",ps:[131,132]},{n:"2.0 Skyactiv-G",f:"Benzin",ps:[160,184]}],
  "Volvo|XC40":[{n:"T3–T5/B3–B5 (Benzin)",f:"Benzin",ps:[156,163,190,197,247,250]},{n:"D3/D4 (Diesel)",f:"Diesel",ps:[150,190]},{n:"Recharge (Plug-in)",f:"Plug-in-Hybrid",ps:[211,262],t:["Automatik"]},{n:"Recharge Pure Electric",f:"Elektro",ps:[231,238,408],t:["Automatik"]}],
  "Volvo|V60":[{n:"B3–B5 (Benzin)",f:"Benzin",ps:[163,197,250]},{n:"D3/D4 (Diesel)",f:"Diesel",ps:[150,190]},{n:"T6/T8 Recharge (Plug-in)",f:"Plug-in-Hybrid",ps:[340,350,455],t:["Automatik"]}],
  "Mini|Countryman":[{n:"One/Cooper",f:"Benzin",ps:[102,136,156,170,178]},{n:"Cooper S/JCW",f:"Benzin",ps:[178,192,204,231,300,306]},{n:"Cooper D/SD",f:"Diesel",ps:[112,116,150,190]},{n:"Cooper SE (Plug-in/Elektro)",f:"Plug-in-Hybrid",ps:[220,224],t:["Automatik"]}],
  "Smart|ForTwo":[{n:"0.9/1.0 (Benzin)",f:"Benzin",ps:[61,66,71,82,90,109]},{n:"EQ (Elektro)",f:"Elektro",ps:[82],t:["Automatik"]}],
  "Dacia|Spring":[{n:"Electric 45/65",f:"Elektro",ps:[45,65],t:["Automatik"]}],
  "Honda|Jazz":[{n:"1.3/1.5 i-VTEC",f:"Benzin",ps:[102,130]},{n:"e:HEV (Hybrid)",f:"Hybrid",ps:[109,122],t:["Automatik"]}],
  "Honda|Civic":[{n:"1.0/1.5 VTEC Turbo",f:"Benzin",ps:[126,129,182]},{n:"e:HEV (Hybrid)",f:"Hybrid",ps:[184],t:["Automatik"]},{n:"Type R",f:"Benzin",ps:[310,320,329]},{n:"1.6 i-DTEC",f:"Diesel",ps:[120]}],
  "Porsche|718 Boxster":[{n:"718 (2.0)",f:"Benzin",ps:[300]},{n:"718 S (2.5)",f:"Benzin",ps:[350]},{n:"GTS 4.0",f:"Benzin",ps:[365,400]},{n:"Spyder",f:"Benzin",ps:[420]}],
  "Porsche|718 Cayman":[{n:"718 (2.0)",f:"Benzin",ps:[300]},{n:"718 S (2.5)",f:"Benzin",ps:[350]},{n:"GTS 4.0",f:"Benzin",ps:[365,400]},{n:"GT4/GT4 RS",f:"Benzin",ps:[420,500]}],
  "Porsche|Panamera":[{n:"Panamera (Basis)",f:"Benzin",ps:[300,330,353]},{n:"4S/GTS",f:"Benzin",ps:[420,440,460,473,480]},{n:"Turbo",f:"Benzin",ps:[500,550,630]},{n:"Diesel",f:"Diesel",ps:[250,300,422]},{n:"E-Hybrid",f:"Plug-in-Hybrid",ps:[462,560,680,700],t:["Automatik"]}],
  "Porsche|Taycan":[{n:"Taycan (Basis)",f:"Elektro",ps:[408,435],t:["Automatik"]},{n:"4S",f:"Elektro",ps:[530,571],t:["Automatik"]},{n:"Turbo/Turbo S",f:"Elektro",ps:[680,761,952],t:["Automatik"]}],
  "Cupra|Formentor":[{n:"1.5 TSI",f:"Benzin",ps:[150]},{n:"2.0 TSI",f:"Benzin",ps:[190,245,310]},{n:"e-Hybrid",f:"Plug-in-Hybrid",ps:[204,245],t:["DSG / Doppelkupplung"]},{n:"2.0 TDI",f:"Diesel",ps:[150]}],
  "Cupra|Born":[{n:"58 kWh",f:"Elektro",ps:[204,231],t:["Automatik"]},{n:"77 kWh",f:"Elektro",ps:[231],t:["Automatik"]},{n:"VZ",f:"Elektro",ps:[326],t:["Automatik"]}],
  "Alfa Romeo|Giulia":[{n:"2.0 Turbo",f:"Benzin",ps:[200,280]},{n:"2.2 Diesel",f:"Diesel",ps:[136,150,160,180,190,210]},{n:"Quadrifoglio",f:"Benzin",ps:[510,520]}],
  "Alfa Romeo|Giulietta":[{n:"1.4 TB",f:"Benzin",ps:[120,150,170]},{n:"1.75 TBi (QV)",f:"Benzin",ps:[235,240]},{n:"1.6/2.0 JTDM",f:"Diesel",ps:[105,120,150,170,175]}],
  "Tesla|Model S":[{n:"75D/100D Long Range",f:"Elektro",ps:[525,613,670],t:["Automatik"]},{n:"P100D/Plaid",f:"Elektro",ps:[772,1020],t:["Automatik"]}],
  "Tesla|Model X":[{n:"Long Range",f:"Elektro",ps:[525,670],t:["Automatik"]},{n:"Plaid",f:"Elektro",ps:[1020],t:["Automatik"]}],
});

// --- Marken-Vorgaben: realistische Motorfamilien für ALLE Marken ---
Object.assign(ENGINE_BRAND_DEFAULT, {
  "Abarth":[{n:"1.4 T-Jet",f:"Benzin",ps:[135,145,160,165,180]},{n:"500e Abarth (Elektro)",f:"Elektro",ps:[155],t:["Automatik"]}],
  "Alfa Romeo":[{n:"1.4 TB / 2.0 Turbo (Benzin)",f:"Benzin",ps:[120,150,170,200,280]},{n:"1.6/2.2 JTDM (Diesel)",f:"Diesel",ps:[105,120,150,180,210]},{n:"Quadrifoglio",f:"Benzin",ps:[510,520]},{n:"Hybrid/Plug-in",f:"Plug-in-Hybrid",ps:[160,280],t:["Automatik"]}],
  "Aston Martin":[{n:"4.0 V8",f:"Benzin",ps:[510,528,535]},{n:"5.2 V12",f:"Benzin",ps:[639,715,725]}],
  "Audi":[{n:"TFSI (Benzin)",f:"Benzin",ps:[110,150,190,204,245,265,340]},{n:"TDI (Diesel)",f:"Diesel",ps:[116,150,190,204,231,286]},{n:"TFSI e (Plug-in)",f:"Plug-in-Hybrid",ps:[204,245,299,367],t:["Automatik","DSG / Doppelkupplung"]},{n:"e-tron (Elektro)",f:"Elektro",ps:[170,204,286,340,408,503],t:["Automatik"]},{n:"S/RS",f:"Benzin",ps:[333,400,450,510,600,630]}],
  "Bentley":[{n:"4.0 V8",f:"Benzin",ps:[550]},{n:"6.0 W12",f:"Benzin",ps:[608,635,659]},{n:"Hybrid",f:"Plug-in-Hybrid",ps:[449,544],t:["Automatik"]}],
  "BMW":[{n:"Benzin (i)",f:"Benzin",ps:[109,136,156,184,204,245,306,340,374]},{n:"Diesel (d)",f:"Diesel",ps:[116,150,190,231,265,286,340]},{n:"Plug-in-Hybrid (e)",f:"Plug-in-Hybrid",ps:[204,245,292,394],t:["Automatik"]},{n:"Elektro (i)",f:"Elektro",ps:[170,286,340,544],t:["Automatik"]},{n:"M",f:"Benzin",ps:[431,480,510,530,625]}],
  "Chevrolet":[{n:"1.0–1.4 (Benzin)",f:"Benzin",ps:[68,90,100,140]},{n:"V8 (Camaro/Corvette)",f:"Benzin",ps:[406,453,466,482,659]},{n:"Diesel",f:"Diesel",ps:[110,130,163]}],
  "Citroën":[{n:"PureTech (Benzin)",f:"Benzin",ps:[82,100,110,130,155,180]},{n:"BlueHDi (Diesel)",f:"Diesel",ps:[100,120,130,180]},{n:"Hybrid (Plug-in)",f:"Plug-in-Hybrid",ps:[180,225],t:["Automatik"]},{n:"ë (Elektro)",f:"Elektro",ps:[113,136,156],t:["Automatik"]}],
  "Cupra":[{n:"TSI (Benzin)",f:"Benzin",ps:[150,190,245,300,310,333]},{n:"e-Hybrid",f:"Plug-in-Hybrid",ps:[204,245,272],t:["DSG / Doppelkupplung"]},{n:"Elektro",f:"Elektro",ps:[204,231,286,326,340],t:["Automatik"]},{n:"TDI",f:"Diesel",ps:[150]}],
  "Dacia":[{n:"SCe/TCe (Benzin)",f:"Benzin",ps:[65,75,90,100,110,130,150]},{n:"dCi (Diesel)",f:"Diesel",ps:[75,90,95,110,115]},{n:"ECO-G (LPG)",f:"Autogas (LPG/CNG)",ps:[100]},{n:"Elektro",f:"Elektro",ps:[45,65],t:["Automatik"]}],
  "DS":[{n:"PureTech (Benzin)",f:"Benzin",ps:[100,130,155,180,225]},{n:"BlueHDi (Diesel)",f:"Diesel",ps:[130,180]},{n:"E-Tense (Plug-in/Elektro)",f:"Plug-in-Hybrid",ps:[225,250,300,360],t:["Automatik"]}],
  "Ferrari":[{n:"V8 3.9 Biturbo",f:"Benzin",ps:[620,670,720]},{n:"V12 6.5",f:"Benzin",ps:[780,800,830]},{n:"V6 Hybrid (296)",f:"Plug-in-Hybrid",ps:[830],t:["Automatik"]}],
  "Fiat":[{n:"1.0–1.4 (Benzin/Hybrid)",f:"Benzin",ps:[69,70,85,95,100,120]},{n:"Multijet (Diesel)",f:"Diesel",ps:[75,95,120,130,140,160]},{n:"Elektro (e)",f:"Elektro",ps:[95,118,122],t:["Automatik"]}],
  "Ford":[{n:"EcoBoost (Benzin)",f:"Benzin",ps:[100,125,155,182,200,240,290]},{n:"TDCi/EcoBlue (Diesel)",f:"Diesel",ps:[95,120,150,190]},{n:"Hybrid/PHEV",f:"Hybrid",ps:[125,190,225],t:["Automatik"]},{n:"Elektro (Mach-E/E-Transit)",f:"Elektro",ps:[269,294,351,487],t:["Automatik"]},{n:"Mustang V8",f:"Benzin",ps:[421,450,460]}],
  "Genesis":[{n:"2.5T (Benzin)",f:"Benzin",ps:[304]},{n:"3.5T (Benzin)",f:"Benzin",ps:[380]},{n:"2.2 Diesel",f:"Diesel",ps:[210]},{n:"Electrified",f:"Elektro",ps:[229,490],t:["Automatik"]}],
  "Honda":[{n:"VTEC Turbo (Benzin)",f:"Benzin",ps:[102,126,130,182]},{n:"e:HEV (Hybrid)",f:"Hybrid",ps:[109,122,131,184],t:["Automatik"]},{n:"Elektro (e / e:Ny1)",f:"Elektro",ps:[136,154,204],t:["Automatik"]},{n:"i-DTEC (Diesel)",f:"Diesel",ps:[120,160]}],
  "Hyundai":[{n:"MPI/T-GDI (Benzin)",f:"Benzin",ps:[67,84,100,120,140,159,198]},{n:"CRDi (Diesel)",f:"Diesel",ps:[95,110,115,136,185,200]},{n:"Hybrid/Plug-in",f:"Hybrid",ps:[141,230,265],t:["Automatik","DSG / Doppelkupplung"]},{n:"Elektro",f:"Elektro",ps:[136,170,204,229,325],t:["Automatik"]}],
  "Infiniti":[{n:"1.6/2.0t (Benzin)",f:"Benzin",ps:[156,211]},{n:"3.0t (Benzin)",f:"Benzin",ps:[305,405]},{n:"1.5d/2.2d (Diesel)",f:"Diesel",ps:[109,170]}],
  "Jaguar":[{n:"P250/P300 (Benzin)",f:"Benzin",ps:[200,250,300,340,380]},{n:"D165–D300 (Diesel)",f:"Diesel",ps:[163,180,204,240,300]},{n:"I-Pace EV400 (Elektro)",f:"Elektro",ps:[400],t:["Automatik"]},{n:"F-Type R/SVR",f:"Benzin",ps:[450,550,575]}],
  "Jeep":[{n:"1.3/2.0 Turbo (Benzin)",f:"Benzin",ps:[130,150,180,272]},{n:"1.6/2.2 Multijet (Diesel)",f:"Diesel",ps:[120,130,140,170,195,200]},{n:"4xe (Plug-in)",f:"Plug-in-Hybrid",ps:[190,240,380],t:["Automatik"]},{n:"Avenger (Elektro)",f:"Elektro",ps:[156],t:["Automatik"]}],
  "Kia":[{n:"MPI/T-GDI (Benzin)",f:"Benzin",ps:[67,84,100,120,140,160,204]},{n:"CRDi (Diesel)",f:"Diesel",ps:[95,110,115,136,141,185,202]},{n:"Hybrid/Plug-in",f:"Hybrid",ps:[129,141,183,230,265],t:["Automatik","DSG / Doppelkupplung"]},{n:"EV (Elektro)",f:"Elektro",ps:[136,170,204,229,325,585],t:["Automatik"]}],
  "Lada":[{n:"1.6 (Benzin)",f:"Benzin",ps:[87,90,106]},{n:"1.7 (Niva)",f:"Benzin",ps:[83]}],
  "Lamborghini":[{n:"V10 5.2",f:"Benzin",ps:[610,640]},{n:"V12 6.5",f:"Benzin",ps:[770,780,825]},{n:"Urus V8",f:"Benzin",ps:[650,666]}],
  "Land Rover":[{n:"P250–P400 (Benzin)",f:"Benzin",ps:[200,249,300,360,400]},{n:"D200–D350 (Diesel)",f:"Diesel",ps:[163,200,204,240,249,300,350]},{n:"PHEV (P400e/P440e)",f:"Plug-in-Hybrid",ps:[404,440,510],t:["Automatik"]},{n:"V8",f:"Benzin",ps:[525,530,575,606]}],
  "Lexus":[{n:"Hybrid (Benzin)",f:"Hybrid",ps:[122,178,184,197,223,230,299],t:["Automatik"]},{n:"Benzin (Turbo/V8)",f:"Benzin",ps:[245,318,464,477]},{n:"Elektro",f:"Elektro",ps:[204,224,313],t:["Automatik"]}],
  "Maserati":[{n:"2.0 Mild-Hybrid",f:"Benzin",ps:[250,330]},{n:"3.0 V6 (Benzin)",f:"Benzin",ps:[350,410,430,580]},{n:"Nettuno V6 (MC20)",f:"Benzin",ps:[630]},{n:"3.0 V6 Diesel",f:"Diesel",ps:[250,275]}],
  "Mazda":[{n:"Skyactiv-G/X (Benzin)",f:"Benzin",ps:[75,90,115,122,132,150,165,186,194]},{n:"Skyactiv-D (Diesel)",f:"Diesel",ps:[105,116,150,184,200,254]},{n:"MX-30 (Elektro)",f:"Elektro",ps:[145],t:["Automatik"]}],
  "Mercedes-Benz":[{n:"Benzin",f:"Benzin",ps:[109,136,163,184,204,258,299,367]},{n:"Diesel (d)",f:"Diesel",ps:[95,116,150,190,194,245,265,330]},{n:"Plug-in-Hybrid (e)",f:"Plug-in-Hybrid",ps:[218,313,320,510],t:["Automatik"]},{n:"EQ (Elektro)",f:"Elektro",ps:[140,190,215,228,245,292,408,523],t:["Automatik"]},{n:"AMG",f:"Benzin",ps:[306,381,421,476,510,585,612]}],
  "MG":[{n:"1.5 (Benzin)",f:"Benzin",ps:[106,162]},{n:"Hybrid",f:"Hybrid",ps:[197],t:["Automatik"]},{n:"Elektro",f:"Elektro",ps:[115,156,170,204,245,435],t:["Automatik"]}],
  "Mini":[{n:"One/Cooper (Benzin)",f:"Benzin",ps:[75,102,116,136,156,178]},{n:"Cooper S/JCW",f:"Benzin",ps:[163,178,192,204,231,306]},{n:"One D/Cooper D/SD",f:"Diesel",ps:[90,95,112,116,150,170,190]},{n:"Electric/SE",f:"Elektro",ps:[184,218],t:["Automatik"]}],
  "Mitsubishi":[{n:"1.0–2.0 MIVEC (Benzin)",f:"Benzin",ps:[71,80,102,117,150,163]},{n:"1.6–2.4 DI-D (Diesel)",f:"Diesel",ps:[114,150,154,181]},{n:"Plug-in-Hybrid",f:"Plug-in-Hybrid",ps:[188,224,248],t:["Automatik"]}],
  "Nissan":[{n:"IG-T/DIG-T (Benzin)",f:"Benzin",ps:[71,92,100,117,140,158,163]},{n:"dCi (Diesel)",f:"Diesel",ps:[90,110,115,130,150,190]},{n:"e-Power (Hybrid)",f:"Hybrid",ps:[143,190,213],t:["Automatik"]},{n:"Elektro (Leaf/Ariya)",f:"Elektro",ps:[150,217,218,242,306],t:["Automatik"]},{n:"GT-R",f:"Benzin",ps:[570,600]}],
  "Opel":[{n:"Turbo (Benzin)",f:"Benzin",ps:[75,90,100,110,130,145,165,200]},{n:"CDTI/Diesel",f:"Diesel",ps:[95,102,110,122,136,160,174]},{n:"Plug-in-Hybrid/GSe",f:"Plug-in-Hybrid",ps:[180,224,300],t:["Automatik"]},{n:"Elektro (-e)",f:"Elektro",ps:[136,156],t:["Automatik"]}],
  "Peugeot":[{n:"PureTech (Benzin)",f:"Benzin",ps:[68,75,82,100,110,130,155,180,225]},{n:"BlueHDi (Diesel)",f:"Diesel",ps:[100,120,130,160,180]},{n:"Hybrid (Plug-in)",f:"Plug-in-Hybrid",ps:[180,225,300,360],t:["Automatik"]},{n:"Elektro (e-)",f:"Elektro",ps:[136,156,210,230,320],t:["Automatik"]}],
  "Porsche":[{n:"Benzin (Basis–GTS)",f:"Benzin",ps:[300,350,385,420,440,480]},{n:"Turbo",f:"Benzin",ps:[500,550,580,650]},{n:"E-Hybrid",f:"Plug-in-Hybrid",ps:[462,560,680],t:["Automatik"]},{n:"Elektro",f:"Elektro",ps:[408,530,761,952],t:["Automatik"]}],
  "Renault":[{n:"SCe/TCe (Benzin)",f:"Benzin",ps:[65,75,90,100,115,130,140,155,160]},{n:"dCi (Diesel)",f:"Diesel",ps:[75,85,90,95,110,115,150]},{n:"E-Tech (Hybrid)",f:"Hybrid",ps:[140,145,160,200],t:["Automatik"]},{n:"Elektro (Zoe/Megane)",f:"Elektro",ps:[82,109,130,135,220],t:["Automatik"]}],
  "Rolls-Royce":[{n:"6.75 V12",f:"Benzin",ps:[571,593,624,664]},{n:"Spectre (Elektro)",f:"Elektro",ps:[585],t:["Automatik"]}],
  "Saab":[{n:"1.8t/2.0t (Benzin)",f:"Benzin",ps:[150,175,210,220]},{n:"1.9 TiD/TTiD (Diesel)",f:"Diesel",ps:[120,150,180,190]}],
  "Seat":[{n:"TSI (Benzin)",f:"Benzin",ps:[75,90,95,110,115,150,190]},{n:"TDI (Diesel)",f:"Diesel",ps:[80,90,105,115,150]},{n:"e-Hybrid",f:"Plug-in-Hybrid",ps:[204,245],t:["DSG / Doppelkupplung"]},{n:"Cupra",f:"Benzin",ps:[265,280,290,300]}],
  "Skoda":[{n:"MPI/TSI (Benzin)",f:"Benzin",ps:[60,75,95,110,115,150,190,245]},{n:"TDI (Diesel)",f:"Diesel",ps:[90,105,115,150,190,200]},{n:"iV (Plug-in)",f:"Plug-in-Hybrid",ps:[204,218,245],t:["DSG / Doppelkupplung"]},{n:"Elektro (Enyaq)",f:"Elektro",ps:[179,204,286,299,340],t:["Automatik"]}],
  "Ssangyong":[{n:"1.5 T-GDI (Benzin)",f:"Benzin",ps:[163]},{n:"1.6/2.2 Diesel",f:"Diesel",ps:[136,178,202]}],
  "Subaru":[{n:"1.6/2.0 Boxer (Benzin)",f:"Benzin",ps:[114,150,156,169]},{n:"e-Boxer (Hybrid)",f:"Hybrid",ps:[136,150],t:["Automatik"]},{n:"2.0 Boxer Diesel",f:"Diesel",ps:[147,150]},{n:"Solterra (Elektro)",f:"Elektro",ps:[218],t:["Automatik"]},{n:"BRZ 2.4",f:"Benzin",ps:[234]}],
  "Suzuki":[{n:"1.0/1.2/1.4 (Benzin/Hybrid)",f:"Benzin",ps:[63,71,83,90,111,129,140]},{n:"Jimny 1.5",f:"Benzin",ps:[102]},{n:"Across (Plug-in)",f:"Plug-in-Hybrid",ps:[306],t:["Automatik"]}],
  "Toyota":[{n:"VVT-i (Benzin)",f:"Benzin",ps:[69,72,111,116,125,152,175]},{n:"Hybrid",f:"Hybrid",ps:[100,116,122,140,184,196,218,222],t:["Automatik"]},{n:"D-4D (Diesel)",f:"Diesel",ps:[124,150,177,204]},{n:"GR (Sport)",f:"Benzin",ps:[261,280,300,340]},{n:"Elektro (bZ4X)",f:"Elektro",ps:[204,218],t:["Automatik"]}],
  "Volkswagen":[{n:"TSI (Benzin)",f:"Benzin",ps:[65,75,90,95,110,115,130,150,190,245,300]},{n:"TDI (Diesel)",f:"Diesel",ps:[75,90,105,115,150,200]},{n:"eHybrid/GTE",f:"Plug-in-Hybrid",ps:[204,218,245,272],t:["DSG / Doppelkupplung","Automatik"]},{n:"ID (Elektro)",f:"Elektro",ps:[148,170,204,286,340],t:["Automatik"]}],
  "Volvo":[{n:"B3–B6 (Benzin/Mildhybrid)",f:"Benzin",ps:[156,163,197,250,300]},{n:"D3–D5 (Diesel)",f:"Diesel",ps:[150,190,235]},{n:"T6/T8 Recharge (Plug-in)",f:"Plug-in-Hybrid",ps:[340,350,390,455],t:["Automatik"]},{n:"Elektro (EX/C40)",f:"Elektro",ps:[231,238,272,408,517],t:["Automatik"]}],
});

// --- Zusätzliche Baureihen/Generationen ---
Object.assign(SERIES, {
  "Audi|A1":[["8X (2010–2018)",2010,2018],["GB (ab 2018)",2018,2026]],
  "Audi|Q2":[["GA (ab 2016)",2016,2026]],
  "Audi|Q7":[["4L (2005–2015)",2005,2015],["4M (ab 2015)",2015,2026]],
  "BMW|2er":[["F22/F23 (2013–2021)",2013,2021],["F44 Gran Coupé (ab 2019)",2019,2026],["G42 (ab 2021)",2021,2026]],
  "BMW|X2":[["F39 (2018–2023)",2018,2023],["U10 (ab 2023)",2023,2026]],
  "BMW|Z4":[["E85/E86 (2002–2008)",2002,2008],["E89 (2009–2016)",2009,2016],["G29 (ab 2018)",2018,2026]],
  "Mercedes-Benz|CLA":[["C117 (2013–2019)",2013,2019],["C118 (ab 2019)",2019,2026]],
  "Mercedes-Benz|GLB":[["X247 (ab 2019)",2019,2026]],
  "Mercedes-Benz|GLE":[["W166 (2015–2019)",2015,2019],["W167 (ab 2019)",2019,2026]],
  "Mercedes-Benz|Vito":[["W639 (2003–2014)",2003,2014],["W447 (ab 2014)",2014,2026]],
  "Volkswagen|T-Cross":[["C11 (ab 2019)",2019,2026]],
  "Volkswagen|Arteon":[["3H (2017–2024)",2017,2024]],
  "Volkswagen|Touareg":[["7L (2002–2010)",2002,2010],["7P (2010–2018)",2010,2018],["CR (ab 2018)",2018,2026]],
  "Volkswagen|Caddy":[["III (2K, 2003–2015)",2003,2015],["IV (2015–2020)",2015,2020],["V (ab 2020)",2020,2026]],
  "Volkswagen|Sharan":[["I (1995–2010)",1995,2010],["II (7N, 2010–2022)",2010,2022]],
  "Volkswagen|ID.3":[["Pro (ab 2020)",2020,2026]],
  "Volkswagen|ID.4":[["Pro (ab 2021)",2021,2026]],
  "Opel|Mokka":[["A (2012–2019)",2012,2019],["B (ab 2021)",2021,2026]],
  "Opel|Zafira":[["A (1999–2005)",1999,2005],["B (2005–2014)",2005,2014],["C/Tourer (2011–2019)",2011,2019],["Life (ab 2019)",2019,2026]],
  "Opel|Grandland":[["X / Grandland (ab 2017)",2017,2026]],
  "Ford|Puma":[["II (ab 2019)",2019,2026]],
  "Ford|Mondeo":[["MK4 (2007–2014)",2007,2014],["MK5 (2014–2022)",2014,2022]],
  "Ford|Ranger":[["T6 (2011–2022)",2011,2022],["T6.2 (ab 2022)",2022,2026]],
  "Skoda|Kodiaq":[["I (NS, 2016–2024)",2016,2024],["II (ab 2024)",2024,2026]],
  "Skoda|Karoq":[["NU (ab 2017)",2017,2026]],
  "Skoda|Kamiq":[["NW (ab 2019)",2019,2026]],
  "Skoda|Scala":[["NW (ab 2019)",2019,2026]],
  "Skoda|Enyaq":[["iV (ab 2021)",2021,2026]],
  "Seat|Ateca":[["KH (ab 2016)",2016,2026]],
  "Seat|Arona":[["KJ (ab 2017)",2017,2026]],
  "Seat|Alhambra":[["I (1996–2010)",1996,2010],["II (7N, 2010–2022)",2010,2022]],
  "Toyota|Aygo":[["AB1 (2005–2014)",2005,2014],["AB4 (2014–2021)",2014,2021]],
  "Toyota|C-HR":[["AX1 (2016–2023)",2016,2023],["AX2 (ab 2023)",2023,2026]],
  "Toyota|Prius":[["III (2009–2015)",2009,2015],["IV (2015–2022)",2015,2022],["V (ab 2023)",2023,2026]],
  "Toyota|Hilux":[["VII (2005–2015)",2005,2015],["VIII (ab 2015)",2015,2026]],
  "Renault|Twingo":[["II (2007–2014)",2007,2014],["III (2014–2024)",2014,2024]],
  "Renault|Captur":[["I (2013–2019)",2013,2019],["II (ab 2019)",2019,2026]],
  "Renault|Kangoo":[["II (2008–2021)",2008,2021],["III (ab 2021)",2021,2026]],
  "Peugeot|2008":[["I (2013–2019)",2013,2019],["II (ab 2019)",2019,2026]],
  "Peugeot|3008":[["I (2009–2016)",2009,2016],["II (2016–2023)",2016,2023],["III (ab 2023)",2023,2026]],
  "Peugeot|508":[["I (2010–2018)",2010,2018],["II (ab 2018)",2018,2026]],
  "Citroën|C3":[["II (2009–2016)",2009,2016],["III (2016–2024)",2016,2024],["IV (ab 2024)",2024,2026]],
  "Citroën|Berlingo":[["II (2008–2018)",2008,2018],["III (ab 2018)",2018,2026]],
  "Fiat|Panda":[["II (2003–2012)",2003,2012],["III (ab 2011)",2011,2026]],
  "Fiat|Ducato":[["III (ab 2006)",2006,2026]],
  "Hyundai|i10":[["PA (2008–2013)",2008,2013],["IA (2013–2019)",2013,2019],["AC3 (ab 2019)",2019,2026]],
  "Hyundai|i20":[["PB (2008–2014)",2008,2014],["GB (2014–2020)",2014,2020],["BC3 (ab 2020)",2020,2026]],
  "Hyundai|Kona":[["OS (2017–2023)",2017,2023],["SX2 (ab 2023)",2023,2026]],
  "Hyundai|Ioniq 5":[["NE (ab 2021)",2021,2026]],
  "Kia|Picanto":[["TA (2011–2017)",2011,2017],["JA (ab 2017)",2017,2026]],
  "Kia|Rio":[["UB (2011–2017)",2011,2017],["YB (2017–2023)",2017,2023]],
  "Kia|Niro":[["DE (2016–2022)",2016,2022],["SG2 (ab 2022)",2022,2026]],
  "Kia|EV6":[["CV (ab 2021)",2021,2026]],
  "Nissan|Micra":[["K12 (2003–2010)",2003,2010],["K13 (2010–2017)",2010,2017],["K14 (2017–2023)",2017,2023]],
  "Nissan|Juke":[["F15 (2010–2019)",2010,2019],["F16 (ab 2019)",2019,2026]],
  "Nissan|Leaf":[["ZE0 (2010–2017)",2010,2017],["ZE1 (ab 2017)",2017,2026]],
  "Mazda|2":[["DE (2007–2014)",2007,2014],["DJ (ab 2014)",2014,2026]],
  "Mazda|6":[["GH (2007–2012)",2007,2012],["GJ/GL (ab 2012)",2012,2026]],
  "Mazda|MX-5":[["NC (2005–2015)",2005,2015],["ND (ab 2015)",2015,2026]],
  "Volvo|XC40":[["ab 2017",2017,2026]],
  "Volvo|V60":[["I (2010–2018)",2010,2018],["II (ab 2018)",2018,2026]],
  "Mini|Countryman":[["R60 (2010–2016)",2010,2016],["F60 (2017–2023)",2017,2023],["U25 (ab 2023)",2023,2026]],
  "Smart|ForTwo":[["450 (1998–2007)",1998,2007],["451 (2007–2014)",2007,2014],["453 (2014–2024)",2014,2024]],
  "Honda|Civic":[["VIII (2006–2011)",2006,2011],["IX (2011–2017)",2011,2017],["X (2017–2022)",2017,2022],["XI (ab 2022)",2022,2026]],
  "Honda|Jazz":[["III (2008–2015)",2008,2015],["IV (2015–2020)",2015,2020],["V (ab 2020)",2020,2026]],
  "Porsche|718 Boxster":[["982 (ab 2016)",2016,2026]],
  "Porsche|718 Cayman":[["982 (ab 2016)",2016,2026]],
  "Porsche|Panamera":[["970 (2009–2016)",2009,2016],["971 (2016–2023)",2016,2023],["972 (ab 2023)",2023,2026]],
  "Porsche|Taycan":[["Y1A (ab 2019)",2019,2026]],
  "Cupra|Formentor":[["KM (ab 2020)",2020,2026]],
  "Cupra|Born":[["K11 (ab 2021)",2021,2026]],
  "Alfa Romeo|Giulia":[["952 (ab 2016)",2016,2026]],
  "Alfa Romeo|Giulietta":[["940 (2010–2020)",2010,2020]],
  "Tesla|Model S":[["Pre-Facelift (2012–2021)",2012,2021],["Palladium (ab 2021)",2021,2026]],
  "Tesla|Model X":[["Pre-Facelift (2015–2021)",2015,2021],["Palladium (ab 2021)",2021,2026]],
});

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
  "Radlager": [180, 450, "pro Rad inkl. Einbau"],
  "Antriebswelle": [250, 600, "Gelenk/Welle inkl. Einbau"],
  "Turbolader": [1200, 2800, "inkl. Anbauteile"],
  "Dieselpartikelfilter": [150, 2200, "Regeneration günstig, Tausch teuer"],
  "AGR-Ventil": [300, 800, "inkl. Reinigung/Adaption"],
  "Lichtmaschine": [400, 900, "inkl. Einbau"],
  "Anlasser": [300, 700, "inkl. Einbau"],
  "Zündspulen": [120, 350, "je nach Anzahl"],
  "Zündkerzen": [80, 250, "satzweise"],
  "Glühkerzen": [150, 450, "satzweise, festsitzend teurer"],
  "Injektoren": [300, 1500, "je nach Anzahl/Bauart"],
  "Lambdasonde": [180, 400, "inkl. Einbau"],
  "Katalysator": [400, 1500, "Original teurer"],
  "Kraftstoffpumpe": [250, 700, "in-Tank teurer"],
  "Kraftstofffilter": [60, 150, "inkl. Entlüften"],
  "Servolenkung": [200, 1200, "stark befundabhängig"],
  "Motorlager": [150, 500, "pro Lager"],
  "Zylinderkopfdichtung": [900, 2500, "inkl. Planen"],
  "Automatikgetriebe-Service": [250, 600, "Spülung inkl. Öl"],
  "Fensterheber": [150, 400, "inkl. Einbau"],
  "Zentralverriegelung": [120, 400, "pro Schloss/Stellmotor"],
  "Marderschaden": [100, 800, "je nach Bissschäden"],
  "Kabelbaum-Reparatur": [100, 900, "stark befundabhängig"],
  "Sensoren": [80, 350, "inkl. Anlernen"],
  "ABS / ESP": [100, 800, "Sensor günstig, Block teuer"],
  "Airbag": [80, 600, "Diagnose + Bauteil"],
  "Wuchten": [25, 60, "4 Räder"],
  "RDKS-Service": [40, 120, "Sensor-Service/Anlernen"],
  "Klimadesinfektion": [50, 120, "inkl. Filter teurer"],
  "Kühlung": [150, 600, "Thermostat/Wasserpumpe"],
  "Scheibenwischer / Waschanlage": [30, 120, "Wischer + Düsen"],
  "Standheizung-Service": [120, 400, "Diagnose + Wartung"],
  "Elektrik": [80, 300, "Diagnose + Kleinreparatur"],
  "Schlüssel nachmachen": [80, 350, "inkl. Codierung"],
  "Wegfahrsperre": [100, 400, "Diagnose + Anlernen"],
  "Mängelbeseitigung vor HU": [100, 600, "je nach Mängelliste"],
  "HV-Batterie-Check": [80, 250, "inkl. Zertifikat teurer"],
  "Ladeelektronik": [150, 900, "stark befundabhängig"],
  "HV-Reparatur": [200, 2500, "nur HV-qualifizierte Betriebe"],
  "Ausbeulen ohne Lackieren": [80, 350, "pro Delle"],
  "Rostbeseitigung": [150, 900, "je nach Umfang"],
  "Federn": [200, 500, "paarweise pro Achse"],
  "Kühlmittelverlust": [120, 700, "Diagnose + Ursache (Schlauch günstig, Wasserpumpe teurer)"],
  "Reifenreparatur": [25, 60, "pro Reifen, wenn reparabel"],
  "Geräusche": [50, 150, "Geräuschdiagnose / Probefahrt"],
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
  { k: "mkl", icon: "", name: "Motorkontrollleuchte", sev: "mittel", cat: "reparatur", service: "Motorkontrollleuchte", guess: "Fehlereintrag im Motorsteuergerät – Auslesen empfohlen", why: "Die gelbe MKL kann von der lockeren Tankdeckel-Dichtung bis zum Kat-Problem vieles bedeuten – der Fehlerspeicher verrät die Ursache in Minuten.", risk: "Blinkt sie, drohen akute Zündaussetzer mit Kat-Schaden – dann nur noch sehr schonend fahren." },
  { k: "oel", icon: "", name: "Öldruck", sev: "hoch", cat: "reparatur", service: "Motor", guess: "Öldruckproblem – sofort anhalten und Ölstand prüfen", why: "Ohne Öldruck laufen die Motorlager trocken – die rote Ölkanne ist die ernsteste Leuchte überhaupt.", risk: "Schon wenige Kilometer können einen kapitalen Motorschaden bedeuten. Motor aus, Ölstand prüfen, im Zweifel abschleppen." },
  { k: "kuehl", icon: "", name: "Kühlmitteltemperatur", sev: "hoch", cat: "reparatur", service: "Kühlmittelverlust", guess: "Überhitzung oder Kühlmittelverlust – anhalten und prüfen lassen", why: "Zu wenig Kühlmittel oder ein defekter Lüfter/Thermostat lässt den Motor überhitzen.", risk: "Überhitzung verzieht Zylinderkopf und Dichtung – teuer. Anhalten, abkühlen lassen, nie den heißen Deckel öffnen." },
  { k: "batt", icon: "", name: "Batterie / Ladekontrolle", sev: "hoch", cat: "reparatur", service: "Lichtmaschine", guess: "Lichtmaschine lädt nicht – Auto fährt auf Reserve", why: "Leuchtet sie während der Fahrt, liefert der Generator keinen Strom mehr – das Auto zehrt von der Batterie.", risk: "Nach 30–60 Minuten bleibt das Auto stehen. Verbraucher aus und direkt zur Werkstatt." },
  { k: "brems", icon: "", name: "Bremse / ABS", sev: "hoch", cat: "reparatur", service: "Bremsen", guess: "Bremsanlage prüfen – Beläge, Flüssigkeit oder ABS-Sensor", why: "Rote Bremsleuchte = Handbremse angezogen, Flüssigkeit niedrig oder Beläge verschlissen. Gelbes ABS = Regelektronik gestört, Grundbremse funktioniert.", risk: "Bremsflüssigkeitsverlust ist akut sicherheitskritisch – vorsichtig fahren und sofort prüfen lassen." },
  { k: "airbag", icon: "", name: "Airbag", sev: "mittel", cat: "reparatur", service: "Airbag", guess: "Fehler im Rückhaltesystem", why: "Häufig ist nur ein Sitzbelegungs- oder Gurtstraffer-Stecker gestört – trotzdem sind Airbags dann evtl. deaktiviert.", risk: "Im Unfallfall lösen Airbags möglicherweise nicht aus – zeitnah auslesen lassen." },
  { k: "reifen", icon: "", name: "Reifendruck (RDKS)", sev: "mittel", cat: "reifen", service: "RDKS-Service", guess: "Druckverlust oder RDKS-Sensor", why: "Meist schleichender Druckverlust (Nagel, Ventil) – manchmal auch nur ein leerer Sensorakku.", risk: "Ein Reifen mit Minderdruck überhitzt und kann platzen – Druck bald prüfen." },
  { k: "esp", icon: "", name: "ESP / Traktion", sev: "mittel", cat: "reparatur", service: "ABS / ESP", guess: "Fahrdynamikregelung meldet Fehler", why: "Oft steckt ein Raddrehzahl- oder Lenkwinkelsensor dahinter.", risk: "Schleuderschutz fehlt – bei Nässe und Glätte deutlich riskanter." },
  { k: "vorgluh", icon: "", name: "Vorglühen / Abgas (Diesel)", sev: "mittel", cat: "reparatur", service: "Glühkerzen", guess: "Glühanlage oder Abgassystem (AGR, DPF)", why: "Blinkende Glühwendel = Fehler im Motormanagement; dauerhaft = Glühkerzen altern (schlechter Kaltstart).", risk: "Startprobleme bei Kälte, mögliche Folgeprobleme an AGR/DPF." },
  { k: "dpf", icon: "", name: "Partikelfilter (DPF)", sev: "mittel", cat: "reparatur", service: "Dieselpartikelfilter", guess: "DPF beladen – Regenerationsfahrt nötig", why: "Bei viel Kurzstrecke kann sich der Filter nicht freibrennen.", risk: "Ignorieren führt zu Notlauf und teurem Filtertausch – erst eine zügige Überlandfahrt versuchen." },
  { k: "lenk", icon: "", name: "Lenkung", sev: "hoch", cat: "reparatur", service: "Servolenkung", guess: "Servolenkung gestört", why: "Elektrische Servolenkungen schalten bei Fehlern ab – die Lenkung wird schlagartig schwer.", risk: "In Notmanövern fehlt Lenkunterstützung – sicherheitskritisch, sofort prüfen lassen." },
  { k: "adblue", icon: "", name: "AdBlue / SCR", sev: "mittel", cat: "reparatur", service: "Motorkontrollleuchte", guess: "AdBlue nachfüllen oder Systemfehler", why: "Nach dem Countdown verweigert das Auto gesetzlich bedingt den Neustart.", risk: "Liegenbleiben trotz vollem Tank – rechtzeitig auffüllen bzw. Diagnose." },
  { k: "wasser", icon: "", name: "Wasser im Kraftstofffilter", sev: "mittel", cat: "inspektion", service: "Kraftstofffilter", guess: "Wasserabscheider voll (Diesel)", why: "Der Dieselfilter scheidet Kondenswasser ab – der Behälter muss entleert werden.", risk: "Wasser in der Einspritzung schädigt Injektoren und Hochdruckpumpe." },
];
const SOUNDS = [
  { k: "quietschen", name: "Quietschen beim Bremsen", cat: "reparatur", service: "Bremsen", guess: "Verschlissene Bremsbeläge oder -scheiben", why: "Der Verschleißwarnstift der Beläge quietscht absichtlich, wenn der Belag zur Neige geht." },
  { k: "schleifen", name: "Schleifen / Kratzen", cat: "reparatur", service: "Bremsen", guess: "Bremsen (Metall auf Metall) oder Radlager", why: "Dauerhaftes Schleifen deutet auf komplett abgefahrene Beläge oder ein defektes Radlager." },
  { k: "klappern", name: "Klappern / Poltern", cat: "reparatur", service: "Fahrwerk", guess: "Koppelstange, Traggelenk oder Stabilisator", why: "Ausgeschlagene Fahrwerkslager poltern besonders auf Kopfsteinpflaster und bei kleinen Bodenwellen." },
  { k: "brummen", name: "Brummen (geschwindigkeitsabhängig)", cat: "reparatur", service: "Radlager", guess: "Radlager oder Sägezahn-Reifen", why: "Wird das Brummen mit dem Tempo lauter und ändert sich in Kurven, ist meist ein Radlager fällig." },
  { k: "pfeifen", name: "Pfeifen / Heulen", cat: "reparatur", service: "Turbolader", guess: "Riemen, Turbolader oder Servopumpe", why: "Pfeifen unter Last spricht für die Ladeluftstrecke/Turbo; drehzahlabhängiges Heulen für Riementrieb oder Pumpen." },
  { k: "rasseln", name: "Rasseln beim Start", cat: "reparatur", service: "Steuerkette", guess: "Steuerkette oder Kettenspanner", why: "Kurzes Kaltstart-Rasseln ist das typische Frühzeichen einer gelängten Kette – ernst nehmen." },
  { k: "knacken", name: "Knacken beim Lenken", cat: "reparatur", service: "Antriebswelle", guess: "Antriebswellen-Gelenk", why: "Rhythmisches Knacken bei vollem Lenkeinschlag = klassisches Gleichlaufgelenk-Symptom." },
  { k: "auspuff_laut", name: "Lauter Auspuff / Dröhnen", cat: "reparatur", service: "Auspuff", guess: "Undichte oder defekte Abgasanlage", why: "Auspuffanlagen rosten von innen nach außen – meist ist erst ein Übergang oder das Flexrohr undicht." },
  { k: "klopfen", name: "Klopfen / Nageln aus dem Motor", cat: "reparatur", service: "Motor", guess: "Hydrostößel, Injektoren oder Motorlager(schaden)", why: "Kann harmlos sein – ein tieffrequentes Klopfen unter Last aber auch ein beginnender Lagerschaden. Abhorchen lassen!" },
  { k: "zischen", name: "Zischen / Luftgeräusch", cat: "reparatur", service: "Motor", guess: "Undichtigkeit im Unterdruck-/Ladeluftsystem", why: "Entweichende Luft bringt Gemisch und Ladedruck durcheinander – per Rauchtest schnell zu finden." },
  { k: "heulen_getriebe", name: "Heulen beim Fahren (lastabhängig)", cat: "reparatur", service: "Getriebe", guess: "Getriebe- oder Differenziallager", why: "Last- und ganghabhängiges Heulen kommt aus dem Antriebsstrang – Ölstand prüfen lassen." },
  { k: "surren", name: "Elektrisches Surren / Pumpe läuft nach", cat: "reparatur", service: "Elektrik", guess: "Stellmotor, Lüfter oder Pumpe läuft dauerhaft", why: "Dauerläufer ziehen die Batterie leer – den Verursacher orten lassen." },
];
const EMERGENCY_TYPES = [
  { k: "startet_nicht", icon: "", name: "Auto startet nicht" },
  { k: "batterie", icon: "", name: "Batterie leer" },
  { k: "reifen_platt", icon: "", name: "Reifen platt" },
  { k: "unfall", icon: "", name: "Unfall" },
  { k: "rote_leuchte", icon: "", name: "Rote Warnleuchte" },
  { k: "ueberhitzt", icon: "", name: "Auto überhitzt" },
  { k: "panne", icon: "", name: "Panne unterwegs" },
  { k: "abschlepp", icon: "", name: "Abschleppdienst nötig" },
];

// ============================================================
// KI-DIAGNOSE v2 – regelbasierte Analyse mit Erklärungen
// Jede Regel: kw (Stichwörter/Phrasen), cat/service (Zuordnung),
// guess (mögliche Ursache), why (verständliche Erklärung),
// risk (was droht beim Ignorieren), action (Empfehlung), conf, sev
// ============================================================
const AI_RULES = [
  // ---------- Bremsen ----------
  { kw:["quietsch","bremse quietscht","bremsen quietschen","quietscht beim bremsen"], cat:"reparatur", service:"Bremsen", guess:"Verschlissene Bremsbeläge", conf:"hoch", why:"Bremsbeläge haben einen Verschleißindikator – ein Metallstift quietscht bewusst, wenn der Belag fast abgefahren ist.", risk:"Fährt der Belag ganz ab, bremst Metall auf Metall: längerer Bremsweg und teure Scheiben-Schäden.", action:"Beläge zeitnah prüfen und wechseln lassen – meist ein günstiger Routine-Job." },
  { kw:["metall auf metall","schleift beim bremsen","kratzt beim bremsen","schleifger"], cat:"reparatur", service:"Bremsen", guess:"Bremsbeläge komplett abgefahren oder Fremdkörper", conf:"hoch", sev:"hoch", why:"Ein metallisches Schleifen beim Bremsen bedeutet oft: Der Belag ist weg und die Trägerplatte reibt auf der Scheibe.", risk:"Stark verlängerter Bremsweg, Scheiben werden zerstört – sicherheitskritisch.", action:"Nicht mehr lange fahren – sofort prüfen lassen." },
  { kw:["lenkrad vibriert beim bremsen","rubbelt","bremse vibriert","flattert beim bremsen"], cat:"reparatur", service:"Bremsen", guess:"Verzogene oder ungleichmäßig abgenutzte Bremsscheiben", conf:"hoch", why:"Wenn es nur beim Bremsen vibriert, sind meist die Bremsscheiben verzogen – z.B. durch Überhitzung.", risk:"Bremswirkung lässt nach, Verschleiß an Radaufhängung steigt.", action:"Scheiben und Beläge prüfen, meist achsweise erneuern." },
  { kw:["bremspedal weich","pedal lässt sich durchtreten","schwammiges pedal"], cat:"reparatur", service:"Bremsen", guess:"Luft im Bremssystem oder alternde Bremsflüssigkeit", conf:"mittel", sev:"hoch", why:"Ein weiches Pedal deutet auf Luft oder Feuchtigkeit in der Bremsflüssigkeit hin – die Bremskraft kommt nicht voll an.", risk:"Im Extremfall Bremsversagen, besonders bei starker Beanspruchung.", action:"Sofort prüfen lassen, Bremsflüssigkeit wechseln/entlüften." },
  { kw:["zieht beim bremsen","bremst einseitig"], cat:"reparatur", service:"Bremsen", guess:"Festsitzender Bremssattel oder ungleiche Bremswirkung", conf:"mittel", why:"Zieht das Auto beim Bremsen zur Seite, bremst eine Seite stärker – oft ein hängender Bremssattel.", risk:"Ungleichmäßiger Verschleiß, Überhitzung, Schleudergefahr bei Nässe.", action:"Bremsanlage achsweise prüfen lassen." },
  { kw:["handbremse","feststellbremse","parkbremse"], cat:"reparatur", service:"Bremsen", guess:"Handbremse verstellt, Seil fest oder elektrische Parkbremse defekt", conf:"mittel", why:"Handbremsseile längen sich oder rosten fest; elektrische Parkbremsen haben oft Stellmotor-Probleme.", risk:"Fahrzeug rollt weg oder Bremse löst nicht – Räder können blockieren.", action:"Einstellen bzw. Stellmotor prüfen lassen." },

  // ---------- Motor: Start & Lauf ----------
  { kw:["startet nicht","springt nicht an","geht nicht an","macht keinen mucks"], cat:"reparatur", service:"Startprobleme", guess:"Batterie, Anlasser oder Wegfahrsperre", conf:"hoch", why:"Kein Startversuch = meist Strom (Batterie, Masseband) oder Anlasser. Dreht der Motor, liegt es eher an Kraftstoff/Zündung.", risk:"Man bleibt liegen – oft zum ungünstigsten Zeitpunkt.", action:"Batterie testen lassen; das ist die häufigste und günstigste Ursache." },
  { kw:["orgelt","dreht aber startet nicht","dreht durch aber"], cat:"reparatur", service:"Startprobleme", guess:"Kraftstoffversorgung oder Zündung", conf:"mittel", why:"Dreht der Anlasser, aber der Motor zündet nicht, fehlt Sprit, Zündfunke oder Kompression.", risk:"Batterie wird beim Orgeln schnell leer, Katalysator kann Schaden nehmen.", action:"Fehlerspeicher auslesen und Kraftstoffdruck/Zündung prüfen lassen." },
  { kw:["klackt beim starten","klick beim start","relais klackert"], cat:"reparatur", service:"Anlasser", guess:"Anlasser-Magnetschalter oder zu wenig Batteriespannung", conf:"mittel", why:"Ein einzelnes Klacken heißt: Der Magnetschalter zieht an, aber der Anlasser dreht nicht – Batterie schwach oder Anlasser fest.", risk:"Bald gar kein Start mehr möglich.", action:"Batterie laden/testen, sonst Anlasser prüfen." },
  { kw:["geht im leerlauf aus","säuft ab","stirbt ab","leerlauf unruhig","sägt im leerlauf","dreht unruhig"], cat:"reparatur", service:"Motor", guess:"Drosselklappe, Leerlaufregler, Falschluft oder Zündaussetzer", conf:"mittel", why:"Unruhiger Leerlauf entsteht oft durch verschmutzte Drosselklappe, undichte Ansaugluft (Falschluft) oder einzelne Zylinder, die nicht sauber zünden.", risk:"Erhöhter Verbrauch, Absterben an der Ampel, Folgeschäden am Kat.", action:"Diagnose mit Fehlerspeicher – meist gut eingrenzbar." },
  { kw:["ruckelt","ruckeln beim beschleunigen","zieht nicht","leistungsverlust","keine leistung","notlauf","notlaufprogramm"], cat:"reparatur", service:"Motor", guess:"Zündung, Einspritzung, Turbolader oder AGR", conf:"mittel", why:"Ruckeln und Leistungsverlust sind klassische Zeichen für Zündaussetzer, verstopfte Einspritzung, klemmende AGR oder ein Ladedruckproblem – das Steuergerät schaltet dann oft in den Notlauf.", risk:"Weiterfahren kann Kat, Turbo oder DPF beschädigen.", action:"Fehlerspeicher auslesen lassen – der Eintrag zeigt fast immer die Richtung." },
  { kw:["zündaussetzer","misfire","zylinder aussetzer"], cat:"reparatur", service:"Zündspulen", guess:"Zündspule oder Zündkerze defekt", conf:"hoch", why:"Aussetzer auf einzelnen Zylindern kommen meist von einer defekten Zündspule oder verschlissenen Kerzen.", risk:"Unverbrannter Kraftstoff zerstört auf Dauer den Katalysator.", action:"Spulen/Kerzen prüfen – oft schnell und günstig behoben." },
  { kw:["klopft","klopfen im motor","nagelt","motor nagelt","lagerschaden","pleuel"], cat:"reparatur", service:"Motor", guess:"Mechanisches Motorgeräusch – Hydrostößel, Injektoren oder Lager", conf:"mittel", sev:"hoch", why:"Klopfen/Nageln kann harmlos sein (Hydrostößel, Diesel-Injektoren) – aber auch ein beginnender Lagerschaden.", risk:"Ein Lagerschaden endet im kapitalen Motorschaden.", action:"Nicht ignorieren: Motor abhorchen lassen, Ölstand sofort prüfen." },
  { kw:["vibriert im stand","brummt im stand","zittert im leerlauf"], cat:"reparatur", service:"Motorlager", guess:"Defektes Motor- oder Getriebelager", conf:"mittel", why:"Ausgeschlagene Motorlager übertragen die normalen Motorvibrationen ungefiltert auf die Karosserie.", risk:"Belastet Auspuff, Leitungen und andere Lager.", action:"Lager prüfen und einzeln tauschen lassen." },

  // ---------- Öl, Kühlung, Rauch ----------
  { kw:["ölfleck","verliert öl","öl unterm auto","tropft öl","ölverlust"], cat:"reparatur", service:"Ölverlust", guess:"Undichtigkeit an Ölwanne, Ventildeckel oder Simmerring", conf:"hoch", why:"Ölverlust kommt fast immer von alternden Dichtungen. Kleiner Ölfilm ist häufig, Tropfen auf dem Boden sind ernster.", risk:"Zu wenig Öl führt zum Motorschaden; Öl auf heißen Teilen kann brennen.", action:"Leckstelle orten lassen (Motorwäsche + Kontrolle), Ölstand regelmäßig prüfen." },
  { kw:["ölverbrauch","öl nachfüllen","braucht öl"], cat:"reparatur", service:"Motor", guess:"Erhöhter Ölverbrauch – Ventilschaftdichtungen oder Kolbenringe", conf:"mittel", why:"Verbrennt der Motor Öl (bläulicher Rauch), sind oft Ventilschaftdichtungen oder Kolbenringe verschlissen.", risk:"Kat und Turbolader leiden; ohne Kontrolle droht Ölmangel.", action:"Verbrauch dokumentieren, Kompression messen lassen." },
  { kw:["überhitzt","temperatur steigt","kühlwasser","kühlmittel","kühlmittelverlust","dampf aus motorraum"], cat:"reparatur", service:"Kühlmittelverlust", guess:"Kühlsystem undicht, Thermostat oder Wasserpumpe defekt", conf:"hoch", sev:"hoch", why:"Kühlmittelverlust oder ein hängendes Thermostat lassen die Temperatur steigen. Weißer Dampf = akutes Leck.", risk:"Überhitzung verzieht den Zylinderkopf – einer der teuersten Motorschäden.", action:"Bei steigender Temperatur sofort anhalten, abkühlen lassen, abschleppen statt weiterfahren." },
  { kw:["süßlicher geruch","riecht süßlich"], cat:"reparatur", service:"Kühlmittelverlust", guess:"Kühlmittel verdampft an heißen Teilen", conf:"mittel", why:"Kühlmittel riecht süßlich – tritt der Geruch innen auf, ist oft der Wärmetauscher der Heizung undicht.", risk:"Kühlmittelverlust mit Überhitzungsgefahr.", action:"Kühlsystem abdrücken lassen." },
  { kw:["weißer rauch","weisser qualm"], cat:"reparatur", service:"Zylinderkopfdichtung", guess:"Kühlmittel im Brennraum – Zylinderkopfdichtung", conf:"mittel", sev:"hoch", why:"Dauerhaft weißer, süßlich riechender Rauch deutet auf verbrennendes Kühlmittel hin (kurz nach Kaltstart ist Wasserdampf normal).", risk:"Motorschaden durch Überhitzung oder Wasserschlag.", action:"CO2-Test im Kühlwasser machen lassen, wenig fahren." },
  { kw:["blauer rauch","blau qualmt"], cat:"reparatur", service:"Motor", guess:"Motor verbrennt Öl", conf:"mittel", why:"Blauer Rauch = Ölverbrennung, z.B. über Ventilschaftdichtungen, Kolbenringe oder einen defekten Turbolader.", risk:"Kat-/Turboschaden, steigender Ölverbrauch.", action:"Ursache eingrenzen lassen (kalt vs. unter Last qualmt unterschiedlich)." },
  { kw:["schwarzer rauch","rußt","qualmt schwarz"], cat:"reparatur", service:"Motor", guess:"Zu fettes Gemisch – Einspritzung, Luftmasse oder AGR", conf:"mittel", why:"Schwarzer Rauch bedeutet unverbrannten Kraftstoff – oft Luftmassenmesser, Injektoren oder AGR-Ventil.", risk:"DPF verstopft, Mehrverbrauch, HU-Durchfall.", action:"Diagnose der Einspritz-/Luftwerte machen lassen." },

  // ---------- Turbo, Abgas, Diesel ----------
  { kw:["turbo","pfeift beim beschleunigen","ladedruck","pfeifendes ger"], cat:"reparatur", service:"Turbolader", guess:"Turbolader oder Ladeluftschlauch undicht", conf:"mittel", why:"Lautes Pfeifen unter Last kommt oft von undichten Ladeluftschläuchen oder einem Turbolader mit Lagerspiel.", risk:"Turboschaden wird schnell teuer; Ölnebel kann in den Motor gelangen.", action:"Ladedrucksystem abdrücken lassen, Turbospiel prüfen." },
  { kw:["dpf","partikelfilter","regeneriert","russpartikel","filter voll"], cat:"reparatur", service:"Dieselpartikelfilter", guess:"DPF beladen oder Regeneration schlägt fehl", conf:"hoch", why:"Viele Kurzstrecken verhindern die Selbstreinigung des Partikelfilters – die Leuchte fordert eine Regenerationsfahrt.", risk:"Voller DPF → Notlauf und teurer Filtertausch.", action:"Zügige Autobahnfahrt (ca. 20 Min) oder Zwangsregeneration in der Werkstatt." },
  { kw:["agr","abgasrückführung"], cat:"reparatur", service:"AGR-Ventil", guess:"AGR-Ventil verkokt oder klemmt", conf:"hoch", why:"Das AGR-Ventil verrußt mit der Zeit und klemmt – typisch bei Diesel mit viel Stadtverkehr.", risk:"Notlauf, erhöhter Verbrauch, HU-Probleme.", action:"AGR reinigen oder tauschen lassen." },
  { kw:["adblue","harnstoff","scr"], cat:"reparatur", service:"Motorkontrollleuchte", guess:"AdBlue-System: Füllstand, Sensor oder Dosierung", conf:"hoch", why:"AdBlue-Warnungen kommen von leerem Tank, defekten NOx-Sensoren oder der Dosiereinheit.", risk:"Ohne Behebung verweigert das Auto irgendwann den Start (gesetzlich vorgeschrieben).", action:"Erst AdBlue auffüllen; bleibt die Meldung, Diagnose machen lassen." },
  { kw:["auspuff laut","auspuff","dröhnt","brummt laut","knattert"], cat:"reparatur", service:"Auspuff", guess:"Undichte oder durchgerostete Abgasanlage", conf:"hoch", why:"Auspuffanlagen rosten von innen; Übergänge und Flexrohre werden zuerst undicht.", risk:"Abgase können in den Innenraum gelangen; HU-Durchfall.", action:"Anlage auf der Bühne prüfen – oft reicht ein Teilstück." },
  { kw:["klappert unterm auto","hitzeblech","scheppert unten"], cat:"reparatur", service:"Auspuff", guess:"Loses Hitzeschutzblech oder Auspuffhalter", conf:"hoch", why:"Hitzeschutzbleche rosten an den Befestigungen und scheppern dann bei bestimmten Drehzahlen.", risk:"Meist harmlos, kann aber abfallen.", action:"Schnell gemacht: neu befestigen oder Schelle setzen." },
  { kw:["faule eier","schwefel","stinkt nach abgas"], cat:"reparatur", service:"Katalysator", guess:"Katalysator arbeitet nicht richtig", conf:"mittel", why:"Schwefelgeruch (faule Eier) entsteht, wenn der Kat das Gemisch nicht sauber umsetzt.", risk:"Kat-Schaden, HU-Durchfall.", action:"Lambdasonden und Kat prüfen lassen." },

  // ---------- Getriebe & Kupplung ----------
  { kw:["kupplung rutscht","drehzahl steigt aber","kupplung riecht","verbrannt beim anfahren"], cat:"reparatur", service:"Kupplung", guess:"Kupplung verschlissen", conf:"hoch", why:"Steigt die Drehzahl ohne Vortrieb, überträgt die Kupplung die Kraft nicht mehr – sie ist am Ende ihrer Lebensdauer.", risk:"Irgendwann fährt das Auto nicht mehr an; Schwungrad kann mitleiden.", action:"Kupplung ersetzen lassen, Zweimassenschwungrad mit prüfen." },
  { kw:["gang geht schwer rein","gänge hakeln","kratzt beim schalten","gang springt raus"], cat:"reparatur", service:"Getriebe", guess:"Kupplung trennt nicht oder Getriebeverschleiß", conf:"mittel", why:"Hakelige Gänge kommen von schlecht trennender Kupplung, verschlissenen Synchronringen oder zu wenig Getriebeöl.", risk:"Getriebeschaden mit hohen Kosten.", action:"Kupplungshydraulik und Getriebeöl prüfen lassen." },
  { kw:["automatik ruckt","dsg ruckelt","schaltet hart","schaltet verzögert","wandler"], cat:"reparatur", service:"Automatikgetriebe-Service", guess:"Automatik-/DSG-Problem – oft Ölstand oder Mechatronik", conf:"mittel", why:"Hartes oder verzögertes Schalten liegt oft an altem Getriebeöl oder der Mechatronik – viele Automaten brauchen entgegen der Werksangabe regelmäßige Ölwechsel.", risk:"Teurer Getriebeschaden.", action:"Getriebespülung/Ölwechsel und Anpassungsfahrt machen lassen." },
  { kw:["heult beim fahren","getriebe heult","singt","differenzial"], cat:"reparatur", service:"Getriebe", guess:"Lagergeräusch in Getriebe oder Differenzial", conf:"mittel", why:"Ein drehzahl- oder lastabhängiges Heulen deutet auf verschlissene Lager oder Zahnflanken hin.", risk:"Bis zum Blockieren fortschreitend.", action:"Probefahrt mit Fachmann, Ölstand prüfen." },

  // ---------- Fahrwerk & Lenkung ----------
  { kw:["klappert","poltert","poltern","schlägt beim fahren","über bodenwellen"], cat:"reparatur", service:"Fahrwerk", guess:"Koppelstange, Traggelenk oder Stabilager ausgeschlagen", conf:"hoch", why:"Poltern über Unebenheiten kommt fast immer von ausgeschlagenen Gummilagern oder Gelenken der Radaufhängung – Koppelstangen sind der Klassiker.", risk:"Verschlechtertes Fahrverhalten, erhöhter Reifenverschleiß, HU-Mangel.", action:"Fahrwerk auf der Bühne durchrütteln lassen – die Ursache ist meist schnell gefunden." },
  { kw:["knackt beim lenken","knacken beim lenken","knacken beim einschlagen","knackt beim anfahren","knackt in kurven","knacken","knackt"], cat:"reparatur", service:"Antriebswelle", guess:"Antriebswellengelenk (Gleichlaufgelenk) verschlissen", conf:"hoch", why:"Rhythmisches Knacken bei eingeschlagener Lenkung ist das typische Zeichen eines defekten Gleichlaufgelenks – oft ist die Manschette gerissen und das Fett raus.", risk:"Das Gelenk kann blockieren oder brechen.", action:"Gelenk/Manschette ersetzen lassen, je früher desto günstiger." },
  { kw:["brummt beim fahren","brummen wird schneller","radlager","dröhnen geschwindigkeit"], cat:"reparatur", service:"Radlager", guess:"Radlager defekt", conf:"hoch", why:"Ein Brummen, das mit der Geschwindigkeit lauter wird (und sich in Kurven ändert), ist meist ein verschlissenes Radlager.", risk:"Ein blockierendes Radlager ist gefährlich; das Rad kann sich lockern.", action:"Betroffenes Lager orten und tauschen lassen." },
  { kw:["lenkung schwergängig","servo","lenkt sich schwer","lenkung macht ger"], cat:"reparatur", service:"Servolenkung", guess:"Servolenkung: Flüssigkeit, Pumpe oder E-Motor", conf:"mittel", sev:"hoch", why:"Schwere Lenkung = Servounterstützung fällt aus – hydraulisch (Ölstand/Pumpe) oder elektrisch (Steuergerät).", risk:"In Notsituationen fehlt Lenkkraft – sicherheitskritisch.", action:"Umgehend prüfen lassen." },
  { kw:["zieht nach links","zieht nach rechts","fährt schief","lenkrad steht schief"], cat:"reifen", service:"Achsvermessung", guess:"Achsgeometrie verstellt oder ungleicher Reifendruck", conf:"hoch", why:"Nach Bordsteinkontakt oder Schlagloch stimmt oft die Spur nicht mehr – das Auto zieht zur Seite.", risk:"Einseitig abgefahrene Reifen in wenigen tausend Kilometern.", action:"Reifendruck prüfen, dann Achsvermessung machen lassen." },
  { kw:["lenkrad vibriert","flattert","unwucht","vibriert ab 100","vibriert ab 120"], cat:"reifen", service:"Wuchten", guess:"Unwucht der Räder", conf:"hoch", why:"Vibrationen ab ~90–130 km/h im Lenkrad sind fast immer eine Reifen-Unwucht – z.B. durch ein verlorenes Auswuchtgewicht.", risk:"Erhöhter Verschleiß an Lenkung und Radlagern.", action:"Räder feinwuchten lassen – schnell und günstig." },
  { kw:["schwammig","schaukelt","stoßdämpfer","federt nach","liegt unruhig"], cat:"reparatur", service:"Stoßdämpfer", guess:"Stoßdämpfer verschlissen", conf:"mittel", why:"Müde Dämpfer merkt man am Nachschwingen und unruhigem Geradeauslauf – schleichender Verschleiß ab ca. 80.000 km.", risk:"Deutlich längerer Bremsweg, besonders bei Nässe.", action:"Dämpfertest machen lassen, achsweise erneuern." },
  { kw:["feder gebrochen","knarzt vorne","quietscht beim einfedern"], cat:"reparatur", service:"Federn", guess:"Gebrochene Fahrwerksfeder oder trockene Lager", conf:"mittel", why:"Federn brechen gern am unteren Ende – hörbar als Knarzen oder sichtbar an hängender Ecke.", risk:"Gebrochene Feder kann den Reifen beschädigen – HU-relevant.", action:"Sichtprüfung, Federn immer paarweise ersetzen." },

  // ---------- Elektrik ----------
  { kw:["batterie leer","über nacht leer","immer wieder leer","ruhestrom"], cat:"reparatur", service:"Batterie", guess:"Alte Batterie oder heimlicher Verbraucher (Ruhestrom)", conf:"hoch", why:"Ist die Batterie öfter leer, ist sie entweder altersschwach oder ein Steuergerät schläft nicht ein und zieht Strom.", risk:"Liegenbleiben; Tiefentladung zerstört die Batterie endgültig.", action:"Batterietest + Ruhestrommessung machen lassen." },
  { kw:["lichtmaschine","lädt nicht","ladekontrolle","generator"], cat:"reparatur", service:"Lichtmaschine", guess:"Lichtmaschine oder Regler defekt", conf:"hoch", sev:"hoch", why:"Leuchtet die rote Batterielampe während der Fahrt, lädt der Generator nicht mehr – das Auto fährt nur noch auf Batteriereserve.", risk:"Nach 30–60 Minuten bleibt das Auto liegen.", action:"Direkt zur Werkstatt fahren, lange Strecken vermeiden." },
  { kw:["fensterheber","fenster geht nicht","scheibe klemmt"], cat:"reparatur", service:"Fensterheber", guess:"Fensterheber-Motor oder Seilzug defekt", conf:"hoch", why:"Die Seilzüge der Fensterheber verschleißen; oft kündigt sich das mit Knacken oder schiefem Lauf an.", risk:"Scheibe kann in die Tür fallen – Regen/Einbruchrisiko.", action:"Reparatursatz oder Motor tauschen lassen." },
  { kw:["zentralverriegelung","schließt nicht ab","tür entriegelt nicht"], cat:"reparatur", service:"Zentralverriegelung", guess:"Türschloss-Stellmotor oder Funkempfänger", conf:"mittel", why:"Meist ist der kleine Stellmotor im betroffenen Türschloss verschlissen.", risk:"Fahrzeug nicht sicher verschlossen.", action:"Betroffene Tür diagnostizieren lassen." },
  { kw:["licht flackert","scheinwerfer flackert","birne","abblendlicht ausgefallen","glühbirne"], cat:"reparatur", service:"Elektrik", guess:"Leuchtmittel, Stecker oder Masseproblem", conf:"hoch", why:"Flackerndes Licht kommt von Wackelkontakten oder sterbenden Leuchtmitteln; bei LED oft vom Steuergerät.", risk:"Lichtausfall = Bußgeld und HU-Mangel.", action:"Leuchtmittel/Anschlüsse prüfen lassen – oft Minutensache." },
  { kw:["sicherung fliegt","kurzschluss","kabelbrand","schmorgeruch","riecht verschmort"], cat:"reparatur", service:"Kabelbaum-Reparatur", guess:"Kurzschluss im Bordnetz", conf:"mittel", sev:"hoch", why:"Wiederholt fliegende Sicherungen oder Schmorgeruch deuten auf beschädigte Leitungen – häufig nach Marderbesuch oder Feuchtigkeit.", risk:"Brandgefahr!", action:"Nicht weiterfahren bei Schmorgeruch – Elektrik-Diagnose machen lassen." },
  { kw:["marder","biss","angeknabbert","kabel angebissen"], cat:"reparatur", service:"Marderschaden", guess:"Marderbiss an Kabeln oder Schläuchen", conf:"hoch", why:"Marder beißen bevorzugt Zündkabel, Kühlschläuche und Dämmmatten an – oft unbemerkt.", risk:"Von Zündaussetzern bis Motorüberhitzung.", action:"Motorraum kontrollieren und Bissschäden fachgerecht reparieren lassen; Marderschutz nachrüsten." },

  // ---------- Klima & Heizung ----------
  { kw:["klima kühlt nicht","klimaanlage","warme luft","kühlt schlecht"], cat:"klima", service:"Klimaservice", guess:"Kältemittel zu wenig oder Kompressor-Problem", conf:"hoch", why:"Klimaanlagen verlieren pro Jahr bis zu 10 % Kältemittel – irgendwann reicht es nicht mehr zum Kühlen.", risk:"Ohne Kältemittel wird der Kompressor nicht geschmiert – Folgeschaden droht.", action:"Klimaservice mit Lecksuche machen lassen." },
  { kw:["klima stinkt","muffig","riecht aus der lüftung"], cat:"klima", service:"Klimadesinfektion", guess:"Bakterien/Pilze am Verdampfer", conf:"hoch", why:"Am feuchten Verdampfer siedeln sich Mikroorganismen an – daher der muffige Geruch beim Einschalten.", risk:"Unangenehm und für Allergiker problematisch.", action:"Desinfektion + Innenraumfilter wechseln lassen." },
  { kw:["heizung bleibt kalt","heizt nicht","keine warme luft"], cat:"reparatur", service:"Kühlung", guess:"Thermostat, Wärmetauscher oder zu wenig Kühlmittel", conf:"mittel", why:"Kalte Heizung bei warmgefahrenem Motor deutet auf ein hängendes Thermostat oder verstopften Wärmetauscher.", risk:"Ein offen hängendes Thermostat erhöht Verbrauch und Verschleiß.", action:"Kühlsystem prüfen lassen." },
  { kw:["gebläse","lüftung geht nicht","lüfter laut"], cat:"reparatur", service:"Elektrik", guess:"Gebläsemotor oder Vorwiderstand defekt", conf:"mittel", why:"Fällt das Gebläse auf einzelnen Stufen aus, ist meist der Vorwiderstand durch – kompletter Ausfall spricht für den Motor.", risk:"Beschlagene Scheiben ohne Lüftung.", action:"Gebläseregler/Motor tauschen lassen." },
  { kw:["scheiben beschlagen","feucht im auto","nasser teppich","wasser im fußraum"], cat:"reparatur", service:"Geräusche", guess:"Wassereintritt – Abläufe verstopft oder Türfolie undicht", conf:"mittel", why:"Verstopfte Wasserabläufe (Windlauf, Schiebedach) oder undichte Türfolien lassen Wasser in den Innenraum.", risk:"Schimmel und Elektronikschäden durch Feuchtigkeit.", action:"Abläufe reinigen und Eintrittsstelle suchen lassen." },

  // ---------- Reifen ----------
  { kw:["reifen platt","luft verliert","schleichender plattfuß","reifendruck sinkt"], cat:"reifen", service:"Reifenreparatur", guess:"Nagel/Schraube im Reifen oder undichtes Ventil", conf:"hoch", why:"Langsamer Druckverlust kommt meist von eingefahrenen Fremdkörpern oder korrodierten Felgenrändern.", risk:"Plötzlicher Luftverlust bei Autobahntempo ist gefährlich.", action:"Reifen prüfen – viele Schäden sind reparabel." },
  { kw:["sägezahn","ungleichmäßig abgefahren","innen abgefahren","außen abgefahren"], cat:"reifen", service:"Achsvermessung", guess:"Verschleißbild deutet auf Spur-/Sturzfehler", conf:"hoch", why:"Einseitiger Verschleiß = Achsgeometrie; Sägezahn = oft Dämpfer oder Luftdruck.", risk:"Reifen halten nur einen Bruchteil der normalen Laufleistung.", action:"Achsvermessung + Fahrwerkcheck machen lassen." },
  { kw:["reifen wechseln","winterreifen","sommerreifen","räder tauschen"], cat:"reifen", service:"Reifenwechsel", guess:"Saisonaler Radwechsel", conf:"hoch", why:"Von O bis O: Oktober bis Ostern gilt als Faustregel für Winterreifen.", risk:"Mit Sommerreifen bei Glätte drohen Unfall und Versicherungsprobleme.", action:"Termin zum Umstecken inkl. Wuchten buchen." },

  // ---------- Karosserie, Glas, Pflege ----------
  { kw:["steinschlag","riss in der scheibe","scheibe gerissen","windschutzscheibe"], cat:"autoglas", service:"Steinschlagreparatur", guess:"Glasschaden – oft ohne Scheibentausch reparabel", conf:"hoch", why:"Kleine Steinschläge (bis ~5 mm, außerhalb des Sichtfelds) lassen sich mit Harz auffüllen – Kasko übernimmt das meist komplett.", risk:"Aus dem Steinschlag wird bei Kälte/Erschütterung schnell ein Riss – dann muss die ganze Scheibe neu.", action:"Schnell reparieren lassen, bevor ein Riss entsteht." },
  { kw:["delle","beule","parkrempler","hagelschaden"], cat:"karosserie", service:"Ausbeulen ohne Lackieren", guess:"Blechschaden – oft per Smart Repair lösbar", conf:"hoch", why:"Dellen ohne Lackschaden lassen sich meist lackschadenfrei ausdrücken – deutlich günstiger als eine Lackierung.", risk:"Bei beschädigtem Lack droht Rost.", action:"Foto machen und Angebote für Smart Repair einholen." },
  { kw:["rost","gammel","durchgerostet","blase im lack"], cat:"karosserie", service:"Rostbeseitigung", guess:"Korrosion – je früher behandelt, desto günstiger", conf:"hoch", why:"Rost wandert unter dem Lack weiter; Blasen zeigen, dass es darunter schon arbeitet.", risk:"Tragende Teile mit Durchrostung sind ein HU-K.o.", action:"Professionell entfernen und versiegeln lassen." },
  { kw:["kratzer","lack zerkratzt","vandalismus"], cat:"lack", service:"Smart Repair", guess:"Lackschaden – Ausbesserung meist punktuell möglich", conf:"hoch", why:"Oberflächliche Kratzer lassen sich polieren, tiefere per Smart Repair beilackieren.", risk:"Bis aufs Blech durchgehende Kratzer rosten.", action:"Tiefe mit Fingernagel-Test prüfen und Angebot einholen." },
  { kw:["tür schließt nicht","kofferraum geht nicht auf","heckklappe","schiebedach klemmt"], cat:"reparatur", service:"Zentralverriegelung", guess:"Schloss, Scharnier oder Mechanik defekt", conf:"mittel", why:"Schlösser und Mechaniken verschleißen oder verstellen sich.", risk:"Sicherheits- und Diebstahlrisiko.", action:"Mechanik einstellen oder Schloss ersetzen lassen." },

  // ---------- Schlüssel ----------
  { kw:["schlüssel","funkschlüssel","keyless","fernbedienung geht nicht","schlüssel verloren"], cat:"schluessel", service:"Schlüssel nachmachen", guess:"Funkschlüssel defekt oder Ersatzschlüssel nötig", conf:"hoch", why:"Oft ist nur die Batterie im Schlüssel leer; bei Verlust muss ein neuer Schlüssel codiert und der alte gesperrt werden.", risk:"Ohne Zweitschlüssel wird ein Verlust teuer und aufwendig.", action:"Batterie wechseln; sonst Schlüsseldienst mit Codiergerät aufsuchen." },
  { kw:["wegfahrsperre","schlüssel nicht erkannt"], cat:"schluessel", service:"Wegfahrsperre", guess:"Transponder oder Antennenring defekt", conf:"mittel", why:"Erkennt das Auto den Schlüssel nicht, ist der Transponderchip oder der Antennenring am Zündschloss gestört.", risk:"Fahrzeug lässt sich nicht starten.", action:"Zweitschlüssel testen – funktioniert er, liegt es am Schlüssel." },

  // ---------- E-Auto & Hybrid ----------
  { kw:["lädt nicht","ladesäule","wallbox","ladeklappe","ladekabel"], cat:"eauto", service:"Ladeelektronik", guess:"Ladeproblem – Kabel, Onboard-Lader oder Freigabe", conf:"mittel", why:"Ladeabbrüche haben viele Ursachen: Kabel, Ladesäulen-Kommunikation oder das Ladegerät im Auto.", risk:"Im Alltag stark einschränkend.", action:"An anderer Säule/anderem Kabel gegentesten, dann Diagnose." },
  { kw:["reichweite","batterie schnell leer","akku schwach","soh"], cat:"eauto", service:"HV-Batterie-Check", guess:"HV-Batterie: Kapazität prüfen lassen", conf:"mittel", why:"Reichweitenverlust ist im Winter normal; dauerhaft deutlich weniger km deutet auf gealterte Zellen.", risk:"Wertverlust; einzelne Modultausche sind günstiger als zu warten.", action:"Batteriezertifikat / SoH-Messung machen lassen." },
  { kw:["hybrid","hv-warnung","hochvolt"], cat:"eauto", service:"HV-Reparatur", guess:"Hochvoltsystem meldet Fehler", conf:"mittel", sev:"hoch", why:"HV-Warnungen können von Sensoren bis Isolationsfehlern reichen – hier darf nur geschultes Personal ran.", risk:"Sicherheitsrelevant; Fahrzeug kann sich abschalten.", action:"HV-qualifizierte Werkstatt aufsuchen." },

  // ---------- TÜV & Termine ----------
  { kw:["tüv","hu fällig","plakette","hauptuntersuchung","tüv abgelaufen"], cat:"tuev", service:"HU", guess:"Hauptuntersuchung fällig", conf:"hoch", why:"Die HU ist alle 2 Jahre fällig; überziehen kostet Bußgeld und ab 8 Monaten eine erweiterte Prüfung.", risk:"Bußgeld, Punkte und Probleme mit der Versicherung.", action:"HU-Termin buchen – gern mit Vorab-Check, damit es beim ersten Mal klappt." },
  { kw:["durchgefallen","mängelbericht","nachprüfung","erhebliche mängel"], cat:"tuev", service:"Mängelbeseitigung vor HU", guess:"Mängel aus HU-Bericht beheben", conf:"hoch", why:"Nach nicht bestandener HU hast du 4 Wochen für die Nachprüfung – sonst wird die komplette HU erneut fällig.", risk:"Fristablauf = doppelte Kosten.", action:"Mängelliste an Werkstätten schicken und Festpreis anfragen." },
  { kw:["inspektion","service fällig","wartung","serviceintervall","ölwechsel"], cat:"inspektion", service:"Kleine Inspektion", guess:"Wartung nach Herstellervorgabe", conf:"hoch", why:"Regelmäßige Wartung erhält Garantie/Kulanz und den Wiederverkaufswert – Ölwechsel ist die wichtigste Einzelmaßnahme.", risk:"Ausgelassene Services kosten spätestens beim Verkauf.", action:"Inspektionsangebote mit Scheckheft-Eintrag vergleichen." },

  // ---------- Assistenz & Komfort ----------
  { kw:["piept dauerhaft","einparkhilfe","pdc","parksensor"], cat:"reparatur", service:"Sensoren", guess:"Parksensor defekt oder verschmutzt", conf:"hoch", why:"Ein dauerpiepsender PDC-Sensor ist meist feucht, verdreckt oder intern defekt – der fehlerhafte Sensor klickt hörbar nicht mit.", risk:"Nur Komfortverlust, aber nervig.", action:"Sensoren reinigen; bleibt es, defekten Sensor tauschen." },
  { kw:["tempomat","abstandsregel","acc ausgefallen","spurhalte"], cat:"reparatur", service:"Sensoren", guess:"Assistenzsystem-Sensor gestört", conf:"mittel", why:"Radar-/Kamerasensoren fallen bei Verschmutzung, Steinschlag oder Dejustage aus.", risk:"Assistenzfunktionen fehlen; nach Scheibentausch ist oft Kalibrierung nötig.", action:"Sensorbereich reinigen, sonst Kalibrierung machen lassen." },
  { kw:["scheibenwischer","wischt schlieren","wischwasser","spritzt nicht"], cat:"reparatur", service:"Scheibenwischer / Waschanlage", guess:"Wischblätter verschlissen oder Düsen/Pumpe zu", conf:"hoch", why:"Wischgummis altern durch UV und sollten jährlich neu; verstopfte Düsen sind meist Kalk/Schmutz.", risk:"Schlechte Sicht – HU-Mangel.", action:"Wischer erneuern, Düsen reinigen lassen." },
  { kw:["standheizung"], cat:"reparatur", service:"Standheizung-Service", guess:"Standheizung startet nicht – oft Verrußung oder Unterspannung", conf:"mittel", why:"Standheizungen verrußen bei seltener Nutzung; bei schwacher Batterie verweigern sie den Start bewusst.", risk:"Gerät verschleißt weiter.", action:"Einmal monatlich laufen lassen; sonst Diagnose beim Spezialisten." },
  { kw:["tacho","kombiinstrument","anzeige tot","display schwarz"], cat:"reparatur", service:"Elektrik", guess:"Kombiinstrument oder Spannungsversorgung", conf:"mittel", why:"Tote Anzeigen kommen von Steckern, Masse oder dem Instrument selbst.", risk:"Ohne Tacho drohen unbemerkte Warnungen und Bußgeld.", action:"Elektrik-Diagnose machen lassen." },

  // ---------- Geräusche allgemein ----------
  { kw:["rasselt beim start","rasselt beim kaltstart","kette rasselt","rasseln kalt","rasselt","rasseln"], cat:"reparatur", service:"Steuerkette", guess:"Steuerkette gelängt oder Spanner schwach", conf:"hoch", sev:"hoch", why:"Kurzes Rasseln beim Kaltstart ist das typische Frühzeichen einer gelängten Steuerkette – der Spanner baut erst Öldruck auf.", risk:"Überspringt die Kette, ist der Motorschaden kapital.", action:"Nicht aussitzen – Kettenzustand prüfen lassen." },
  { kw:["quietscht beim starten","riemen quietscht","pfeift kalt"], cat:"reparatur", service:"Zahnriemen", guess:"Keilrippenriemen oder Spannrolle verschlissen", conf:"hoch", why:"Ein quietschender Riemen rutscht – Gummi ist verhärtet oder die Spannrolle schwach.", risk:"Reißt der Riemen, fallen Lichtmaschine, Servo und Wasserpumpe aus.", action:"Riemen + Rollen ersetzen lassen (günstiger Standard-Job)." },
  { kw:["zischt","zischen","luft entweicht"], cat:"reparatur", service:"Motor", guess:"Undichtigkeit im Unterdruck- oder Ladeluftsystem", conf:"mittel", why:"Zischen deutet auf entweichende Luft – Unterdruckschläuche oder Ladeluftstrecke.", risk:"Falschluft bringt Motorlauf und Abgaswerte durcheinander.", action:"Abdrücken/Rauchtest machen lassen." },
  { kw:["surrt","summt elektrisch","pumpe läuft nach"], cat:"reparatur", service:"Elektrik", guess:"Elektrische Pumpe oder Stellmotor läuft dauerhaft", conf:"mittel", why:"Nachlaufende Pumpen (Kraftstoff, Kühlmittel) können normal sein – dauerhaftes Surren deutet auf ein hängendes Relais.", risk:"Leergesaugte Batterie.", action:"Verursacher orten lassen." },

  // ---------- Kraftstoff & Geruch ----------
  { kw:["riecht nach benzin","spritgeruch","kraftstoffgeruch","riecht nach diesel"], cat:"reparatur", service:"Kraftstoffpumpe", guess:"Undichtigkeit im Kraftstoffsystem", conf:"mittel", sev:"hoch", why:"Kraftstoffgeruch entsteht durch poröse Leitungen, undichte Injektor-Dichtungen oder den Aktivkohlefilter.", risk:"Brandgefahr – ernst nehmen!", action:"Zeitnah prüfen lassen, nicht in geschlossenen Räumen parken." },
  { kw:["verbraucht mehr","hoher verbrauch","mehrverbrauch"], cat:"reparatur", service:"Motor", guess:"Lambdasonde, Luftmassenmesser oder Thermostat", conf:"mittel", why:"Deutlicher Mehrverbrauch ohne Fahrstiländerung kommt oft von alternden Sensoren oder einem dauerhaft offenen Thermostat.", risk:"Unnötige Spritkosten, mögliche Kat-Belastung.", action:"Istwerte auslesen lassen." },
  { kw:["falsch getankt","benzin statt diesel","diesel statt benzin"], cat:"reparatur", service:"Kraftstoffpumpe", guess:"Falschbetankung", conf:"hoch", sev:"hoch", why:"Benzin im Diesel zerstört die Schmierung der Hochdruckpumpe – Diesel im Benziner ist meist glimpflicher.", risk:"Motor NICHT starten! Sonst wird aus Absaugen ein Pumpentausch.", action:"Stehen lassen, Werkstatt/Pannendienst rufen und Tank leerpumpen lassen." },
];

// Normalisierung + Scoring: Phrasen zählen doppelt, mehr Treffer = höhere Konfidenz
function aiAnalyze(text, max = 4) {
  const t = " " + String(text || "").toLowerCase().replace(/\s+/g, " ") + " ";
  const scored = [];
  for (const r of AI_RULES) {
    let score = 0;
    for (const k of r.kw) if (t.includes(k)) score += k.includes(" ") ? 2 : 1;
    if (score > 0) scored.push(Object.assign({}, r, { score, conf: score >= 3 ? "hoch" : r.conf }));
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}

// ---------- Helfer ----------
function carLabel(v) {
  if (!v) return "";
  const parts = [v.make + " " + v.model];
  if (v.variant) parts[0] += " " + v.variant;
  else if (v.series && v.series !== "Keine Angabe") parts[0] += " " + v.series;
  if (v.fuel) parts.push(v.fuel);
  if (v.power_ps) parts.push(v.power_ps + " PS");
  if (v.year) parts.push("EZ " + (v.ez_month ? String(v.ez_month).padStart(2, "0") + "/" : "") + v.year);
  if (v.mileage) parts.push(Number(v.mileage).toLocaleString("de-DE") + " km");
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
