// ============================================================
// Carfixo – Eigenes Icon-Set (Linien-Stil, statt Emojis)
// Nutzung:  ico("wrench")            → <svg>…</svg> (1em, currentColor)
//           ico("wrench", 22)        → feste Pixelgröße
//           ico("wrench", {size:22, cls:"foo"})
// SVGs erben Farbe (currentColor) und Größe vom Kontext.
// ============================================================
"use strict";
(function () {
  // Jedes Icon = innerer Pfad-Content einer 24×24-Viewbox
  const P = {
    // --- Service-Kategorien ---
    wrench: '<path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.2L4 16.3V20h3.7l5.6-5.6a3.5 3.5 0 0 0 4.2-4.9l-2.3 2.3-2-2 2.3-2.3z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
    tire: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
    carbody: '<path d="M3 13.5l1.8-4.2A3 3 0 0 1 7.5 7.5h9a3 3 0 0 1 2.7 1.8L21 13.5M3 13.5h18v3.5a1 1 0 0 1-1 1h-1.5M3 13.5v3.5a1 1 0 0 0 1 1h1.5"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    car: '<path d="M3 13.5l1.8-4.2A3 3 0 0 1 7.5 7.5h9a3 3 0 0 1 2.7 1.8L21 13.5M3 13.5h18v3.5a1 1 0 0 1-1 1h-1.5M3 13.5v3.5a1 1 0 0 0 1 1h1.5"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    spray: '<rect x="8" y="9" width="7" height="11" rx="1.5"/><path d="M8 9V6.5A1.5 1.5 0 0 1 9.5 5H13M18 5h.01M20 7h.01M18 9h.01M16 3h.01M20 3h.01"/>',
    sparkle: '<path d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4 10.2 11.5 5.3 9.7 10.2 7.9z"/><path d="M18 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 6l2.4 1.8M12 6L9.6 7.8M12 18l2.4-1.8M12 18l-2.4-1.8M5.5 9.9l.3 2.9M5.5 9.9l-2.6 1M18.5 14.1l-.3-2.9M18.5 14.1l2.6-1"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5a3 3 0 0 1 6 0M8.5 11h7M8.5 15h5"/>',
    gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-4"/><circle cx="12" cy="16" r="1.2"/>',
    glass: '<path d="M5 9c2-2 4.5-3 7-3s5 1 7 3l-1.5 7.5a1.5 1.5 0 0 1-1.5 1.2H8a1.5 1.5 0 0 1-1.5-1.2z"/><path d="M12 6.2v11.5"/>',
    key: '<circle cx="8" cy="8" r="3.5"/><path d="M10.5 10.5L20 20M17 17l2-2M14 14l2-2"/>',
    bolt: '<path d="M13 3L5 13h5l-1 8 8-10h-5z"/>',
    puzzle: '<path d="M9 5.5a1.6 1.6 0 0 1 3.2 0c0 .6.5 1 1 1H15a1 1 0 0 1 1 1v1.8c0 .5.4 1 1 1a1.6 1.6 0 0 1 0 3.2c-.6 0-1 .5-1 1V17a1 1 0 0 1-1 1h-2.3M9 5.5c0 .6-.5 1-1 1H6a1 1 0 0 0-1 1V10c0 .5.4 1 1 1a1.6 1.6 0 0 1 0 3.2c-.6 0-1 .5-1 1V17a1 1 0 0 0 1 1h2.3c.6 0 1-.5 1-1v0a1.6 1.6 0 0 1 3.2 0v0c0 .5.5 1 1 1"/>',
    // --- Teile-Kategorien ---
    engine: '<rect x="7" y="9" width="8" height="7" rx="1"/><path d="M15 11h2l2-2v6M7 11H5l-1 2v-2M9 9V7h4v2M10 16v2h4v-2M15 13h3"/>',
    exhaust: '<path d="M3 13h9a3 3 0 0 1 3 3v0h6M18 13h3M18 16h3"/><circle cx="6" cy="13" r="0"/>',
    brake: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
    suspension: '<path d="M8 4v3M8 20v-3M8 7c-2 0-2 1.5 0 2s2 2 0 2.5 2 1.5 0 2.5M16 4v3M16 20v-3M16 7c-2 0-2 1.5 0 2s2 2 0 2.5 2 1.5 0 2.5"/>',
    lightbulb: '<path d="M9 16a5 5 0 1 1 6 0c-.6.5-1 1-1 1.8v.2H10v-.2c0-.8-.4-1.3-1-1.8z"/><path d="M10 20.5h4"/>',
    seat: '<path d="M7 4v7a2 2 0 0 0 2 2h5M7 13v6M7 19h9M17 8v5a2 2 0 0 1-2 2"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v2a6 6 0 0 1-12 0zM12 16v5"/>',
    oil: '<path d="M6 20h9a3 3 0 0 0 3-3v-3l-3-1V8H6zM15 12l4-2M6 8V6h6v2"/>',
    box: '<path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8"/>',
    tag: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8" cy="8" r="1.4"/>',
    // --- UI / Aktionen ---
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    robot: '<rect x="5" y="8" width="14" height="10" rx="2.5"/><path d="M12 4v4M9.5 12.5h.01M14.5 12.5h.01M9 18v2M15 18v2M5 12H3.5M20.5 12H19"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l8 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M17 9a3 3 0 0 1 0 6"/>',
    alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4M12 17h.01"/>',
    shop: '<path d="M4 9l1-4h14l1 4M4 9h16M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 20v-5h6v5"/>',
    camera: '<rect x="3.5" y="7" width="17" height="12" rx="2.5"/><circle cx="12" cy="13" r="3.2"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
    star: '<path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1 5.9L12 17.2 6.8 20l1-5.9L3.5 9.8l5.9-.8z"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
    phone: '<path d="M6 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
    doc: '<path d="M7 3h7l4 4v14a0 0 0 0 1 0 0H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13 3v5h5M9 13h6M9 16h6"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.2 11a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 18a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/>',
    euro: '<path d="M17 6.5A6 6 0 1 0 17 17M5 10h7M5 13h6"/>',
    arrowR: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    heart: '<path d="M12 20S4 14.5 4 8.8A4.3 4.3 0 0 1 12 6a4.3 4.3 0 0 1 8 2.8C20 14.5 12 20 12 20z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    trash: '<path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M10 11v6M14 11v6"/>',
    flag: '<path d="M6 21V4M6 4h11l-2 3.5L17 11H6"/>',
    send: '<path d="M4 12l16-8-6 16-3-6-7-2z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19l-4 1z"/>',
  };
  // Alias-Zuordnung Kategorie-Schlüssel → Icon
  const ALIAS = {
    reparatur: "wrench", inspektion: "gear", reifen: "tire", karosserie: "carbody",
    lack: "spray", pflege: "sparkle", klima: "snow", tuev: "clipboard",
    tuning: "gauge", autoglas: "glass", schluessel: "key", oldtimer: "car",
    eauto: "bolt", teile: "puzzle",
    motor: "engine", auspuff: "exhaust", bremsen: "brake", fahrwerk: "suspension",
    felgen: "tire", beleuchtung: "lightbulb", innenraum: "seat", elektrik: "plug",
    tuningteile: "gauge", oele: "oil", zubehoer: "box", sonstiges: "box",
    werkstatt: "wrench",
  };
  function ico(name, opts) {
    const key = ALIAS[name] || name;
    const path = P[key] || P.wrench;
    let size = null, cls = "ico-svg";
    if (typeof opts === "number") size = opts;
    else if (opts && typeof opts === "object") { size = opts.size || null; if (opts.cls) cls += " " + opts.cls; }
    const dim = size ? `width="${size}" height="${size}"` : `width="1em" height="1em"`;
    return `<svg class="${cls}" ${dim} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-.15em;flex:none">${path}</svg>`;
  }
  window.ico = ico;
  window.ICO_ALIAS = ALIAS;
})();
