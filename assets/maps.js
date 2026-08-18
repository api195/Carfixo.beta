// ============================================================
// Carfixo – Karten-Schicht (Google Maps mit Leaflet-Rückfall)
//
// Warum diese Datei?
//   Die App zeichnet an drei Stellen Karten (Suche, Werkstattprofil,
//   Betriebs-Onboarding). Statt Google Maps dreimal einzubauen, gibt es
//   hier eine gemeinsame, kleine Schnittstelle:
//
//       const m = CarfixoMaps.create("map", { center: [50.94, 6.96], zoom: 12 });
//       m.onClick(ll => …); m.addPin(ll, { iconName: "reparatur", popup: "<b>…</b>" });
//       m.fitMarkers(); m.refresh();
//
//   Welcher Anbieter dahinter steckt, entscheidet allein der Key in
//   assets/config.js:
//       GOOGLE_MAPS_KEY gesetzt   → Google Maps
//       leer / Skript blockiert   → Leaflet + OpenStreetMap (wie bisher)
//
//   Die Karte wird sofort zurückgegeben, obwohl das Google-Skript erst
//   nachgeladen wird. Alle Aufrufe davor landen in einer Warteschlange und
//   werden der Reihe nach ausgeführt, sobald der Anbieter bereit ist.
//   Dadurch bleibt der Aufrufer in app.js synchron und unverändert einfach.
// ============================================================
"use strict";
(function () {
  const KEY = String((window.CARFIXO && window.CARFIXO.GOOGLE_MAPS_KEY) || "").trim();
  const WANT_GOOGLE = KEY.length > 0;

  // Dunkler Kartenstil passend zum Carfixo-Design (#05070D / #0A101E).
  // Wird nur ohne Cloud-Map-ID angewandt – genau so nutzen wir es hier.
  const DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#0A101E" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8A94A6" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0A101E" }] },
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#182234" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6C7789" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243349" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#9AA6B8" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#243349" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#050A14" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#40506B" }] },
  ];

  // ---- Google-Skript einmalig nachladen ------------------------------
  let loader = null;
  function loadGoogle() {
    if (!WANT_GOOGLE) return Promise.resolve(false);
    if (loader) return loader;
    loader = new Promise((resolve) => {
      if (window.google && window.google.maps) return resolve(true);
      const cb = "__carfixoMapsReady";
      const done = (ok) => { try { delete window[cb]; } catch (e) { window[cb] = undefined; } resolve(ok); };
      window[cb] = () => done(true);
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js"
        + "?key=" + encodeURIComponent(KEY)
        + "&v=weekly&language=de&region=DE&callback=" + cb;
      s.async = true;
      // Adblocker, fehlender Key, kein Netz: still auf Leaflet zurückfallen.
      s.onerror = () => done(false);
      document.head.appendChild(s);
      setTimeout(() => done(!!(window.google && window.google.maps)), 10000);
    });
    return loader;
  }

  // ---- Marker-Grafik: Tropfen-Pin mit Kategorie-Icon als Data-URI -----
  function pinDataUri(iconName) {
    const inner = String(window.ico ? window.ico(iconName || "reparatur", 15) : "")
      .replace(/currentColor/g, "#FFFFFF");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="43" viewBox="0 0 34 43">'
      + '<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#2E77FF"/><stop offset="1" stop-color="#0A47C2"/>'
      + '</linearGradient></defs>'
      + '<path d="M17 42S31.5 25.6 31.5 16A14.5 14.5 0 1 0 2.5 16C2.5 25.6 17 42 17 42Z" '
      + 'fill="url(#p)" stroke="#0A47C2" stroke-width="1"/>'
      + '<g transform="translate(9.5,8.5)">' + inner + '</g></svg>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  // ---- Anbieter: Google ----------------------------------------------
  function googleImpl(el, opts) {
    const g = window.google.maps;
    const interactive = opts.interactive !== false;
    const map = new g.Map(el, {
      center: { lat: opts.center[0], lng: opts.center[1] },
      zoom: opts.zoom,
      styles: DARK_STYLE,
      scrollwheel: !!opts.scrollWheel,
      gestureHandling: interactive ? "cooperative" : "none",
      draggable: interactive,
      disableDefaultUI: true,
      zoomControl: interactive,
      clickableIcons: false,
      keyboardShortcuts: false,
    });
    let info = null;
    const markers = [];
    const openInfo = (marker, html) => {
      if (!info) info = new g.InfoWindow();
      info.setContent('<div class="gmInfo">' + html + "</div>");
      info.open({ map, anchor: marker });
    };
    return {
      setView: (ll, zoom) => { map.setCenter({ lat: ll[0], lng: ll[1] }); if (zoom) map.setZoom(zoom); },
      onClick: (cb) => map.addListener("click", (e) => cb([e.latLng.lat(), e.latLng.lng()])),
      addDot: (ll, o) => {
        const m = new g.Marker({
          map, position: { lat: ll[0], lng: ll[1] },
          icon: {
            path: g.SymbolPath.CIRCLE, scale: (o && o.radius) || 8,
            fillColor: (o && o.color) || "#1E6BFF", fillOpacity: 0.95,
            strokeColor: (o && o.stroke) || "#9CC6FF", strokeWeight: 2,
          },
        });
        if (o && o.popup) m.addListener("click", () => openInfo(m, o.popup));
        markers.push(m); return m;
      },
      addPin: (ll, o) => {
        const m = new g.Marker({
          map, position: { lat: ll[0], lng: ll[1] }, title: (o && o.title) || "",
          icon: { url: pinDataUri(o && o.iconName), scaledSize: new g.Size(34, 43), anchor: new g.Point(17, 42) },
        });
        if (o && o.popup) m.addListener("click", () => openInfo(m, o.popup));
        markers.push(m); return m;
      },
      addDraggable: (ll, onMove) => {
        const m = new g.Marker({ map, position: { lat: ll[0], lng: ll[1] }, draggable: true });
        m.addListener("dragend", () => onMove([m.getPosition().lat(), m.getPosition().lng()]));
        return { setPosition: (p) => m.setPosition({ lat: p[0], lng: p[1] }), _raw: m };
      },
      clearMarkers: () => { markers.forEach(m => m.setMap(null)); markers.length = 0; if (info) info.close(); },
      fitMarkers: () => {
        if (!markers.length) return;
        const b = new g.LatLngBounds();
        markers.forEach(m => b.extend(m.getPosition()));
        if (markers.length === 1) map.setCenter(b.getCenter());
        else map.fitBounds(b, 48);
      },
      refresh: () => g.event.trigger(map, "resize"),
    };
  }

  // ---- Anbieter: Leaflet (Rückfall, bisheriges Verhalten) -------------
  function leafletImpl(el, opts) {
    const interactive = opts.interactive !== false;
    const map = L.map(el, {
      scrollWheelZoom: !!opts.scrollWheel,
      dragging: interactive,
      zoomControl: interactive,
    }).setView(opts.center, opts.zoom);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    const markers = [];
    return {
      setView: (ll, zoom) => map.setView(ll, zoom || map.getZoom()),
      onClick: (cb) => map.on("click", (e) => cb([e.latlng.lat, e.latlng.lng])),
      addDot: (ll, o) => {
        const m = L.circleMarker(ll, {
          radius: (o && o.radius) || 8, color: (o && o.stroke) || (o && o.color) || "#1E6BFF",
          fillColor: (o && o.color) || "#1E6BFF", fillOpacity: 0.9,
        }).addTo(map);
        if (o && o.popup) m.bindPopup(o.popup);
        markers.push(m); return m;
      },
      addPin: (ll, o) => {
        const icon = L.divIcon({
          className: "",
          html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);'
            + 'background:linear-gradient(135deg,#2E77FF,#0A47C2);box-shadow:0 6px 16px rgba(30,107,255,.5);'
            + 'display:flex;align-items:center;justify-content:center">'
            + '<span style="transform:rotate(45deg);color:#fff">'
            + (window.ico ? window.ico((o && o.iconName) || "reparatur", 13) : "") + "</span></div>",
          iconSize: [30, 30], iconAnchor: [15, 30],
        });
        const m = L.marker(ll, { icon }).addTo(map);
        if (o && o.popup) m.bindPopup(o.popup);
        markers.push(m); return m;
      },
      addDraggable: (ll, onMove) => {
        const m = L.marker(ll, { draggable: true }).addTo(map);
        m.on("dragend", () => { const p = m.getLatLng(); onMove([p.lat, p.lng]); });
        return { setPosition: (p) => m.setLatLng(p), _raw: m };
      },
      clearMarkers: () => { markers.forEach(m => map.removeLayer(m)); markers.length = 0; },
      fitMarkers: () => { if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25)); },
      refresh: () => map.invalidateSize(),
    };
  }

  // ---- Öffentliche Fassade mit Warteschlange --------------------------
  const METHODS = ["setView", "onClick", "addDot", "addPin", "addDraggable", "clearMarkers", "fitMarkers", "refresh"];

  function create(elId, opts) {
    const o = Object.assign({ center: [50.9375, 6.9603], zoom: 12, interactive: true, scrollWheel: false }, opts || {});
    const handle = { provider: null };
    let impl = null;
    const queue = [];
    // Rückgabewerte von addPin/addDot/addDraggable werden erst später real –
    // deshalb geben wir eine Hülle zurück, die den echten Marker nachreicht.
    const proxies = new Map();

    METHODS.forEach((name) => {
      handle[name] = function () {
        const args = Array.prototype.slice.call(arguments);
        if (impl) return runOn(impl, name, args, null);
        const shell = { setPosition: (p) => { shell._pending = p; if (shell._real) shell._real.setPosition(p); } };
        queue.push([name, args, shell]);
        return shell;
      };
    });

    function runOn(target, name, args, shell) {
      const out = target[name].apply(target, args);
      if (shell && out && typeof out.setPosition === "function") {
        shell._real = out;
        if (shell._pending) out.setPosition(shell._pending);
      }
      return out;
    }

    function boot(useGoogle) {
      const el = document.getElementById(elId);
      if (!el) return;                       // Ansicht wurde inzwischen verlassen
      try {
        impl = useGoogle ? googleImpl(el, o) : leafletImpl(el, o);
        handle.provider = useGoogle ? "google" : "leaflet";
      } catch (e) {
        if (useGoogle) { impl = leafletImpl(el, o); handle.provider = "leaflet"; }
        else throw e;
      }
      queue.forEach(([name, args, shell]) => runOn(impl, name, args, shell));
      queue.length = 0;
    }

    if (WANT_GOOGLE) loadGoogle().then(boot);
    else boot(false);

    return handle;
  }

  window.CarfixoMaps = { create, load: loadGoogle, usesGoogle: () => WANT_GOOGLE };
})();
