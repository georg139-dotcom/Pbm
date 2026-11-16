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
  hwr:      { label: 'Beheizter Nebenraum außerhalb der Wohnung (Hausflur/Treppenhaus)', theta: 15, nmin: 0.5 },
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
  { name: 'Dresden (PLZ 01067)', thetaE: -12, thetaM: 10.0 },
  { name: 'Nürnberg',   thetaE: -16, thetaM: 9.0 },
  { name: 'Hannover',   thetaE: -12, thetaM: 9.5 },
];

// ---- Werte aus DIN EN 12831-1:2017-09 (vereinfachtes Verfahren, Anhang B) ----
// Abschrift der Tabellen; bitte stichprobenartig gegen die Norm prüfen.

/** Tab. B.11 – Temperatur-Korrekturfaktor f_x (vereinfachtes Verfahren) */
export const FX_EN = { aussen: 1.0, unbeheizt: 0.5, erdreich: 0.3, beheizt: 0.3 };
/** Nachbarraum wird nur berücksichtigt, wenn die Temperaturdifferenz > 4 K ist (Abschn. 7.3.2) */
export const MIN_DT_NEIGHBOR = 4;
/** Tab. B.10 – Verhältnis Außen-/Innenfläche (vertikale Außenwand) */
export const F_INT_EXT_WALL = 1.25;
/** Pauschaler Wärmebrückenzuschlag im vereinfachten Verfahren (B.3.2) */
export const DELTA_U_TB_EN = 0.1;
/** Luftwechselrate Einzelräume im vereinfachten Verfahren (Tab. B.12) */
export const N_SIMPLE = 0.5;

/**
 * DIN/TS 12831-1:2020-04, Tab. 33 – U-Wert nach Baujahr (ersetzt EN-Tab. B.15).
 * Spalten: Baujahr je Bauteil. Zusammengefasste Tabellenzellen sind auf die Einzelklassen
 * aufgelöst – bitte stichprobenartig gegen die Norm prüfen (null = „—“, nicht vorgesehen).
 */
export const BAUJAHR_KLASSEN = ['bis 1918', '1919–48', '1949–57', '1958–68', '1969–78', '1979–83', '1984–94', 'ab 1995'];
const N = null;
export const B15 = {
  wand: [
    ['Außenwand massiv, zweischalig ohne Dämmschicht', [1.3, 1.3, 1.4, 1.4, 1.0, 0.8, 0.6, 0.5]],
    ['Vollziegel/Naturstein/Kalksandstein ≤ 20 cm', [2.8, 2.8, 2.8, N, N, N, N, N]],
    ['Vollziegel usw. 20–30 cm', [1.8, 1.8, 1.8, N, N, N, N, N]],
    ['Vollziegel usw. > 30 cm', [1.5, 1.5, 1.5, N, N, N, N, N]],
    ['Hochlochziegel/Hohlstein/porös', [1.4, 1.4, 1.4, 1.4, 1.0, 0.8, 0.6, 0.5]],
    ['Sonstige massive Wand ≤ 20 cm', [3.0, 3.0, 1.4, 1.4, 1.0, 0.8, 0.7, 0.7]],
    ['Holzkonstruktion Massivholz/Rahmen gedämmt', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.4, 0.4]],
    ['Fachwerk, Lehmausfachung ≤ 25 cm', [1.5, 1.5, 1.5, N, N, N, N, N]],
    ['Fachwerk, Vollziegel-/Natursteinausfachung ≤ 25 cm', [2.0, 2.0, 2.0, N, N, N, N, N]],
    ['Sonstige Holzkonstruktion', [2.0, 2.0, 1.5, 1.4, 0.6, 0.5, 0.4, 0.4]],
  ],
  fenster: [
    ['Holzrahmen, Einfachverglasung', [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, N, N]],
    ['Holzrahmen, Zweifachverglasung', [2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, N]],
    ['Holzrahmen, Isolierverglasung', [N, N, N, N, N, N, N, 1.6]],
    ['Kunststoffrahmen, Isolierverglasung', [N, N, N, 3.0, 3.0, 3.0, 3.0, 1.9]],
    ['Metallrahmen, Isolierverglasung', [N, N, N, 4.3, 4.3, 4.3, 3.2, 1.9]],
  ],
  tuer: [
    ['Tür im Wesentlichen aus Metall', [4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0]],
    ['Tür aus Holz/Holzwerkstoff/Kunststoff', [2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9]],
  ],
  dach: [
    ['Dach/Wand zu unbeh. Dachboden, Massivbauweise', [2.1, 2.1, 2.1, 1.3, 1.3, 0.6, 0.4, 0.3]],
    ['Dach/Wand zu unbeh. Dachboden, Holzkonstruktion', [2.6, 1.4, 1.4, 1.4, 0.8, 0.7, 0.5, 0.3]],
  ],
  decke: [
    ['Oberste Geschossdecke/Decke an Außenluft, Massiv', [2.1, 2.1, 2.1, 2.1, 0.6, 0.6, 0.6, 0.3]],
    ['Oberste Geschossdecke/Decke an Außenluft, Holzbalken', [1.0, 0.8, 0.8, 0.7, 0.6, 0.4, 0.4, 0.3]],
    ['Kellerdecke Stahlbeton massiv', [1.6, 1.6, 2.3, 1.0, 1.0, 0.8, 0.6, 0.6]],
    ['Kellerdecke Holzbalken', [1.0, 0.8, 0.8, 0.8, 0.6, 0.6, 0.4, 0.4]],
    ['Kellerdecke Ziegel-/Hohlsteinkonstruktion', [1.2, 1.2, 1.5, 1.0, 1.0, 0.8, 0.6, 0.6]],
  ],
  boden: [
    ['Boden gg. Erdreich, Stahlbeton massiv', [1.6, 1.6, 2.3, 1.2, 1.2, 0.8, 0.6, 0.6]],
    ['Boden gg. Erdreich, Ziegel-/Hohlsteinkonstruktion', [1.2, 1.2, 1.5, 1.0, 1.0, 0.8, 0.6, 0.6]],
    ['Boden gg. Erdreich/Hohlraum, Holzkonstruktion', [1.8, 1.8, 1.0, 0.8, 0.6, 0.6, 0.4, 0.4]],
  ],
};

