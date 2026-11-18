// Rohrleitungen: Druckverlust (Darcy-Weisbach, Swamee-Jain) für Wasser bei ca. 60 °C

export const WATER = { rho: 983, nu: 0.48e-6 };           // kg/m³, m²/s (≈ 60 °C)

/** Typische Innendurchmesser [mm] – Herstellerdaten prüfen; k = absolute Rauigkeit [mm] */
export const PIPE_PRESETS = [
  ['Cu 15×1', 13, 0.0015], ['Cu 18×1', 16, 0.0015], ['Cu 22×1', 20, 0.0015], ['Cu 28×1,5', 25, 0.0015],
  ['Cu 35×1,5', 32, 0.0015], ['Cu 42×1,5', 39, 0.0015], ['Cu 54×2', 50, 0.0015],
  ['Mehrschicht 16×2', 12, 0.007], ['Mehrschicht 20×2', 16, 0.007], ['Mehrschicht 26×3', 20, 0.007],
  ['Mehrschicht 32×3', 26, 0.007], ['Mehrschicht 40×3,5', 33, 0.007],
  ['Stahl DN 15', 16.1, 0.045], ['Stahl DN 20', 21.7, 0.045], ['Stahl DN 25', 27.3, 0.045],
  ['Stahl DN 32', 36.0, 0.045], ['Stahl DN 40', 41.9, 0.045], ['Stahl DN 50', 53.1, 0.045],
];

/** Rohrreibungszahl λ */
export function frictionFactor(Re, d, kMm = 0.0015) {
  if (Re < 1) return 0;
  if (Re < 2300) return 64 / Re;
  const k = kMm / 1000;
  const l = Math.log10(k / (3.7 * d) + 5.74 / Math.pow(Re, 0.9));
  return 0.25 / (l * l);
}

/**
 * Druckverlust einer Leitung
 * @param {number} massKgH Massenstrom [kg/h]; @param {number} dMm Innendurchmesser [mm]; @param {number} L Länge [m]
 * @param {number} zeta Summe der Einzelwiderstände; @param {number} kMm Rauigkeit [mm]
 * @returns {{dpMbar, v, R, Re}} v [m/s], R [Pa/m]
 */
export function pipeDp(massKgH, dMm, L, zeta = 0, kMm = 0.0015) {
  const d = dMm / 1000;
  if (!(d > 0) || !(massKgH > 0)) return { dpMbar: 0, v: 0, R: 0, Re: 0 };
  const q = massKgH / 3600 / WATER.rho;
  const v = q / (Math.PI * d * d / 4);
  const Re = v * d / WATER.nu;
  const lam = frictionFactor(Re, d, kMm);
  const dyn = WATER.rho * v * v / 2;
  const R = lam / d * dyn;
  return { dpMbar: ((L || 0) * R + (zeta || 0) * dyn) / 100, v, R, Re };
}
