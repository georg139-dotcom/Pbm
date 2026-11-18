// Datenmodell: Projekt → Geschosse → Räume → Bauteile / Heizflächen
import { ROOM_TYPES } from './catalog.js';
import { defaultCircuits } from './hydraulics.js';

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function newRoom(name = 'Neuer Raum', type = 'wohnen') {
  const t = ROOM_TYPES[type];
  return {
    id: uid(), name, type, area: 15, height: 2.5, theta: t.theta, nmin: t.nmin,
    circuitId: null, pipe: { d: 0, L: 0, zeta: 0, k: 0.0015 },
    elements: [], emitterKind: 'hk', radiators: [{ id: uid(), label: 'Heizkörper 1', QN: 1000, n: 1.3 }],
    fbh: { area: 0, T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10 },
  };
}
export function newFloor(name = 'Neues Geschoss') { return { id: uid(), name, rooms: [] }; }
export function newElement(type = 'wand') {
  return { id: uid(), type, label: '', area: 0, U: 0, ins: 0, boundary: type === 'boden' ? 'erdreich' : 'aussen', f: null, thetaNb: 20 };
}

export function newProject() {
  return {
    name: 'Neues Projekt', client: '', address: '', date: new Date().toISOString().slice(0, 10),
    climate: { city: 'Berlin', thetaE: -14, thetaM: 9.5 },
    heatMethod: 'en', innenmasse: false, baujahr: 4,
    n50: 4, shielding: 0.03, wb: 0.10, rhMode: 'none', fRH: 0,
    floors: [newFloor('Erdgeschoss')],
    circuits: defaultCircuits(uid),
    hyd: {}, hp: {},
  };
}

/** Beispielprojekt: Einfamilienhaus Baujahr ~1975, teilsaniert */
export function demoProject() {
  const el = (type, label, area, U, boundary = 'aussen', extra = {}) =>
    ({ ...newElement(type), label, area, U, boundary, ...extra });
  const rad = (label, QN) => ({ id: uid(), label, QN, n: 1.3 });
  const room = (name, type, area, h, elements, radiators, extra = {}) => ({
    ...newRoom(name, type), area, height: h, elements, radiators, ...extra,
  });
  const p = newProject();
  p.name = 'Beispiel EFH 1975';
  p.client = 'Mustermann'; p.address = 'Musterstraße 1, 10115 Berlin';
  p.floors = [
    { id: uid(), name: 'Erdgeschoss', rooms: [
      room('Wohnen/Essen', 'wohnen', 32, 2.5, [
        el('wand', 'Außenwand Süd/West', 24, 1.0), el('fenster', 'Fenster 2-fach', 7, 2.8),
        el('boden', 'Boden auf Erdreich', 32, 0.9, 'erdreich'),
      ], [rad('HK Fenster 1', 2400), rad('HK Fenster 2', 2000)]),
      room('Küche', 'kueche', 12, 2.5, [
        el('wand', 'Außenwand Nord', 8.5, 1.0), el('fenster', 'Fenster', 2.2, 2.8),
        el('boden', 'Boden auf Erdreich', 12, 0.9, 'erdreich'),
      ], [rad('HK Küche', 1600)]),
      room('Flur / Diele', 'flur', 10, 2.5, [
        el('tuer', 'Haustür', 2.2, 1.8), el('wand', 'Außenwand', 6, 1.0),
        el('boden', 'Boden auf Erdreich', 10, 0.9, 'erdreich'),
      ], [rad('HK Flur', 1400)]),
      room('WC', 'wc', 3, 2.5, [
        el('wand', 'Außenwand', 5, 1.0), el('fenster', 'Fenster klein', 0.5, 2.8),
        el('boden', 'Boden auf Erdreich', 3, 0.9, 'erdreich'),
      ], [rad('HK WC', 700)]),
    ] },
    { id: uid(), name: 'Obergeschoss', rooms: [
      room('Schlafzimmer', 'schlafen', 16, 2.5, [
        el('wand', 'Außenwand', 13, 1.0), el('fenster', 'Fenster', 3.0, 2.8),
        el('dach', 'Schräge, 8 cm gedämmt', 10, 0.5),
      ], [rad('HK Schlafzimmer', 2000)]),
      room('Kinderzimmer', 'kind', 14, 2.5, [
        el('wand', 'Außenwand', 11, 1.0), el('fenster', 'Fenster', 2.5, 2.8),
        el('dach', 'Schräge, 8 cm gedämmt', 9, 0.5),
      ], [rad('HK Kind', 1700)]),
      room('Bad', 'bad', 9, 2.5, [
        el('wand', 'Außenwand', 7, 1.0), el('fenster', 'Fenster', 1.2, 2.8),
        el('dach', 'Schräge, 8 cm gedämmt', 6, 0.5),
      ], [rad('Bad-Heizkörper', 1300)]),
      room('Flur OG', 'flur', 8, 2.5, [
        el('decke', 'Decke unter Dachraum (unbeheizt)', 8, 1.0, 'unbeheizt'),
      ], [rad('HK Flur OG', 900)]),
    ] },
  ];
  p.circuits[0].main = { d: 25, L: 30, zeta: 12, k: 0.0015 };
  p.floors.forEach((f) => f.rooms.forEach((r) => { r.pipe = { d: 13, L: 10, zeta: 6, k: 0.0015 }; }));
  return p;
}
