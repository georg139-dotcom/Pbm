import test from 'node:test';
import assert from 'node:assert/strict';
import { calcRoom, calcProject } from '../js/core/heatload.js';
import { radiatorPower, solveReturn, requiredFlowTemp, requiredQN, capacityFn, logMeanDT } from '../js/core/emitters.js';
import { calcHydraulics, pickSetting } from '../js/core/hydraulics.js';
import { heatPumpCheck, cop } from '../js/core/heatpump.js';
import { demoProject, newProject, newRoom, newElement } from '../js/core/model.js';
import { uWithInsulation, B15 } from '../js/core/catalog.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

function simpleProject() {
  const p = newProject();
  p.wb = 0; p.climate.thetaE = -10; p.heatMethod = 'ext';
  const r = newRoom('T', 'wohnen');
  r.area = 20; r.height = 2.5; r.theta = 20;
  r.elements = [
    { ...newElement('wand'), area: 10, U: 1.0 },
    { ...newElement('fenster'), area: 2, U: 2.0 },
    { ...newElement('boden'), area: 20, U: 1.0, boundary: 'erdreich' },
  ];
  p.floors[0].rooms = [r];
  return { p, r };
}

test('Heizlast (erweiterte Näherung): Transmission + Lüftung per Handrechnung', () => {
  const { p, r } = simpleProject();
  const res = calcRoom(r, p);
  // ΔT = 30 K; Wand 10·1·30 = 300; Fenster 2·2·30 = 120; Boden 20·1·0,45·30 = 270
  near(res.phiT, 690);
  // V = 50 m³; V_inf = 2·50·4·0,03 = 12; V_min = 25 → max = 25 → 0,34·25·30 = 255
  near(res.phiV, 255);
  near(res.phiHL, 945);
});

test('Wärmebrückenzuschlag nur auf opake Bauteile', () => {
  const { p, r } = simpleProject();
  p.wb = 0.1;
  const res = calcRoom(r, p);
  near(res.phiT, 10 * 1.1 * 30 + 2 * 2 * 30 + 20 * 1.1 * 0.45 * 30);
});

test('Beheizter Nachbarraum: Faktor aus Temperaturdifferenz, aus Gebäudeheizlast herausgerechnet', () => {
  const { p, r } = simpleProject();
  r.elements.push({ ...newElement('wand'), area: 10, U: 1.5, boundary: 'beheizt', thetaNb: 15 });
  const res = calcRoom(r, p);
  near(res.phiTIntern, 10 * 1.5 * 5); // ΔT 5 K
  near(res.phiBuilding, res.phiHL - res.phiTIntern);
});

test('Raum ohne Außenbauteil: keine Infiltration', () => {
  const { p, r } = simpleProject();
  r.elements = [{ ...newElement('wand'), area: 10, U: 1.0, boundary: 'unbeheizt' }];
  const res = calcRoom(r, p);
  assert.equal(res.vInf, 0);
});

test('Heizkörper: Normleistung bei 75/65/20 und Rücklauf-Inversion', () => {
  near(logMeanDT(75, 65, 20), 49.83, 0.01);
  near(radiatorPower(1000, 1.3, 75, 65, 20), 1000, 2);
  const cap = capacityFn({ kind: 'hk', QN: 1000, n: 1.3 }, 20);
  const s = solveReturn(cap, 600, 55, 20);
  assert.ok(s.ok);
  near(cap(55, s.tr), 600, 0.01);
  assert.equal(solveReturn(cap, 5000, 55, 20).ok, false);
});

test('Benötigte Vorlauftemperatur / Normleistung konsistent', () => {
  const cap = capacityFn({ kind: 'hk', QN: 1000, n: 1.3 }, 20);
  const tv = requiredFlowTemp(cap, 700, 10, 20);
  near(cap(tv, tv - 10), 700, 0.01);
  const qn = requiredQN(700, 1.3, tv, 10, 20);
  near(qn, 1000, 0.1);
});

