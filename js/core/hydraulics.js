// Hydraulischer Abgleich nach Verfahren B – mit Heizkreisen (Mischer) und Rohrnetz
import { C_WATER, MBAR_PER_M, DEFAULT_VALVE_KV } from './catalog.js';
import { capacityFn, solveReturn, requiredFlowTemp, roomEmitters } from './emitters.js';
import { fbhKennlinie } from './fbh.js';
import { pipeDp } from './pipes.js';

export const HYD_DEFAULTS = {
  tvMode: 'auto',      // Erzeuger-Vorlauf: 'auto' (höchster Kreisbedarf) | 'manual'
  tvManual: 55,
  sigmaDesign: 10,     // K, Auslegungsspreizung Referenzraum Heizkörper
  sigmaFbh: 5,         // K, Auslegungsspreizung Fußbodenheizung (EN 1264-3: ≤ 5 K)
  dpBranch: 150,       // mbar am Anschluss Heizfläche (Anbindung + Heizkörper + Ventil)
  dpPipe: 30,          // mbar Pauschale Anbindeleitung (wenn keine Rohrdaten)
  dpEmitter: 5,        // mbar Heizkörper selbst
  dpMain: 100,         // mbar Pauschale Verteilnetz (wenn keine Rohrdaten am Kreis)
  dpGen: 50,           // mbar Wärmeerzeuger/Armaturen
  valveKv: DEFAULT_VALVE_KV,
  maxSigma: 25,
};

export const CIRCUIT_DEFAULTS = {
  name: 'Heizkreis', kind: 'hk', mixer: false, tvMode: 'auto', tvManual: 55,
  sigma: null, dpBranch: null, dpExtra: 0, main: { d: 0, L: 0, zeta: 0, k: 0.0015 },
};
export function defaultCircuits(uid = (() => { let i = 0; return () => `c${i++}`; })()) {
  return [
    { id: uid(), ...CIRCUIT_DEFAULTS, name: 'Heizkörperkreis', kind: 'hk' },
    { id: uid(), ...CIRCUIT_DEFAULTS, name: 'Fußbodenheizkreis', kind: 'fbh', mixer: true, dpExtra: 60 },
  ];
}

