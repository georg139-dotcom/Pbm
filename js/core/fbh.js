// Fußbodenheizung, Rohre im Estrich (Typ A, C, H, I, J) nach DIN EN 1264-2:2021-08 (Abschn. 6.2, 6.5)
// und Auslegung nach DIN EN 1264-3:2021-08 (4.1). Tabellenwerte aus der Norm abgeschrieben –
// bitte stichprobenartig prüfen. Nicht abgebildet: Typ B/D, Randzonen, Wärmeverlust nach unten, T > 0,375 m.

export const FBH_DEFAULT = {
  area: 0, T: 0.15, D: 0.016, su: 0.045, lambdaE: 1.2, Rlambda: 0.10, lambdaR: 0.35, sR: 0.002,
};
const ALPHA = 10.8, LAMBDA_U0 = 1, SU0 = 0.045, B0 = 6.7, LAMBDA_R0 = 0.35, SR0 = 0.002;

// ---- natürliche kubische Spline-Interpolation (Norm: Anhang A, „Für alle Tabellen“) ----
export function spline(xs, ys) {
  const n = xs.length, h = [], a = [], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], d = [];
  for (let i = 0; i < n - 1; i++) h[i] = xs[i + 1] - xs[i];
  for (let i = 1; i < n - 1; i++) a[i] = 3 / h[i] * (ys[i + 1] - ys[i]) - 3 / h[i - 1] * (ys[i] - ys[i - 1]);
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i]; z[i] = (a[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  for (let j = n - 2; j >= 0; j--) {
    c[j] = (z[j] || 0) - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (x0) => {
    const x = Math.min(Math.max(x0, xs[0]), xs[n - 1]);
    let i = xs.findIndex((v, k) => k < n - 1 && x <= xs[k + 1]);
    if (i < 0) i = n - 2;
    const t = x - xs[i];
    return ys[i] + b[i] * t + c[i] * t * t + d[i] * t * t * t;
  };
}
/** Z[ix][iy] an Stützstellen xs × ys */
export function interp2(xs, ys, Z, x, y) {
  const col = ys.map((_, j) => spline(xs, Z.map((r) => r[j]))(x));
  return spline(ys, col)(y);
}

// ---- Tabellen ----
const RL = [0, 0.05, 0.10, 0.15];
const A1 = [1.23, 1.188, 1.156, 1.134];
const TT = [0.05, 0.075, 0.1, 0.15, 0.2, 0.225, 0.3, 0.375];
const A2 = [[1.069, 1.056, 1.043, 1.037], [1.066, 1.053, 1.041, 1.035], [1.063, 1.05, 1.039, 1.0335], [1.057, 1.046, 1.035, 1.0305],
  [1.051, 1.041, 1.0315, 1.0275], [1.048, 1.038, 1.0295, 1.026], [1.0395, 1.031, 1.024, 1.021], [1.03, 1.0221, 1.0181, 1.015]];
const A3 = [[1.013, 1.013, 1.012, 1.011], [1.021, 1.019, 1.016, 1.014], [1.029, 1.025, 1.022, 1.018], [1.04, 1.034, 1.029, 1.024],
  [1.046, 1.04, 1.035, 1.03], [1.049, 1.043, 1.038, 1.033], [1.053, 1.049, 1.044, 1.039], [1.056, 1.051, 1.046, 1.042]];
const SL = [0.01, 0.0208, 0.0292, 0.0375, 0.0458, 0.0542, 0.0625, 0.0708, 0.0792]; // s_u/λ_E
const A4 = [[85.0, 91.5, 96.8, 100, 100, 100, 100, 100, 100], [75.3, 83.5, 89.9, 96.3, 99.5, 100, 100, 100, 100],
  [66.0, 75.4, 82.9, 89.3, 95.5, 98.8, 100, 100, 100], [51.0, 61.1, 69.2, 76.3, 82.7, 87.5, 91.8, 95.1, 97.8],
  [38.5, 48.2, 56.2, 63.1, 69.1, 74.5, 81.3, 86.4, 90.0], [33.0, 42.5, 49.5, 56.5, 62, 67.5, 75.3, 81.6, 86.1],
  [20.5, 26.8, 31.6, 36.4, 41.5, 47.5, 57.5, 65.3, 72.4], [11.5, 13.7, 15.5, 18.2, 21.5, 27.5, 40.0, 49.1, 58.3]];
const T6 = [0.05, 0.075, 0.1, 0.15, 0.2, 0.225, 0.2625, 0.3, 0.3375, 0.375];
const A6 = [[0.008, 0.005, 0.002, 0, 0, 0, 0, 0, 0], [0.024, 0.021, 0.018, 0.011, 0.002, 0, 0, 0, 0],
  [0.046, 0.043, 0.041, 0.033, 0.014, 0.005, 0, 0, 0], [0.088, 0.085, 0.082, 0.076, 0.055, 0.038, 0.024, 0.014, 0.006],
  [0.131, 0.13, 0.129, 0.123, 0.105, 0.083, 0.057, 0.040, 0.028], [0.155, 0.154, 0.153, 0.146, 0.13, 0.11, 0.077, 0.056, 0.041],
  [0.197, 0.196, 0.196, 0.19, 0.173, 0.15, 0.110, 0.083, 0.062], [0.254, 0.253, 0.253, 0.245, 0.228, 0.195, 0.145, 0.114, 0.086],
  [0.322, 0.321, 0.321, 0.31, 0.293, 0.260, 0.187, 0.148, 0.115], [0.422, 0.421, 0.421, 0.405, 0.385, 0.325, 0.230, 0.183, 0.142]];
const SUT = [0.173, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75];
const A5 = [27.5, 40.0, 57.5, 69.5, 78.2, 84.4, 88.3, 91.6, 94.0, 96.3, 98.6, 99.8, 100];
const A7 = [0.320, 0.230, 0.145, 0.097, 0.067, 0.048, 0.033, 0.023, 0.015, 0.009, 0.005, 0.002, 0];

/** Grenzkurven-Koeffizienten B_G, n_G (Tab. A.4–A.7) */
export function limitCoefficients(T, su, lambdaE) {
  const r = su / lambdaE;
  if (r <= 0.0792) {
    return {
      BG: Math.min(100, interp2(TT, SL, A4, T, Math.max(r, SL[0]))),
      nG: Math.max(0, interp2(T6, SL, A6, T, Math.max(r, SL[0]))),
    };
  }
  const x = su / T;
  return { BG: Math.min(100, spline(SUT, A5)(x)), nG: Math.max(0, spline(SUT, A7)(x)) };
}

/**
 * Äquivalenter Wärmedurchgangskoeffizient K_H [W/m²K] nach Gl. (4)–(11), (26), Grenzkurve nach Gl. (19)–(21)
 * @returns {{K, aB, BG, nG, dThG, qMax, warnings}}
 */
export function fbhKennlinie(f0, ti = 20, bath = false) {
  const f = { ...FBH_DEFAULT, ...f0 };
  const { T, D, su, lambdaE, Rlambda: R } = f;
  const warnings = [];
  if (T < 0.05 || T > 0.375) warnings.push('Rohrteilung außerhalb 0,05–0,375 m (Gültigkeitsbereich EN 1264-2).');
  if (su < 0.01) warnings.push('Estrichüberdeckung < 0,01 m.');
  if (D < 0.008 || D > 0.03) warnings.push('Rohrdurchmesser außerhalb 0,008–0,030 m.');
  if (su / lambdaE < 0.01) warnings.push('s_u/λ_E < 0,01 m²K/W – außerhalb Gültigkeitsbereich.');
  if (R > 0.15) warnings.push('R_λ,B > 0,15 m²K/W – außerhalb der Tabellen; Werte werden begrenzt.');

  const Tc = Math.min(Math.max(T, 0.05), 0.375);
  const Rc = Math.min(Math.max(R, 0), 0.15);
  const aT = spline(RL, A1)(Rc);
  const au = interp2(TT, RL, A2, Tc, Rc);
  const aD = interp2(TT, RL, A3, Tc, Rc);
  const aB = (1 / ALPHA + SU0 / LAMBDA_U0) / (1 / ALPHA + SU0 / lambdaE + R);   // Gl. (9)
  const mT = 1 - Tc / 0.075;                                                      // Gl. (6)
  const mD = 250 * (D - 0.020);                                                   // Gl. (8)
  const prod = (suX) => aB * Math.pow(aT, mT) * Math.pow(au, 100 * (0.045 - suX)) * Math.pow(aD, mD); // Π a_i^m_i

  // Rohrwerkstoff/-wand (Gl. 26): B
  const pipe = (lR, sR, d) => (1 / (2 * lR)) * Math.log(d / (d - 2 * sR));
  const Bof = (suX) => 1 / (1 / B0 + (1.1 / Math.PI) * prod(suX) * Tc * (pipe(f.lambdaR, f.sR, D) - pipe(LAMBDA_R0, SR0, D)));
  const suStar = Tc <= 0.2 ? 0.1 : 0.5 * Tc;
  let K;
  if (su <= suStar) K = Bof(su) * prod(su);
  else {                                                                          // Gl. (11)
    const Kstar = Bof(suStar) * prod(suStar);
    K = 1 / (1 / Kstar + (su - suStar) / lambdaE);
  }

  const { BG, nG } = limitCoefficients(Tc, su, lambdaE);
  const dFmax = bath ? 9 : 29 - ti;                          // θ_F,max − θ_i (Bad: 9 K, 4.1.1.4)
  const phi = Math.pow(dFmax / 9, 1.1);                      // Gl. (20)
  const dThG = phi * Math.pow(BG / K, 1 / (1 - nG));         // Gl. (21)
  return { K, aB, aT, au, aD, BG, nG, phi, dThG, qMax: K * dThG, warnings };
}

/** Leistung einer Fußbodenheizung bei Vor-/Rücklauf (Gl. 1 und 5, n = 1) */
export function fbhPower(f, tv, tr, ti, logMean) {
  return (f.area || 0) * fbhKennlinie(f, ti).K * logMean(tv, tr, ti);
}