test('Hydraulik: Energiebilanz Σ m·c·σ = Σ Φ, Ventil-Kv', () => {
  const p = demoProject();
  const load = calcProject(p);
  const h = calcHydraulics(p, load);
  const sumQ = h.rows.reduce((s, x) => s + 1.163 * x.mass * x.sigma, 0);
  near(sumQ, h.system.phi, 1);
  for (const x of h.rows) {
    assert.ok(x.tr < h.tv && x.tr > x.ti);
    near(x.kvReq, (x.mass / 1000) / Math.sqrt(x.dpValve / 1000), 1e-9);
    assert.ok(x.setting >= 1);
  }
  // Referenzraum erreicht tvReq ≈ θV (aufgerundet) → mind. ein Raum mit Spreizung ≈ Auslegungsspreizung
  assert.ok(h.tv >= h.system.tvMaxReq);
});

test('Hydraulik: unterdimensionierter Heizkörper wird markiert', () => {
  const p = demoProject();
  p.floors[0].rooms[0].radiators = [{ id: 'x', label: 'klein', QN: 100, n: 1.3 }];
  const h = calcHydraulics(p, calcProject(p), { tvMode: 'manual', tvManual: 55 });
  assert.ok(h.rows.some((x) => x.undersized));
});

test('pickSetting wählt nächstliegendes Kv', () => {
  const kv = [0.1, 0.2, 0.4];
  assert.equal(pickSetting(kv, 0.21).setting, 2);
  assert.equal(pickSetting(kv, 0.9).open, true);
});

test('Wärmepumpe: COP fällt mit steigender Vorlauftemperatur, JAZ plausibel', () => {
  assert.ok(cop(35, 2, 'luft') > cop(55, 2, 'luft'));
  assert.ok(cop(35, 2, 'sole') > cop(35, 2, 'luft'));
  const p = demoProject();
  const load = calcProject(p);
  const hp = heatPumpCheck(p, load, { dhwKWh: 2500 });
  assert.ok(hp.tvSys > 30 && hp.tvSys < 90);
  assert.ok(hp.energy.jaz > 1.5 && hp.energy.jaz < 6, `JAZ=${hp.energy.jaz}`);
  assert.ok(hp.energy.fullLoadHours > 1200 && hp.energy.fullLoadHours < 2600, `Vbh=${hp.energy.fullLoadHours}`);
  // niedrigere Vorlauftemperatur → höhere JAZ
  const p2 = demoProject();
  for (const f of p2.floors) for (const r of f.rooms) for (const k of r.radiators) k.QN *= 3;
  const hp2 = heatPumpCheck(p2, calcProject(p2));
  assert.ok(hp2.tvSys < hp.tvSys);
  assert.ok(hp2.energy.jazH > hp.energy.jazH);
});

test('Wärmepumpe: Heizstab bei zu kleiner Leistung', () => {
  const p = demoProject();
  const load = calcProject(p);
  const small = heatPumpCheck(p, load, { capNA: load.total.phiHL / 1000 * 0.5 });
  const big = heatPumpCheck(p, load, { capNA: load.total.phiHL / 1000 * 2 });
  assert.ok(small.energy.qRod > 0);
  assert.equal(big.energy.qRod, 0);
  assert.ok(small.energy.jazH < big.energy.jazH);
});

// ---- DIN EN 12831-1:2017, vereinfachtes Verfahren ----
test('EN 12831-1 vereinfacht: f_x aus Tab. B.11, n = 0,5 (Handrechnung)', () => {
  const { p, r } = simpleProject();
  p.heatMethod = 'en'; p.wb = 0;
  const res = calcRoom(r, p);
  // ΔT = 30 K; Wand 10·1·30 = 300; Fenster 2·2·30 = 120; Boden gg. Erdreich 20·1·0,3·30 = 180
  near(res.phiT, 600);
  // V = 50 m³; n = 0,5 → 25 m³/h → 0,34·25·30 = 255
  near(res.phiV, 255);
  near(res.phiHL, 855);
});

test('EN 12831-1: Wärmebrücke ΔU_TB nur auf opake Bauteile', () => {
  const { p, r } = simpleProject();
  p.heatMethod = 'en'; p.wb = 0.1;
  near(calcRoom(r, p).phiT, 10 * 1.1 * 30 + 2 * 2 * 30 + 20 * 1.1 * 0.3 * 30);
});

