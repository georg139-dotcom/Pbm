// Vereinfachte raumweise Heizlastberechnung in Anlehnung an DIN/TS 12831-1:2020-04.
// Kein zertifizierter Normnachweis – siehe README (Annahmen & Grenzen).
import { RHO_CP, BOUNDARY, FX_EN, MIN_DT_NEIGHBOR, F_INT_EXT_WALL, DELTA_U_TB_EN, N_SIMPLE, uWithInsulation } from './catalog.js';

const OPAQUE = new Set(['wand', 'dach', 'decke', 'boden']);
const EXPOSED = new Set(['wand', 'fenster', 'tuer', 'dach']);

/**
 * Temperaturkorrekturfaktor f eines Bauteils.
 * method 'en'  : Tab. B.11 der DIN EN 12831-1:2017 (Erdreich 0,3 / unbeheizt 0,5 / beheizter Nachbar 0,3)
 * method 'ext' : frühere Näherung (Erdreich 0,45, Nachbar aus tatsächlicher Temperaturdifferenz)
 */
export function elementFactor(el, ti, te, method = 'en') {
  const dT = ti - te;
  if (el.boundary === 'aussen') return 1;
  if (method === 'en') return el.f ?? FX_EN[el.boundary] ?? 1;
  switch (el.boundary) {
    case 'erdreich': return el.f ?? BOUNDARY.erdreich.f;
    case 'unbeheizt': return el.f ?? BOUNDARY.unbeheizt.f;
    case 'beheizt': return dT === 0 ? 0 : (ti - (el.thetaNb ?? ti)) / dT;
    default: return 1;
  }
}

/** Heizlast eines Raums */
export function calcRoom(room, project) {
  const te = project.climate.thetaE;
  const ti = room.theta;
  const dT = ti - te;
  const method = project.heatMethod ?? 'en';
  const wb = method === 'en' ? (project.wb ?? DELTA_U_TB_EN) : (project.wb ?? 0.10);
  const warnings = [];

  const area = room.area || 0;
  const height = room.height || 0;
  const volume = area * height;
  if (area <= 0) warnings.push('Raumfläche fehlt.');
  if (height <= 0) warnings.push('Raumhöhe fehlt.');
  if (dT <= 0) warnings.push('Innentemperatur ≤ Normaußentemperatur.');

  let phiT = 0, phiTIntern = 0, exposed = false;
  const elements = (room.elements || []).map((el) => {
    let f = elementFactor(el, ti, te, method);
    // EN 12831-1, 7.3.2: Nachbarräume nur bei Temperaturdifferenz > 4 K berücksichtigen
    if (method === 'en' && el.boundary === 'beheizt' && !((ti - (el.thetaNb ?? ti)) > MIN_DT_NEIGHBOR)) f = 0;
    const dU = OPAQUE.has(el.type) && (method === 'en' || el.boundary !== 'beheizt') ? wb : 0;
    const u0 = el.ins > 0 ? uWithInsulation(el.U || 0, el.ins) : (el.U || 0);
    const uEff = u0 + dU;
    // Innenmaße → Außenmaße (Tab. B.10: vertikale Außenwand 1,25)
    const a = (el.area || 0) * (project.innenmasse && el.type === 'wand' && el.boundary === 'aussen' ? F_INT_EXT_WALL : 1);
    const phi = a * uEff * f * dT;
    if (el.boundary === 'beheizt') phiTIntern += phi; else phiT += phi;
    if (el.boundary === 'aussen' && EXPOSED.has(el.type) && a > 0) exposed = true;
    if (a > 0 && !(el.U > 0)) warnings.push(`Bauteil „${el.label || el.type}“ ohne U-Wert.`);
    return { f, uEff, phi, area: a };
  });
  if (!elements.some((e) => e.area > 0)) warnings.push('Keine Bauteile erfasst.');

  // Lüftung: V̇ = max(V̇_inf, V̇_min); Infiltration nur bei Außenbauteilen
  const n50 = project.n50 ?? 4;
  const e = project.shielding ?? 0.03;
  const eps = 1.0;
  const vInf = exposed ? 2 * volume * n50 * e * eps : 0;
  const nmin = room.nmin ?? 0.5;
  const vMin = nmin * volume;
  const vDot = method === 'en' ? N_SIMPLE * volume : Math.max(vInf, vMin);
  const phiV = RHO_CP * vDot * dT;

  const phiRH = project.rhMode === 'wm2' ? area * (project.fRH || 0) : 0;
  const phiHL = Math.max(0, phiT + phiTIntern) + phiV + phiRH;

  return {
    id: room.id, name: room.name, theta: ti, area, volume, elements,
    phiT, phiTIntern, vDot, vInf, vMin, phiV, phiRH,
    phiHL, specific: area > 0 ? phiHL / area : 0,
    // Beitrag zur Gebäudeheizlast (ohne Wärmeübertragung zwischen beheizten Räumen)
    phiBuilding: phiHL - phiTIntern,
    exposed, warnings,
  };
}

/** Gesamtes Projekt: Geschosse → Räume → Gebäude */
export function calcProject(project) {
  const floors = project.floors.map((fl) => {
    const rooms = fl.rooms.map((r) => calcRoom(r, project));
    return {
      id: fl.id, name: fl.name, rooms,
      area: sum(rooms, 'area'), phiHL: sum(rooms, 'phiHL'), phiBuilding: sum(rooms, 'phiBuilding'),
    };
  });
  const rooms = floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floorName: f.name })));
  const area = sum(floors, 'area');
  const phi = sum(floors, 'phiBuilding');
  return {
    floors, rooms,
    total: { area, volume: sum(rooms, 'volume'), phiHL: phi, specific: area > 0 ? phi / area : 0 },
  };
}

function sum(arr, key) { return arr.reduce((s, x) => s + (x[key] || 0), 0); }
