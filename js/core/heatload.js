// Vereinfachte raumweise Heizlastberechnung in Anlehnung an DIN/TS 12831-1:2020-04.
// Kein zertifizierter Normnachweis – siehe README (Annahmen & Grenzen).
import { RHO_CP, BOUNDARY } from './catalog.js';

const OPAQUE = new Set(['wand', 'dach', 'decke', 'boden']);
const EXPOSED = new Set(['wand', 'fenster', 'tuer', 'dach']);

/** Temperaturkorrekturfaktor f eines Bauteils */
export function elementFactor(el, ti, te) {
  const dT = ti - te;
  switch (el.boundary) {
    case 'aussen': return 1;
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
  const wb = project.wb ?? 0.10;
  const warnings = [];

  const area = room.area || 0;
  const height = room.height || 0;
  const volume = area * height;
  if (area <= 0) warnings.push('Raumfläche fehlt.');
  if (height <= 0) warnings.push('Raumhöhe fehlt.');
  if (dT <= 0) warnings.push('Innentemperatur ≤ Normaußentemperatur.');

  let phiT = 0, phiTIntern = 0, exposed = false;
  const elements = (room.elements || []).map((el) => {
    const f = elementFactor(el, ti, te);
    const dU = OPAQUE.has(el.type) && el.boundary !== 'beheizt' ? wb : 0;
    const uEff = (el.U || 0) + dU;
    const a = el.area || 0;
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
  const vDot = Math.max(vInf, vMin);
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