test('EN 12831-1: beheizter Nachbar nur bei Δθ > 4 K, f = 0,3', () => {
  const { p, r } = simpleProject();
  p.heatMethod = 'en'; p.wb = 0;
  r.elements = [{ ...newElement('wand'), area: 10, U: 1.5, boundary: 'beheizt', thetaNb: 15 }];
  near(calcRoom(r, p).phiTIntern, 10 * 1.5 * 0.3 * 30);
  r.elements[0].thetaNb = 17; // Δθ = 3 K → nicht berücksichtigt
  near(calcRoom(r, p).phiTIntern, 0);
});

test('EN 12831-1: Innenmaße → Außenwand × 1,25 (Tab. B.10)', () => {
  const { p, r } = simpleProject();
  p.heatMethod = 'en'; p.wb = 0; p.innenmasse = true;
  r.elements = [{ ...newElement('wand'), area: 10, U: 1.0 }, { ...newElement('boden'), area: 10, U: 1.0, boundary: 'erdreich' }];
  near(calcRoom(r, p).phiT, 10 * 1.25 * 30 + 10 * 0.3 * 30); // Boden bleibt × 1
});

test('Tab. B.16: Zusatzdämmung', () => {
  near(uWithInsulation(1.4, 12), 0.27);  // 1,0 < U ≤ 1,5
  near(uWithInsulation(3.0, 8), 0.53);   // U > 2,5
  near(uWithInsulation(0.45, 20), 0.14); // U ≤ 0,5
  near(uWithInsulation(1.4, 0), 1.4);
  const { p, r } = simpleProject();
  p.heatMethod = 'en'; p.wb = 0;
  r.elements = [{ ...newElement('wand'), area: 10, U: 1.4, ins: 12 }];
  near(calcRoom(r, p).phiT, 10 * 0.27 * 30);
});

test('TS Tab. 33: Werte der Baujahrklassen vollständig und plausibel', () => {
  for (const rows of Object.values(B15)) for (const [, vals] of rows) {
    assert.equal(vals.length, 8);
    assert.ok(vals.some((v) => v != null));
  }
  assert.equal(B15.wand[0][1][4], 1.0); // zweischalig 1969–78 (TS Tab. 33)
  assert.equal(B15.fenster[3][1][7], 1.9); // Kunststoff Isolierverglasung ab 1995
});

// ---- DIN EN 1264-2/-3: Fußbodenheizung ----
import { fbhKennlinie, spline } from '../js/core/fbh.js';

test('Spline reproduziert Stützstellen', () => {
  const f = spline([0, 1, 2, 3], [1, 4, 9, 16]);
  near(f(2), 9, 1e-9); near(f(0), 1, 1e-9);
});

test('EN 1264-2: K_H passt zur Basis-Kennlinie in Bild A.5 (T = 0,2 m, λE = 1)', () => {
  const base = { T: 0.2, D: 0.016, su: 0.045, lambdaE: 1.0 };
  // Rλ = 0: Kennlinie bei Δθ = 40 K ≈ 180 W/m² (K ≈ 4,5); Rλ = 0,10: ≈ 2,95
  near(fbhKennlinie({ ...base, Rlambda: 0 }).K, 4.53, 0.05);
  near(fbhKennlinie({ ...base, Rlambda: 0.10 }).K, 2.95, 0.05);
});

test('EN 1264-2: Handrechnung K_H (T = 0,15, Rλ = 0,10, λE = 1,2)', () => {
  const r = fbhKennlinie({ T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10 });
  near(r.aB, 0.5980, 0.001);
  near(r.K, 6.7 * r.aB * Math.pow(1.156, -1) * Math.pow(1.029, -1), 0.02);
});

test('EN 1264-2: Grenzkurve – Schnittpunkt liegt auf Kennlinie und Grenzkurve', () => {
  const r = fbhKennlinie({ T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10 }, 20);
  near(r.BG, 76.3, 0.1);            // Tab. A.4, T = 0,15, s_u/λ_E = 0,0375
  const qG = r.phi * r.BG * Math.pow(r.dThG / r.phi, r.nG);
  near(qG, r.K * r.dThG, 1e-6);
  assert.ok(r.qMax > 60 && r.qMax < 140, `qMax=${r.qMax}`);
});

