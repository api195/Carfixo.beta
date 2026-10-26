# Kachelbilder rendern

`render.html` baut jeden Gegenstand in three.js aus Grundformen und rendert ihn
mit derselben Kamera, demselben Licht und demselben Schatten. So bleiben alle
Bilder im gleichen Stil.

```bash
cd tools/kacheln
npm i --no-save three@0.170.0 playwright
python3 -m http.server 8010 &        # render.html braucht einen Server
mkdir -p out
node shoot.js out reparatur inspektion reifen tuev pflege karosserie klima tuning
```

Danach jedes PNG zuschneiden (transparenten Rand weg, quadratisch, 288 px) und als
WebP nach `assets/img/kategorien/` legen, z. B. mit ImageMagick:

```bash
n=reifen
g=$(convert out/$n.png -channel A -threshold 4% +channel -format %@ info:)
convert out/$n.png -crop $g +repage -background none -gravity center \
  -extent 450x450 -resize 288x288 -quality 85 ../../assets/img/kategorien/$n.webp
```

(`-extent` etwa 8 % größer als die längere Seite von `$g` wählen.)

Neues Motiv: in `render.html` unter `BUILD` eine Funktion mit dem Namen der
Kategorie anlegen. Größe und Kamera passt das Skript selbst an.
