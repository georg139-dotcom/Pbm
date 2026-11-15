// Hydraulischer Abgleich nach Verfahren B (raumweise Heizlast, Heizflächenauslegung, Ventilvoreinstellung, Pumpe)
import { C_WATER, MBAR_PER_M, DEFAULT_VALVE_KV } from './catalog.js';
import { capacityFn, solveReturn, requiredFlowTemp, roomEmitters } from './emitters.js';

export const HYD_DEFAULTS = {
  tvMode: 'auto',      // 'auto' | 'manual'
  tvManual: 55,
  sigmaDesign: 10,     // K, Auslegungsspreizung für Referenzraum (Heizkörper)
  sigmaFbh: 5,         // K, Auslegungsspreizung Fußbodenheizung
  dpBranch: 150,       // mbar am Anschluss Heizkörper+Ventil+Anbindung
  dpPipe: 30,          // mbar Anbindeleitungen je Heizfläche
  dpEmitter: 5,        // mbar Heizkörper selbst
  dpMain: 100,         // mbar Verteil-/Steigleitungen (ungünstigster Weg)
  dpGen: 50,           // mbar Wärmeerzeuger/Armaturen
  valveKv: DEFAULT_VALVE_KV,
  maxSigma: 25,
};

export function calcHydraulics(project, load, optsIn = {}) {
  const o = { ...HYD_DEFAULTS, ...optsIn };
  const warnings = [];
  const rows = [];

  // 1) Heizflächen je Raum mit Heizlast
  for (const r of load.rooms) {
    const room = findRoom(project, r.id);
    if (!room) continue;
    const ems = roomEmitters(room, r.phiHL);
    if (r.phiHL > 0 && ems.length === 0) {
      warnings.push(`${r.floorName} / ${r.name}: Heizlast ${Math.round(r.phiHL)} W, aber keine Heizfläche erfasst.`);
    }
    for (const em of ems) rows.push({ floor: r.floorName, room: r.name, ti: r.theta, em, phi: em.phi, roomPhi: r.phiHL });
  }
  if (!rows.length) return { rows, warnings, system: null, tv: null };

  // 2) Systemvorlauftemperatur: Raum mit dem höchsten Bedarf bestimmt θV
  for (const x of rows) {
    const cap = capacityFn(x.em, x.ti);
    const sigma = x.em.kind === 'fbh' ? o.sigmaFbh : o.sigmaDesign;
    x.cap = cap;
    x.tvReq = requiredFlowTemp(cap, x.phi, sigma, x.ti);
  }
  const hkRows = rows.filter((x) => x.em.kind === 'hk');
  const basis = hkRows.length ? hkRows : rows;
  const tvMaxReq = Math.max(...basis.map((x) => x.tvReq));
  let tv = o.tvMode === 'manual' ? o.tvManual : Math.ceil(tvMaxReq);
  if (!isFinite(tv)) { tv = 90; warnings.push('Mindestens eine Heizfläche kann die Heizlast auch bei 150 °C nicht decken.'); }
  const refRow = basis.find((x) => x.tvReq === Math.max(...basis.map((y) => y.tvReq)));
  if (hkRows.length && rows.some((x) => x.em.kind === 'fbh') && tv > 45) {
    warnings.push('Gemischte Anlage (Heizkörper + Fußbodenheizung): Fußbodenheizung braucht einen eigenen Mischerkreis.');
  }

  // 3) Rücklauf, Massenstrom, Ventil
  const dpValve = Math.max(5, o.dpBranch - o.dpPipe - o.dpEmitter);
  for (const x of rows) {
    const s = solveReturn(x.cap, x.phi, tv, x.ti);
    let sigma = tv - s.tr;
    x.ok = s.ok;
    x.undersized = !s.ok;
    if (!s.ok) sigma = 3; // bei zu kleiner Fläche: auf Mindestspreizung auslegen
    sigma = Math.min(Math.max(sigma, 1), o.maxSigma);
    x.sigma = sigma;
    x.tr = tv - sigma;
    x.mass = x.phi / (C_WATER * sigma);       // kg/h ≈ l/h
    x.vol = x.mass / 1000;                    // m³/h
    x.kvReq = x.vol / Math.sqrt(dpValve / 1000);
    x.dpValve = dpValve;
    const sel = pickSetting(o.valveKv, x.kvReq);
    Object.assign(x, sel);
    x.flowActual = sel.kvSet * Math.sqrt(dpValve / 1000) * 1000; // l/h
    x.flowDev = x.mass > 0 ? (x.flowActual - x.mass) / x.mass : 0;
    x.flags = [];
    if (x.undersized) x.flags.push('Heizfläche zu klein bei θV');
    if (sel.open) x.flags.push('Ventil voll offen, Kv reicht nicht');
    if (Math.abs(x.flowDev) > 0.4 && !sel.open) x.flags.push('Stufung grob (>40 % Abweichung)');
    if (x.em.kind === 'fbh') {
      const qmax = 10.8 * (29 - x.ti);
      if (x.phi / x.em.area > qmax) x.flags.push('Oberflächentemperatur > 29 °C');
    }
  }

  // 4) System & Pumpe
  const mass = rows.reduce((s, x) => s + x.mass, 0);
  const phi = rows.reduce((s, x) => s + x.phi, 0);
  const sigmaSys = mass > 0 ? phi / (C_WATER * mass) : 0;
  const head = (o.dpBranch + o.dpMain + o.dpGen) / MBAR_PER_M;
  const system = {
    tv, tvMaxReq, refRoom: refRow ? `${refRow.floor} / ${refRow.room}` : '-',
    phi, mass, volFlow: mass / 1000, sigma: sigmaSys, tr: tv - sigmaSys,
    pumpHead: head, pumpHeadMbar: o.dpBranch + o.dpMain + o.dpGen, dpValve,
    pumpHydraulicW: (mass / 1000) * head * 9.81 * 1000 / 3600 * 1, // m³/h·m → W hydraulisch (ρ·g·Q·H)
  };
  system.pumpHydraulicW = (mass / 3600) * 9.81 * head; // kg/s · g · m
  return { rows, warnings, system, tv, opts: o };
}

/** Wählt die Voreinstellung, deren Kv dem Soll am nächsten liegt (logarithmisch) */
export function pickSetting(kvList, kvReq) {
  const max = kvList[kvList.length - 1];
  if (kvReq >= max) return { setting: kvList.length, kvSet: max, open: kvReq > max * 1.1 };
  let best = 0, bestD = Infinity;
  kvList.forEach((k, i) => {
    const d = Math.abs(Math.log(k / Math.max(kvReq, 1e-6)));
    if (d < bestD) { bestD = d; best = i; }
  });
  return { setting: best + 1, kvSet: kvList[best], open: false };
}

function findRoom(project, id) {
  for (const f of project.floors) for (const r of f.rooms) if (r.id === id) return r;
  return null;
}
