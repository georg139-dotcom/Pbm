import test from 'node:test';
import assert from 'node:assert/strict';
import { calcRoom, calcProject } from '../js/core/heatload.js';
import { radiatorPower, solveReturn, requiredFlowTemp, requiredQN, capacityFn, logMeanDT } from '../js/core/emitters.js';
import { calcHydraulics, pickSetting } from '../js/core/hydraulics.js';
import { heatPumpCheck, cop } from '../js/core/heatpump.js';
import { demoProject, newProject, newRoom, newElement } from '../js/core/model.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

function simpleProject() {
  const p = newProject();
  p.wb = 0; p.climate.thetaE = -10;
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

test('Heizlast: Transmission + Lüftung per Handrechnung', () => {
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
    near(x.kvReq, (x.mass / 1000) / Math.sqrt(h.system.dpValve / 1000), 1e-9);
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