test('EN 1264: größere Rohrteilung → geringere Leistung und geringeres q_max', () => {
  const k = (T) => fbhKennlinie({ T, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.05 });
  assert.ok(k(0.1).K > k(0.2).K && k(0.2).K > k(0.3).K);
  assert.ok(k(0.1).qMax > k(0.3).qMax);
});

test('Hydraulik: Fußbodenheizungsraum liefert q und Grenzkurve', () => {
  const p = demoProject();
  const r = p.floors[0].rooms[0];
  r.emitterKind = 'fbh'; r.fbh = { area: 30, T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10 };
  const h = calcHydraulics(p, calcProject(p), { tvMode: 'manual', tvManual: 45 });
  const x = h.rows.find((y) => y.em.kind === 'fbh');
  assert.ok(x && x.qMax > 0 && x.K > 0);
  near(x.q, x.phi / 30, 1e-9);
});

import { estimateFacade } from '../js/core/catalog.js';
test('TS Tab. 22/23: Flächenschätzung aus Raumfläche', () => {
  const r = estimateFacade('wohnen', 2, 20);
  near(r.AF, 0.22 * 20); near(r.AW, 1.26 * 20 - 0.22 * 20);
  near(estimateFacade('kueche', 1, 10).AW, 0.93 * 10 - 0.24 * 10);
  near(estimateFacade('bad', 5, 10).fW, 1.32); // > 2 Wände → Wert für 2
});

// ---- Rohrnetz & Heizkreise ----
import { pipeDp } from '../js/core/pipes.js';
import { defaultCircuits } from '../js/core/hydraulics.js';

test('Rohrdruckverlust: Cu 22×1 bei 1 m³/h ≈ 4,5 mbar/m (Handrechnung)', () => {
  const r = pipeDp(1000, 20, 1, 0, 0.0015);
  near(r.v, 0.8996, 0.01);
  near(r.R, 446, 15);                 // Pa/m
  near(r.dpMbar, 4.46, 0.15);
  near(pipeDp(1000, 20, 0, 4).dpMbar, 4 * 983 * 0.8996 ** 2 / 2 / 100, 0.1); // Einzelwiderstand
  assert.ok(pipeDp(500, 20, 10).dpMbar < pipeDp(1000, 20, 10).dpMbar);
  assert.ok(pipeDp(1000, 16, 10).dpMbar > pipeDp(1000, 20, 10).dpMbar);
});

test('Heizkreise: Mischerkreis mit niedrigerem Vorlauf, Kreis ohne Mischer läuft mit Erzeugervorlauf', () => {
  const p = demoProject();
  p.circuits = defaultCircuits();
  const wohn = p.floors[0].rooms[0];
  wohn.emitterKind = 'fbh'; wohn.fbh = { area: 30, T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10 };
  const h = calcHydraulics(p, calcProject(p));
  const hk = h.circuits.find((c) => c.kind === 'hk'), fb = h.circuits.find((c) => c.kind === 'fbh');
  assert.ok(fb.mixer && fb.tv < hk.tv, `FBH ${fb.tv} vs HK ${hk.tv}`);
  assert.equal(hk.tv, h.tv);
  // Primärstrom des Mischerkreises < Sekundärstrom
  assert.ok(fb.primary < fb.mass);
  // Energiebilanz je Zeile weiterhin erfüllt
  const sumQ = h.rows.reduce((s, x) => s + 1.163 * x.mass * x.sigma, 0);
  near(sumQ, h.system.phi, 1);
});

test('Rohrnetz: Anbindeleitung und Hauptleitung ersetzen die Pauschalen', () => {
  const p = demoProject(); p.circuits = defaultCircuits();
  const base = calcHydraulics(p, calcProject(p));
  p.floors[0].rooms[0].pipe = { d: 12, L: 20, zeta: 8, k: 0.007 };
  p.circuits[0].main = { d: 20, L: 40, zeta: 10, k: 0.0015 };
  const h = calcHydraulics(p, calcProject(p));
  const x = h.rows[0];
  assert.ok(x.pipe && x.pipe.dpMbar > 0);
  assert.ok(x.dpValve !== base.rows[0].dpValve);
  const c = h.circuits.find((k) => k.kind === 'hk');
  assert.ok(c.main && c.main.dpMbar > 0);
  near(c.dpMain, c.main.dpMbar, 1e-9);
});
