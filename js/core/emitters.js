// Heizflächen: Leistung in Abhängigkeit von Vor-/Rücklauf- und Raumtemperatur
import { NORM_DT } from './catalog.js';
import { fbhKennlinie } from './fbh.js';

/** logarithmische mittlere Heizmittel-Übertemperatur */
export function logMeanDT(tv, tr, ti) {
  const a = tv - ti, b = tr - ti;
  if (a <= 0 || b <= 0) return 0;
  if (Math.abs(a - b) < 1e-9) return a;
  return (a - b) / Math.log(a / b);
}

export function radiatorPower(QN, n, tv, tr, ti) {
  return QN * Math.pow(logMeanDT(tv, tr, ti) / NORM_DT, n);
}

/** Leistungsfunktion (tv, tr) → W eines Heizflächen-Elements */
export function capacityFn(emitter, ti) {
  if (emitter.kind === 'fbh') {
    const K = fbhKennlinie(emitter, ti).K; // EN 1264-2
    return (tv, tr) => (emitter.area || 0) * K * logMeanDT(tv, tr, ti);
  }
  return (tv, tr) => radiatorPower(emitter.QN, emitter.n || 1.3, tv, tr, ti);
}

/** Rücklauftemperatur, bei der die Heizfläche bei Vorlauf tv genau phi abgibt. ok=false: Fläche zu klein */
export function solveReturn(cap, phi, tv, ti) {
  const max = cap(tv, tv);
  if (phi > max) return { tr: tv, ok: false, max };
  let lo = ti + 1e-3, hi = tv;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (cap(tv, mid) < phi) lo = mid; else hi = mid;
  }
  return { tr: (lo + hi) / 2, ok: true, max };
}

/** Benötigte Vorlauftemperatur bei fester Spreizung sigma */
export function requiredFlowTemp(cap, phi, sigma, ti) {
  if (phi <= 0) return ti + sigma;
  let lo = ti + sigma + 0.01, hi = 150;
  if (cap(hi, hi - sigma) < phi) return Infinity;
  if (cap(lo, lo - sigma) >= phi) return lo;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (cap(mid, mid - sigma) < phi) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Neue Normleistung, die bei tv/sigma phi deckt */
export function requiredQN(phi, n, tv, sigma, ti) {
  const dTm = logMeanDT(tv, tv - sigma, ti);
  return dTm > 0 ? phi / Math.pow(dTm / NORM_DT, n) : Infinity;
}

/** Heizflächen eines Raums als einheitliche Liste; Raumheizlast wird nach Leistung aufgeteilt */
export function roomEmitters(room, phiRoom) {
  if (room.emitterKind === 'fbh' && room.fbh && room.fbh.area > 0) {
    return [{ kind: 'fbh', label: 'Fußbodenheizung', phi: phiRoom, ...room.fbh }];
  }
  const rads = (room.radiators || []).filter((r) => r.QN > 0);
  const total = rads.reduce((s, r) => s + r.QN, 0);
  return rads.map((r) => ({ kind: 'hk', label: r.label || 'Heizkörper', ...r, phi: total > 0 ? phiRoom * r.QN / total : 0 }));
}