/** Tab. 34 (TS) / B.16 (EN) – U-Wert nach nachträglicher Dämmung. Zeilen: obere U-Grenze des Altwerts */
export const B16_THICKNESS = [2, 5, 8, 12, 16, 20, 30, 40];
export const B16 = [
  { uMax: 0.5, vals: [0.40, 0.31, 0.25, 0.20, 0.17, 0.14, 0.11, 0.08] },
  { uMax: 0.7, vals: [0.52, 0.37, 0.29, 0.23, 0.18, 0.16, 0.11, 0.09] },
  { uMax: 1.0, vals: [0.67, 0.44, 0.33, 0.25, 0.20, 0.17, 0.12, 0.09] },
  { uMax: 1.5, vals: [0.86, 0.52, 0.38, 0.27, 0.21, 0.18, 0.12, 0.09] },
  { uMax: 2.0, vals: [1.00, 0.57, 0.40, 0.29, 0.22, 0.18, 0.13, 0.10] },
  { uMax: 2.5, vals: [1.11, 0.61, 0.42, 0.29, 0.23, 0.19, 0.13, 0.10] },
  { uMax: Infinity, vals: [1.20, 0.63, 0.53, 0.30, 0.23, 0.19, 0.13, 0.10] },
];
export function uWithInsulation(u, cm) {
  const i = B16_THICKNESS.indexOf(cm);
  if (i < 0 || !(cm > 0)) return u;
  return B16.find((r) => u <= r.uMax).vals[i];
}

/**
 * DIN/TS 12831-1:2020-04, Abschn. 5.1.4 – Schätzung der Außenwand- und Fensterfläche aus der Raumfläche
 * (Tab. 22 f_W inkl. Fenster, Tab. 23 f_F; Gl. 39, 40; Außenmaße, Wert mit 75 % Wahrscheinlichkeit auf der sicheren Seite)
 */
export function estimateFacade(roomType, nOuterWalls, areaR) {
  const n = Math.max(1, Math.round(nOuterWalls));
  let fW, fF;
  if (['wohnen', 'schlafen', 'kind'].includes(roomType)) { fW = n >= 3 ? 1.52 : n === 2 ? 1.26 : 0.82; fF = 0.22; }
  else if (roomType === 'kueche') { fW = n >= 2 ? 1.68 : 0.93; fF = 0.24; }
  else if (roomType === 'bad') { fW = n >= 2 ? 1.32 : 1.17; fF = 0.26; }
  else { fW = 1.07; fF = 0.20; }
  const AF = fF * areaR;
  return { fW, fF, AF, AW: Math.max(0, fW * areaR - AF) };
}
