// Konstanten und Kataloge. Alle Werte sind Richtwerte und in der Oberfläche überschreibbar.

export const RHO_CP = 0.34;     // Wh/(m³·K) – Wärmekapazität Luft
export const C_WATER = 1.163;   // Wh/(kg·K) – spez. Wärmekapazität Wasser
export const NORM_DT = 49.83;   // K – log. Übertemperatur bei 75/65/20 (Normleistung Heizkörper)
export const MBAR_PER_M = 98.07; // mbar je m Förderhöhe

/** Raumtypen mit Normdaten (Innentemperatur, Mindestluftwechsel) – editierbar pro Raum */
export const ROOM_TYPES = {
  wohnen:   { label: 'Wohnen / Essen',     theta: 20, nmin: 0.5 },
  schlafen: { label: 'Schlafzimmer',       theta: 20, nmin: 0.5 },
  kind:     { label: 'Kinderzimmer',       theta: 20, nmin: 0.5 },
  arbeit:   { label: 'Arbeitszimmer',      theta: 20, nmin: 0.5 },
  kueche:   { label: 'Küche',              theta: 20, nmin: 0.5 },
  bad:      { label: 'Bad',                theta: 24, nmin: 0.5 },
  wc:       { label: 'WC',                 theta: 20, nmin: 0.5 },
  flur:     { label: 'Flur / Diele',       theta: 20, nmin: 0.5 },
  hwr:      { label: 'Hauswirtschaft',     theta: 15, nmin: 0.5 },
  sonstig:  { label: 'Sonstiger Raum',     theta: 20, nmin: 0.5 },
};

/** Temperaturreduktionsfaktoren je Bauteil-Grenze (vereinfachte Pauschalwerte) */
export const BOUNDARY = {
  aussen:    { label: 'Außenluft' },
  erdreich:  { label: 'Erdreich',               f: 0.45 },
  unbeheizt: { label: 'Unbeheizter Raum',       f: 0.5 },
  beheizt:   { label: 'Beheizter Nachbarraum' },
};

export const ELEMENT_TYPES = {
  wand: 'Wand', fenster: 'Fenster', tuer: 'Tür', dach: 'Dach/Schräge', decke: 'Decke', boden: 'Boden',
};

/** U-Wert-Vorlagen (typische Bestandswerte, Näherung – bitte mit Aufbau/Messung prüfen) */
export const U_PRESETS = {
  wand: [
    ['Vollziegel 24 cm, unged.', 1.9], ['Vollziegel 36,5 cm, unged.', 1.4], ['Hochlochziegel 36,5 cm', 1.0],
    ['Bimsbeton/Gasbeton 30 cm', 0.9], ['Stahlbeton 20 cm, unged.', 3.0], ['Fachwerk gefüllt', 1.8],
    ['Wand mit 6 cm WDVS', 0.45], ['Wand mit 12 cm WDVS', 0.28], ['Neubau-Standard (Wand)', 0.24],
  ],
  fenster: [
    ['Einfachverglasung', 5.0], ['Kastenfenster', 2.4], ['Isolierverglasung 2-fach (alt)', 2.8],
    ['Wärmeschutz 2-fach', 1.4], ['Wärmeschutz 3-fach', 0.9],
  ],
  tuer: [['Holztür Außen, alt', 3.0], ['Haustür Standard', 1.8], ['Haustür gedämmt', 1.2], ['Innentür', 2.0]],
  dach: [
    ['Dach ungedämmt', 2.0], ['Dach 8 cm gedämmt', 0.50], ['Dach 16 cm gedämmt', 0.25], ['Dach 24 cm gedämmt', 0.17],
    ['Flachdach ungedämmt', 1.8], ['Flachdach gedämmt', 0.30],
  ],
  decke: [
    ['Geschossdecke ungedämmt (OGD)', 1.0], ['OGD 10 cm gedämmt', 0.30], ['Kellerdecke ungedämmt', 1.0],
    ['Kellerdecke 6 cm gedämmt', 0.45], ['Decke zw. beheizten Geschossen', 1.0],
  ],
  boden: [
    ['Bodenplatte ungedämmt', 1.2], ['Bodenplatte gedämmt', 0.35], ['Boden über Keller ungedämmt', 1.0],
  ],
};

/** Typisches Thermostatventil – Kv je Voreinstellung (Herstellerdaten eintragen!) */
export const DEFAULT_VALVE_KV = [0.05, 0.09, 0.15, 0.22, 0.30, 0.38, 0.50, 0.70];

/** Klimadaten: Normaußentemperatur und Jahresmittel – Richtwerte, mit Normtabelle/PLZ prüfen */
export const CLIMATE_PRESETS = [
  { name: 'Berlin',     thetaE: -14, thetaM: 9.5 },
  { name: 'Hamburg',    thetaE: -12, thetaM: 9.0 },
  { name: 'München',    thetaE: -16, thetaM: 8.5 },
  { name: 'Köln',       thetaE: -10, thetaM: 10.5 },
  { name: 'Frankfurt',  thetaE: -12, thetaM: 10.0 },
  { name: 'Stuttgart',  thetaE: -12, thetaM: 9.5 },
  { name: 'Dresden',    thetaE: -14, thetaM: 9.0 },
  { name: 'Nürnberg',   thetaE: -16, thetaM: 9.0 },
  { name: 'Hannover',   thetaE: -12, thetaM: 9.5 },
];