export function calcHydraulics(project, load, optsIn = {}) {
  const o = { ...HYD_DEFAULTS, ...optsIn };
  const circuits = (project.circuits?.length ? project.circuits : defaultCircuits()).map((c) => ({ ...CIRCUIT_DEFAULTS, ...c }));
  const warnings = [];
  const rows = [];
  const roomById = new Map(project.floors.flatMap((f) => f.rooms.map((r) => [r.id, r])));

  const circuitFor = (room, kind) =>
    circuits.find((c) => c.id === room.circuitId) || circuits.find((c) => c.kind === kind) || circuits[0];

  // 1) Heizflächen je Raum
  for (const r of load.rooms) {
    const room = roomById.get(r.id);
    if (!room) continue;
    const ems = roomEmitters(room, r.phiHL);
    if (r.phiHL > 0 && ems.length === 0) {
      warnings.push(`${r.floorName} / ${r.name}: Heizlast ${Math.round(r.phiHL)} W, aber keine Heizfläche erfasst.`);
    }
    for (const em of ems) {
      rows.push({ floor: r.floorName, room: r.name, ti: r.theta, em, phi: em.phi, roomPhi: r.phiHL, roomRef: room,
        circuit: circuitFor(room, em.kind) });
    }
  }
  if (!rows.length) return { rows, warnings, system: null, tv: null, circuits: [] };

  // 2) Vorlauftemperaturbedarf je Kreis
  for (const x of rows) {
    x.cap = capacityFn(x.em, x.ti);
    const sigmaC = x.circuit.sigma ?? (x.em.kind === 'fbh' ? o.sigmaFbh : o.sigmaDesign);
    x.tvReq = requiredFlowTemp(x.cap, x.phi, sigmaC, x.ti);
  }
  const used = circuits.filter((c) => rows.some((x) => x.circuit === c || x.circuit.id === c.id));
  for (const c of used) {
    const cr = rows.filter((x) => x.circuit.id === c.id);
    const hk = cr.filter((x) => x.em.kind === 'hk');
    const basis = hk.length ? hk : cr;
    const mx = Math.max(...basis.map((x) => x.tvReq));
    c.tvReq = mx;
    c.refRoom = (() => { const r = basis.find((x) => x.tvReq === mx); return r ? `${r.floor} / ${r.room}` : '-'; })();
    c.tvOwn = c.tvMode === 'manual' ? c.tvManual : (isFinite(mx) ? Math.ceil(mx) : 90);
    if (!isFinite(mx)) warnings.push(`${c.name}: Mindestens eine Heizfläche deckt die Heizlast auch bei 150 °C nicht.`);
  }
  const tvMaxReq = Math.max(...used.map((c) => c.tvReq));
  const tvGen = o.tvMode === 'manual' ? o.tvManual : Math.max(...used.map((c) => c.tvOwn));
  for (const c of used) {
    c.tv = c.mixer ? Math.min(c.tvOwn, tvGen) : tvGen;     // ohne Mischer läuft der Kreis mit Erzeugervorlauf
    if (c.mixer && c.tvOwn > tvGen) warnings.push(`${c.name}: Bedarf ${c.tvOwn} °C liegt über dem Erzeugervorlauf ${tvGen} °C.`);
    if (!c.mixer && c.kind === 'fbh' && tvGen > 45) {
      warnings.push(`${c.name}: Fußbodenheizung ohne Mischer läuft mit ${tvGen} °C – Mischerkreis vorsehen.`);
    }
  }

  // 3) Rücklauf, Massenstrom, Ventil je Heizfläche
  for (const x of rows) {
    const c = used.find((u) => u.id === x.circuit.id);
    x.circuitName = c.name; x.tv = c.tv;
    const s = solveReturn(x.cap, x.phi, x.tv, x.ti);
    let sigma = x.tv - s.tr;
    x.undersized = !s.ok;
    if (!s.ok) sigma = 3;
    sigma = Math.min(Math.max(sigma, 1), o.maxSigma);
    x.sigma = sigma; x.tr = x.tv - sigma;
    x.mass = x.phi / (C_WATER * sigma);
    x.vol = x.mass / 1000;

    // Anbindeleitung der Heizfläche
    const pp = x.roomRef.pipe;
    x.pipe = pp && pp.d > 0 && pp.L > 0 ? pipeDp(x.mass, pp.d, pp.L, pp.zeta, pp.k) : null;
    const dpPipe = x.pipe ? x.pipe.dpMbar : o.dpPipe;
    const dpBranch = c.dpBranch ?? o.dpBranch;
    x.dpValve = Math.max(5, dpBranch - dpPipe - (x.em.kind === 'fbh' ? 0 : o.dpEmitter));
    x.kvReq = x.vol / Math.sqrt(x.dpValve / 1000);
    const sel = pickSetting(o.valveKv, x.kvReq);
    Object.assign(x, sel);
    x.flowActual = sel.kvSet * Math.sqrt(x.dpValve / 1000) * 1000;
    x.flowDev = x.mass > 0 ? (x.flowActual - x.mass) / x.mass : 0;
    x.flags = [];
    if (x.undersized) x.flags.push('Heizfläche zu klein bei θV');
    if (x.em.kind !== 'fbh' && sel.open) x.flags.push('Ventil voll offen, Kv reicht nicht');
    if (x.em.kind !== 'fbh' && Math.abs(x.flowDev) > 0.4 && !sel.open) x.flags.push('Stufung grob (>40 % Abweichung)');
    if (x.pipe && x.pipe.v > 1.0) x.flags.push(`Anbindung v = ${x.pipe.v.toFixed(2)} m/s (> 1)`);
    if (x.em.kind === 'fbh') {
      const kl = fbhKennlinie(x.em, x.ti, x.ti >= 24);
      x.q = x.phi / x.em.area; x.qMax = kl.qMax; x.K = kl.K;
      if (x.q > kl.qMax) x.flags.push('q über Grenzkurve (EN 1264)');
      kl.warnings.forEach((w) => x.flags.push(w));
    }
  }

  // 4) Kreise und Erzeuger
  const circ = used.map((c) => {
    const cr = rows.filter((x) => x.circuit.id === c.id);
    const mass = cr.reduce((s, x) => s + x.mass, 0);
    const phi = cr.reduce((s, x) => s + x.phi, 0);
    const sigma = mass > 0 ? phi / (C_WATER * mass) : 0;
    const trC = c.tv - sigma;
    const m = c.main || {};
    const main = m.d > 0 && m.L > 0 ? pipeDp(mass, m.d, m.L, m.zeta, m.k) : null;
    const dpMain = main ? main.dpMbar : o.dpMain;
    const dpBranch = c.dpBranch ?? o.dpBranch;
    const dpTotal = dpBranch + dpMain + (c.dpExtra || 0) + (c.mixer ? 0 : o.dpGen);
    // Primärstrom bei Mischerkreis (ideale Beimischung)
    const primary = c.mixer && tvGen > trC ? mass * (c.tv - trC) / (tvGen - trC) : mass;
    const flags = [];
    if (main && main.v > 1.0) flags.push(`Hauptleitung v = ${main.v.toFixed(2)} m/s (> 1)`);
    return {
      id: c.id, name: c.name, kind: c.kind, mixer: c.mixer, tv: c.tv, tvReq: c.tvReq, refRoom: c.refRoom,
      phi, mass, volFlow: mass / 1000, sigma, tr: trC, primary, dpBranch, dpMain, dpExtra: c.dpExtra || 0, main,
      head: dpTotal / MBAR_PER_M, headMbar: dpTotal, flags, rooms: cr.length,
    };
  });
  const phi = rows.reduce((s, x) => s + x.phi, 0);
  const massSec = rows.reduce((s, x) => s + x.mass, 0);
  const massPri = circ.reduce((s, c) => s + c.primary, 0);
  const sigmaSys = massPri > 0 ? phi / (C_WATER * massPri) : 0;
  const ref = circ.slice().sort((a, b) => b.tvReq - a.tvReq)[0];
  const system = {
    tv: tvGen, tvMaxReq, refRoom: ref ? `${ref.refRoom} (${ref.name})` : '-',
    phi, mass: massPri, massSecondary: massSec, volFlow: massPri / 1000, sigma: sigmaSys, tr: tvGen - sigmaSys,
    circuits: circ,
    pumpHead: circ.length ? Math.max(...circ.map((c) => c.head)) : 0,
    pumpHeadMbar: circ.length ? Math.max(...circ.map((c) => c.headMbar)) : 0,
    dpValve: rows.length ? Math.min(...rows.map((x) => x.dpValve)) : 0,
  };
  system.pumpHydraulicW = (massPri / 3600) * 9.81 * system.pumpHead;
  return { rows, warnings, system, tv: tvGen, circuits: circ, opts: o };
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
