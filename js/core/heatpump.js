// Wärmepumpencheck: benötigte Vorlauftemperatur, kritische Räume, Heizkurve, JAZ-Abschätzung.
// ACHTUNG: JAZ ist ein Carnot-basiertes Näherungsmodell, KEINE Berechnung nach VDI 4650.
import { capacityFn, requiredFlowTemp, requiredQN, logMeanDT, roomEmitters } from './emitters.js';
import { NORM_DT } from './catalog.js';

export const HP_DEFAULTS = {
  source: 'luft',        // luft | sole | wasser
  sigmaHp: 5,            // K Spreizung Wärmepumpe
  tvTarget: 55,          // °C Ziel-Vorlauftemperatur (max. akzeptiert)
  thetaHG: 15,           // °C Heizgrenze
  thetaM: 9.5,           // °C Jahresmitteltemperatur
  capNA: 0,              // kW Heizleistung der WP bei Normaußentemperatur (0 = unbegrenzt)
  dhwKWh: 0,             // kWh/a Warmwasser-Nutzenergie
  dhwTemp: 55,           // °C Vorlauf Warmwasserbereitung
  priceKWh: 0.30,        // €/kWh Strom
  consumptionKWh: 0,     // kWh/a Heizwärmebedarf aus Messung (0 = berechnet)
  n: 1.3,
};

const ETA = { luft: 0.48, sole: 0.58, wasser: 0.60 };
const SOURCE_TEMP = { sole: 3, wasser: 10 };

export function cop(tv, thetaE, source) {
  const tq = source === 'luft' ? thetaE : SOURCE_TEMP[source];
  const th = tv + 3 + 273.15, tc = tq - 5 + 273.15;
  let c = ETA[source] * th / (th - tc);
  if (source === 'luft' && thetaE > -3 && thetaE < 5) c *= 0.93; // Abtauverluste
  return Math.min(7, Math.max(1, c));
}

/** Verfahren: benötigte Vorlauftemperatur bei Auslegung: Bewertung je Raum */
export function verdictFor(tv) {
  if (tv <= 35) return { level: 'sehr gut', css: 'ok', text: 'Flächenheizungs-Niveau – sehr gute Voraussetzungen.' };
  if (tv <= 45) return { level: 'gut', css: 'ok', text: 'Niedertemperatur – gut geeignet.' };
  if (tv <= 55) return { level: 'bedingt', css: 'warn', text: 'Geeignet mit reduzierter Effizienz; Optimierung lohnt.' };
  if (tv <= 60) return { level: 'grenzwertig', css: 'warn', text: 'Mit wenigen Maßnahmen (einzelne Heizkörper tauschen) gut machbar.' };
  if (tv <= 70) return { level: 'kritisch', css: 'bad', text: 'Nur mit Maßnahmen (Heizkörpertausch / Dämmung) sinnvoll.' };
  return { level: 'ungeeignet', css: 'bad', text: 'Ohne umfangreiche Maßnahmen nicht geeignet.' };
}

export function heatPumpCheck(project, load, optsIn = {}) {
  const o = { ...HP_DEFAULTS, thetaM: project.climate.thetaM ?? HP_DEFAULTS.thetaM, ...optsIn };
  const te = project.climate.thetaE;
  const rows = [];
  for (const r of load.rooms) {
    const room = project.floors.flatMap((f) => f.rooms).find((x) => x.id === r.id);
    if (!room) continue;
    for (const em of roomEmitters(room, r.phiHL)) {
      const cap = capacityFn(em, r.theta);
      const tvReq = requiredFlowTemp(cap, em.phi, o.sigmaHp, r.theta);
      const row = { floor: r.floorName, room: r.name, label: em.label, kind: em.kind, ti: r.theta, phi: em.phi, tvReq };
      if (em.kind === 'hk') {
        row.QN = em.QN; row.n = em.n || 1.3;
        row.QNReq = requiredQN(em.phi, row.n, o.tvTarget, o.sigmaHp, r.theta);
        row.factor = row.QNReq / em.QN;
      }
      row.critical = tvReq > o.tvTarget;
      // Heizlastminderung, bei der die Heizfläche bei tvTarget ausreicht
      const capT = cap(o.tvTarget, o.tvTarget - o.sigmaHp);
      row.maxLoadAtTarget = capT;
      row.reductionNeeded = row.critical && em.phi > 0 ? 1 - capT / em.phi : 0;
      rows.push(row);
    }
  }
  const finite = rows.filter((x) => isFinite(x.tvReq));
  const tvSys = rows.length ? Math.max(...rows.map((x) => x.tvReq)) : null;
  const tvDesign = tvSys === null ? null : Math.max(25, Math.min(isFinite(tvSys) ? tvSys : 90, 90));
  const verdict = tvSys === null ? null : verdictFor(tvSys);
  const critical = rows.filter((x) => x.critical).sort((a, b) => b.tvReq - a.tvReq);
  const phiB = load.total.phiHL;

  // Heizkurve
  const tiRef = load.total.area > 0
    ? load.rooms.reduce((s, r) => s + r.theta * r.area, 0) / load.total.area : 20;
  const dTmN = tvDesign === null ? 0 : logMeanDT(tvDesign, tvDesign - o.sigmaHp, tiRef);
  const flowAt = (frac) => Math.max(25, tiRef + dTmN * Math.pow(frac, 1 / o.n) + o.sigmaHp * frac / 2);
  const fracAt = (t) => Math.max(0, (o.thetaHG - t) / (o.thetaHG - te));
  const curve = [te, -10, -5, 0, 5, 10, o.thetaHG].filter((t, i, a) => t >= te && t <= o.thetaHG && a.indexOf(t) === i)
    .sort((a, b) => a - b)
    .map((t) => ({ thetaE: t, load: phiB * fracAt(t), tv: flowAt(fracAt(t)), cop: cop(flowAt(fracAt(t)), t, o.source) }));

  // Jahressimulation mit 1-K-Klassen (Normalverteilung der Außentemperatur – Näherung)
  let qH = 0, wH = 0, qD = 0, wD = 0, qRod = 0, hoursHeat = 0;
  if (tvDesign !== null && phiB > 0) {
    const sd = 6.5, bins = [];
    let norm = 0;
    for (let t = Math.ceil(te); t <= 35; t++) {
      const w = Math.exp(-0.5 * ((t - o.thetaM) / sd) ** 2);
      bins.push({ t, w }); norm += w;
    }
    for (const b of bins) {
      const h = 8760 * b.w / norm;
      // Warmwasser: ganzjährig gleichmäßig
      if (o.dhwKWh > 0) { const e = o.dhwKWh * h / 8760; qD += e; wD += e / cop(o.dhwTemp, b.t, o.source); }
      if (b.t >= o.thetaHG) continue;
      const frac = fracAt(b.t);
      let q = phiB * frac / 1000 * h; // kWh
      hoursHeat += h;
      let rod = 0;
      if (o.capNA > 0) {
        const k = o.source === 'luft' ? 0.025 : 0.01;
        const capT = o.capNA * (1 + k * (b.t - te));
        const need = phiB * frac / 1000;
        if (need > capT) rod = (need - capT) * h;
      }
      qH += q; qRod += rod;
      const c = cop(flowAt(frac), b.t, o.source);
      wH += (q - rod) / c + rod;
    }
    if (o.consumptionKWh > 0 && qH > 0) { // auf gemessenen Bedarf kalibrieren
      const s = o.consumptionKWh / qH; qH *= s; wH *= s; qRod *= s;
    }
  }
  const qTot = qH + qD, wTot = wH + wD;
  const jaz = wTot > 0 ? qTot / wTot : null;
  const jazH = wH > 0 ? qH / wH : null;

  // Leistung bei Normaußentemperatur
  const capCheck = o.capNA > 0 ? { capNA: o.capNA, load: phiB / 1000, covered: o.capNA * 1000 >= phiB } : null;

  const rating = jaz === null ? null
    : jaz >= 4 ? { level: 'sehr gut', css: 'ok' } : jaz >= 3.2 ? { level: 'gut', css: 'ok' }
    : jaz >= 2.7 ? { level: 'bedingt', css: 'warn' } : { level: 'kritisch', css: 'bad' };

  return {
    opts: o, rows, critical, tvSys, tvDesign, verdict, curve, tiRef,
    energy: { qH, qD, qTot, wH, wD, wTot, qRod, jaz, jazH, fullLoadHours: phiB > 0 ? qH * 1000 / phiB : 0,
      cost: wTot * o.priceKWh },
    rating, capCheck, hoursHeat,
  };
}
