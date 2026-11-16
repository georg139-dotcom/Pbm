import { ROOM_TYPES, BOUNDARY, ELEMENT_TYPES, U_PRESETS, CLIMATE_PRESETS, DEFAULT_VALVE_KV, B15, BAUJAHR_KLASSEN, B16_THICKNESS, FX_EN } from '../core/catalog.js';
import { calcProject } from '../core/heatload.js';
import { calcHydraulics, HYD_DEFAULTS } from '../core/hydraulics.js';
import { heatPumpCheck, HP_DEFAULTS } from '../core/heatpump.js';
import { fbhKennlinie, FBH_DEFAULT } from '../core/fbh.js';
import { estimateFacade } from '../core/catalog.js';
import { newProject, demoProject, newFloor, newRoom, newElement, uid } from '../core/model.js';

const KEY = 'pbm-heizlast-v1';
const TABS = [['projekt', '1 Projekt'], ['gebaeude', '2 Gebäude'], ['heizlast', '3 Heizlast'],
  ['hydraulik', '4 Hydr. Abgleich'], ['wp', '5 Wärmepumpen-Check'], ['bericht', '6 Bericht']];

let state = load() || demoProject();
let ui = { tab: 'gebaeude', fi: 0, ri: 0 };
let calc, hyd, hp;

// ---------- Hilfen ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const F = [nf(0), nf(1), nf(2), nf(3)];
const fmt = (v, d = 0) => (v === null || v === undefined || !isFinite(v)) ? '–' : F[d].format(v);

function load() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* privater Modus */ } }

function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, p, v) {
  const ks = p.split('.'); const last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v;
}
const hydOpts = () => {
  const h = { ...HYD_DEFAULTS, ...state.hyd };
  const kv = String(state.hyd?.valveKvText ?? DEFAULT_VALVE_KV.join(', ')).split(/[;, ]+/)
    .map((x) => parseFloat(x.replace(',', '.'))).filter((x) => x > 0).sort((a, b) => a - b);
  h.valveKv = kv.length ? kv : DEFAULT_VALVE_KV;
  return h;
};
const hpOpts = () => ({ ...HP_DEFAULTS, thetaM: state.climate.thetaM, ...state.hp });

function recompute() {
  state.hyd ??= {}; state.hp ??= {};
  for (const f of state.floors) for (const r of f.rooms) if (r.fbh && r.fbh.T === undefined) r.fbh = { ...FBH_DEFAULT, area: r.fbh.area || 0, T: r.fbh.VA || FBH_DEFAULT.T, Rlambda: r.fbh.Rlambda ?? FBH_DEFAULT.Rlambda };
  state.heatMethod ??= 'en'; state.baujahr ??= 4; state.innenmasse ??= false;
  calc = calcProject(state);
  hyd = calcHydraulics(state, calc, hydOpts());
  hp = heatPumpCheck(state, calc, hpOpts());
}

const curRoom = () => state.floors[ui.fi]?.rooms[ui.ri];

/** U-Wert-Vorlagen: zuerst Tab. B.15 (EN 12831-1) für die gewählte Baujahrklasse, dann allgemeine Vorlagen */
function presetsFor(type) {
  const bj = state.baujahr ?? 4;
  const b15 = (B15[type] || []).filter(([, v]) => v[bj] != null)
    .map(([l, v]) => [`TS Tab. 33, ${BAUJAHR_KLASSEN[bj]}: ${l}`, v[bj]]);
  return [...b15, ...(U_PRESETS[type] || [])];
}

// Eingabefeld-Helfer
const inp = (path, label, { type = 'number', step = 'any', cls = '', rr = false, act = '', min } = {}) => {
  const v = getPath(state, path);
  return `<label class="f ${cls}">${label}<input data-b="${path}" data-t="${type === 'number' ? 'n' : 's'}" type="${type}"${type === 'number' ? ` step="${step}"` : ''}${min !== undefined ? ` min="${min}"` : ''} value="${esc(v ?? '')}"${rr ? ' data-rr' : ''}${act ? ` data-act-in="${act}"` : ''}></label>`;
};
const sel = (path, label, options, { rr = false, act = '', num = false } = {}) => {
  const v = getPath(state, path) ?? '';
  return `<label class="f">${label}<select data-b="${path}" data-t="${num ? 'n' : 's'}"${rr ? ' data-rr' : ''}${act ? ` data-act-in="${act}"` : ''}>${options.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
};
const optInp = (ns, key, label, def, extra = {}) => {
  const v = (state[ns] ?? {})[key] ?? def;
  return `<label class="f">${label}<input data-b="${ns}.${key}" data-t="${extra.type === 'text' ? 's' : 'n'}" type="${extra.type || 'number'}" step="any" value="${esc(v)}"></label>`;
};
const optSel = (ns, key, label, def, options) => {
  const v = (state[ns] ?? {})[key] ?? def;
  return `<label class="f">${label}<select data-b="${ns}.${key}" data-t="s">${options.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
};

// ---------- Rendering ----------
function render() {
  recompute();
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-act="tab" data-v="${k}" class="${ui.tab === k ? 'on' : ''}">${l}</button>`).join('');
  $('#view').innerHTML = ({ projekt: vProjekt, gebaeude: vGebaeude, heizlast: vHeizlast, hydraulik: vHydraulik, wp: vWP, bericht: vBericht })[ui.tab]();
  renderKpi();
  if (ui.tab === 'gebaeude') updateLive();
}

function renderKpi() {
  const t = calc.total;
  const items = [
    [fmt(t.phiHL / 1000, 2) + ' kW', 'Gebäudeheizlast'], [fmt(t.specific, 0) + ' W/m²', 'spezifisch'],
    [fmt(t.area, 1) + ' m²', 'beheizte Fläche'], [fmt(state.climate.thetaE, 0) + ' °C', 'Normaußentemp.'],
    [hyd.system ? fmt(hyd.system.tv, 0) + ' °C' : '–', 'Vorlauf Abgleich'],
    [hp.tvSys ? fmt(hp.tvSys, 0) + ' °C' : '–', `Vorlauf WP-Check (σ ${hp.opts.sigmaHp} K)`],
    [hp.energy.jaz ? fmt(hp.energy.jaz, 2) : '–', 'JAZ (Näherung)'],
  ];
  $('#kpi').innerHTML = items.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
}

function vProjekt() {
  const c = state.climate;
  return `<div class="card"><h2>Projektdaten</h2><div class="grid">
    ${inp('name', 'Projektbezeichnung', { type: 'text' })}${inp('client', 'Auftraggeber', { type: 'text' })}
    ${inp('address', 'Objektadresse', { type: 'text' })}${inp('date', 'Datum', { type: 'date' })}</div></div>
  <div class="card"><h2>Klima</h2><div class="grid">
    ${sel('climate.city', 'Ort (Richtwert)', [...CLIMATE_PRESETS.map((p) => [p.name, p.name]), ['custom', 'Benutzerdefiniert']], { act: 'city', rr: true })}
    ${inp('climate.thetaE', 'Normaußentemperatur θe [°C]')}${inp('climate.thetaM', 'Jahresmitteltemperatur [°C]')}</div>
    <p class="mute">Die hinterlegten Ortswerte sind Richtwerte. Bitte θe für den Standort aus der Normtabelle (PLZ-Tabelle im elektronischen Anhang der DIN/TS 12831-1) prüfen und ggf. manuell überschreiben.</p></div>
  <div class="card"><h2>Berechnungsverfahren</h2><div class="grid">
    ${sel('heatMethod', 'Verfahren', [['en', 'DIN EN 12831-1:2017, vereinfacht (Abschn. 7)'], ['ext', 'Erweiterte Näherung (n50, Temperaturdifferenz)']], { rr: true })}
    ${sel('baujahr', 'Baujahrklasse (U-Wert-Vorlagen, TS Tab. 33)', BAUJAHR_KLASSEN.map((k, i) => [i, k]), { num: true })}
    ${sel('innenmasse', 'Bauteilflächen eingegeben als', [['false', 'Außenmaße'], ['true', 'Innenmaße (Außenwand × 1,25, TS Tab. 21)']])}
    ${sel('wb', 'Wärmebrücken ΔU_TB [W/m²K]', [[0, '0 (Detailnachweis)'], [0.05, '0,05'], [0.10, '0,10 (pauschal, TS 5.3)']], { num: true })}
    ${sel('rhMode', 'Aufheizzuschlag', [['none', 'keiner (Dauerbetrieb)'], ['wm2', 'flächenbezogen']], { rr: true })}
    ${state.rhMode === 'wm2' ? inp('fRH', 'f_RH [W/m²]') : ''}
    ${state.heatMethod === 'ext' ? inp('n50', 'Luftdichtheit n50 [1/h]') + sel('shielding', 'Abschirmung e', [[0.02, 'gering (0,02)'], [0.03, 'mäßig (0,03)'], [0.04, 'hoch (0,04)']], { num: true }) : ''}</div>
    <p class="mute">${state.heatMethod === 'ext'
      ? 'Erweiterte Näherung: Erdreich f = 0,45, beheizte Nachbarn nach tatsächlicher Temperaturdifferenz, Infiltration über n50 – keine Normvorgabe.'
      : `Vereinfachtes Verfahren nach DIN EN 12831-1:2017: f<sub>x</sub> Außenluft 1,0 · unbeheizt ${FX_EN.unbeheizt} · Erdreich ${FX_EN.erdreich} · beheizter Nachbar ${FX_EN.beheizt} (nur bei Δθ &gt; 4 K) · Luftwechsel n = 0,5 h⁻¹ · ΔU<sub>TB</sub> 0,10.`}</p></div>`;
}

function vGebaeude() {
  const fl = state.floors[ui.fi]; const r = curRoom();
  const tree = state.floors.map((f, i) => `<div class="fl"><span>${esc(f.name)}</span>
      <span class="row"><button class="small" data-act="addRoom" data-i="${i}" title="Raum hinzufügen">+ Raum</button></span></div>
      ${f.rooms.map((rm, j) => `<div class="rm ${i === ui.fi && j === ui.ri ? 'on' : ''}" data-act="selRoom" data-i="${i}" data-j="${j}"><span>${esc(rm.name)}</span><span>${fmt(calc.floors[i].rooms[j]?.phiHL)} W</span></div>`).join('')}`).join('');
  return `<div class="layout"><aside class="card tree"><h3>Geschosse &amp; Räume</h3>${tree}
    <p><button data-act="addFloor">+ Geschoss</button></p></aside>
    <section>${fl ? floorEditor(fl) : ''}${r ? roomEditor(r) : '<div class="card">Kein Raum gewählt – links einen Raum anlegen.</div>'}</section></div>`;
}

function floorEditor(fl) {
  return `<div class="card"><div class="row"><div style="flex:1">${inp(`floors.${ui.fi}.name`, 'Geschossname', { type: 'text' })}</div>
    <button class="danger noprint" data-act="delFloor">Geschoss löschen</button></div></div>`;
}

function roomEditor(r) {
  const b = `floors.${ui.fi}.rooms.${ui.ri}`;
  const res = calc.floors[ui.fi].rooms[ui.ri];
  const els = r.elements.map((el, i) => {
    const eb = `${b}.elements.${i}`;
    const presets = presetsFor(el.type);
    const extra = el.boundary === 'beheizt' ? `<input data-b="${eb}.thetaNb" data-t="n" type="number" step="any" value="${el.thetaNb}" title="Temperatur Nachbarraum [°C]" style="max-width:90px">`
      : (el.boundary === 'erdreich' || el.boundary === 'unbeheizt') ? `<input data-b="${eb}.f" data-t="nn" type="number" step="0.05" placeholder="f ${BOUNDARY[el.boundary].f}" value="${el.f ?? ''}" title="Reduktionsfaktor f (leer = Standard ${BOUNDARY[el.boundary].f})" style="max-width:90px">` : '';
    return `<tr><td><select data-b="${eb}.type" data-t="s" data-rr>${Object.entries(ELEMENT_TYPES).map(([k, l]) => `<option value="${k}"${k === el.type ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input data-b="${eb}.label" data-t="s" value="${esc(el.label)}" placeholder="Bezeichnung"></td>
      <td><select data-act-in="preset" data-i="${i}"><option value="">Vorlage…</option>${presets.map(([l, u], k) => `<option value="${k}">${esc(l)} (${u})</option>`).join('')}</select></td>
      <td><input data-b="${eb}.area" data-t="n" type="number" step="any" value="${el.area}" style="max-width:80px"></td>
      <td><input data-b="${eb}.U" data-t="n" type="number" step="0.01" value="${el.U}" style="max-width:80px"></td>
      <td><select data-b="${eb}.ins" data-t="n" title="Nachträgliche Dämmung (Tab. B.16)"><option value="0">–</option>${B16_THICKNESS.map((c) => `<option value="${c}"${el.ins === c ? ' selected' : ''}>+${c} cm</option>`).join('')}</select></td>
      <td><select data-b="${eb}.boundary" data-t="s" data-rr>${Object.entries(BOUNDARY).map(([k, v]) => `<option value="${k}"${k === el.boundary ? ' selected' : ''}>${v.label}</option>`).join('')}</select></td>
      <td>${extra}</td><td class="n" data-live="el.${i}"></td>
      <td><button class="small danger" data-act="delEl" data-i="${i}" title="Bauteil löschen">✕</button></td></tr>`;
  }).join('');
  const addBtns = Object.entries(ELEMENT_TYPES).map(([k, l]) => `<button class="small" data-act="addEl" data-v="${k}">+ ${l}</button>`).join(' ');

  const heat = r.emitterKind === 'fbh'
    ? `<div class="grid">${inp(`${b}.fbh.area`, 'Heizfläche A_F [m²]')}${inp(`${b}.fbh.T`, 'Rohrteilung T [m]')}${inp(`${b}.fbh.D`, 'Rohraußendurchmesser D [m]')}
      ${inp(`${b}.fbh.su`, 'Estrichüberdeckung s_u [m]')}${inp(`${b}.fbh.lambdaE`, 'λ Estrich [W/mK] (Zement/Anhydrit 1,2)')}${inp(`${b}.fbh.Rlambda`, 'Bodenbelag R_λ,B [m²K/W]')}</div>
      <p class="mute">Berechnung nach DIN EN 1264-2 (Rohre im Estrich, Typ A/C/H/I/J) und -3. Randzonen, Typ B/D und Wärmeverlust nach unten sind nicht berücksichtigt.</p>`
    : `<table><thead><tr><th>Bezeichnung</th><th class="n">Normleistung 75/65/20 [W]</th><th class="n">Exponent n</th><th></th></tr></thead><tbody>
      ${r.radiators.map((k, i) => `<tr><td><input data-b="${b}.radiators.${i}.label" data-t="s" value="${esc(k.label)}"></td>
        <td><input data-b="${b}.radiators.${i}.QN" data-t="n" type="number" value="${k.QN}"></td>
        <td><input data-b="${b}.radiators.${i}.n" data-t="n" type="number" step="0.01" value="${k.n}"></td>
        <td><button class="small danger" data-act="delRad" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table>
      <p><button class="small" data-act="addRad">+ Heizkörper</button></p>`;

  return `<div class="card"><div class="row"><h2 style="flex:1">Raum</h2>
      <button class="noprint small" data-act="dupRoom">Duplizieren</button><button class="danger small noprint" data-act="delRoom">Raum löschen</button></div>
    <div class="grid">${inp(`${b}.name`, 'Raumname', { type: 'text', act: 'name' })}
      ${sel(`${b}.type`, 'Raumtyp', Object.entries(ROOM_TYPES).map(([k, v]) => [k, v.label]), { act: 'roomType' })}
      ${inp(`${b}.area`, 'Fläche [m²]')}${inp(`${b}.height`, 'lichte Höhe [m]')}
      ${inp(`${b}.theta`, 'Normheiztemperatur θi [°C]')}${inp(`${b}.nmin`, 'Mindestluftwechsel n_min [1/h]')}</div></div>
    <div class="card"><h2>Bauteile (Flächen netto, Fenster/Türen separat abziehen)</h2><div class="tw"><table>
      <thead><tr><th>Art</th><th>Bezeichnung</th><th>U-Vorlage</th><th class="n">Fläche m²</th><th class="n">U W/m²K</th><th>Zusatzdämmung</th><th>Grenzt an</th><th>f / θ</th><th class="n">Φ_T [W]</th><th></th></tr></thead>
      <tbody>${els || '<tr><td colspan="10" class="mute">Noch keine Bauteile.</td></tr>'}</tbody></table></div>
      <p class="noprint">${addBtns} <button class="small" data-act="estimate" title="Außenwand- und Fensterfläche aus der Raumfläche schätzen (DIN/TS 12831-1, Tab. 22/23)">Außenflächen schätzen</button></p></div>
    <div class="card"><h2>Heizflächen</h2><div class="grid" style="max-width:260px">${sel(`${b}.emitterKind`, 'Art', [['hk', 'Heizkörper'], ['fbh', 'Fußbodenheizung']], { rr: true })}</div>${heat}</div>
    <div class="card" data-live="room">${roomSummary(res, r)}</div>`;
}

function fbhInfo(r, res) {
  if (!r || r.emitterKind !== 'fbh' || !(r.fbh?.area > 0) || !res) return '';
  const k = fbhKennlinie(r.fbh, r.theta, r.theta >= 24);
  const q = res.phiHL / r.fbh.area;
  return `<div class="msg ${q > k.qMax ? 'bad' : 'ok'}">Fußbodenheizung (EN 1264): K_H = ${fmt(k.K, 2)} W/m²K · q_Auslegung = ${fmt(q, 1)} W/m² · q_max (Grenzkurve) = ${fmt(k.qMax, 1)} W/m² · Δθ_H,G = ${fmt(k.dThG, 1)} K · benötigte Übertemperatur ${fmt(q / k.K, 1)} K</div>${k.warnings.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('')}`;
}
function roomSummary(res, r) {
  if (!res) return '';
  return `<h2>Ergebnis Raum</h2><div class="row" style="gap:24px">
    <div><b>${fmt(res.phiHL)} W</b><br><span class="mute">Heizlast Φ_HL (${fmt(res.specific, 0)} W/m²)</span></div>
    <div>${fmt(res.phiT + res.phiTIntern)} W<br><span class="mute">Transmission Φ_T</span></div>
    <div>${fmt(res.phiV)} W<br><span class="mute">Lüftung Φ_V (V̇ ${fmt(res.vDot, 1)} m³/h)</span></div>
    <div>${fmt(res.phiRH)} W<br><span class="mute">Aufheizen</span></div></div>
    ${fbhInfo(r, res)}${res.warnings.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('')}`;
}

function updateLive() {
  const r = curRoom(); const res = calc.floors[ui.fi]?.rooms[ui.ri];
  document.querySelectorAll('[data-live^="el."]').forEach((td) => {
    const i = +td.dataset.live.slice(3); td.textContent = fmt(res?.elements[i]?.phi);
  });
  const box = document.querySelector('[data-live="room"]'); if (box && r) box.innerHTML = roomSummary(res, r);
  document.querySelectorAll('.tree .rm').forEach((d) => {
    const i = +d.dataset.i, j = +d.dataset.j; const rr = calc.floors[i]?.rooms[j];
    if (rr) d.lastElementChild.textContent = `${fmt(rr.phiHL)} W`;
  });
  renderKpi();
}

// ----- Ergebnisansichten -----
function heatloadHtml() {
  const maxPhi = Math.max(1, ...calc.rooms.map((r) => r.phiHL));
  const rows = calc.floors.map((f) => `<tr class="sub"><td colspan="9">${esc(f.name)}</td></tr>` + f.rooms.map((r) => `<tr>
    <td>${esc(r.name)}</td><td class="n">${fmt(r.area, 1)}</td><td class="n">${fmt(r.theta, 0)}</td>
    <td class="n">${fmt(r.phiT + r.phiTIntern)}</td><td class="n">${fmt(r.phiV)}</td><td class="n">${fmt(r.phiRH)}</td>
    <td class="n"><b>${fmt(r.phiHL)}</b></td><td class="n">${fmt(r.specific, 0)}</td>
    <td style="width:120px"><div class="bar" style="width:${(r.phiHL / maxPhi * 100).toFixed(0)}%"></div></td></tr>`).join('')
    + `<tr class="sub"><td>Summe ${esc(f.name)}</td><td class="n">${fmt(f.area, 1)}</td><td></td><td></td><td></td><td></td><td class="n">${fmt(f.phiHL)}</td><td></td><td></td></tr>`).join('');
  const t = calc.total;
  const warns = calc.rooms.flatMap((r) => r.warnings.map((w) => `${r.floorName} / ${r.name}: ${w}`));
  return `<div class="tw"><table><thead><tr><th>Raum</th><th class="n">Fläche m²</th><th class="n">θi °C</th><th class="n">Φ_T W</th><th class="n">Φ_V W</th><th class="n">Φ_RH W</th><th class="n">Φ_HL W</th><th class="n">W/m²</th><th></th></tr></thead>
    <tbody>${rows}<tr class="tot"><td>Gebäude (ohne Wärmeübertragung zwischen beheizten Räumen)</td><td class="n">${fmt(t.area, 1)}</td><td></td><td></td><td></td><td></td><td class="n">${fmt(t.phiHL)}</td><td class="n">${fmt(t.specific, 0)}</td><td></td></tr></tbody></table></div>
    ${warns.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('')}`;
}
function vHeizlast() {
  return `<div class="card"><h2>Heizlast nach Räumen (θe = ${fmt(state.climate.thetaE, 0)} °C)</h2>${heatloadHtml()}
    <p class="mute">${state.heatMethod === 'ext' ? 'Erweiterte Näherung (n50-Infiltration, f<sub>Erdreich</sub> 0,45).' : 'Vereinfachtes Verfahren DIN EN 12831-1:2017, Abschn. 7: Φ_T = Σ A·(U+ΔU_TB)·f_x·Δθ, Φ_V = V·0,5·0,34·Δθ.'}</p></div>`;
}

function hydHtml() {
  if (!hyd.system) return '<div class="msg warn">Keine Heizflächen mit Heizlast erfasst.</div>';
  const s = hyd.system;
  const rows = hyd.rows.map((x) => `<tr class="${x.flags.length ? 'flag' : ''}">
    <td>${esc(x.floor)}</td><td>${esc(x.room)}</td><td>${esc(x.em.label)}</td><td class="n">${fmt(x.phi)}</td>
    <td class="n">${x.em.kind === 'hk' ? fmt(x.em.QN) : fmt(x.em.area, 1) + ' m²'}</td>
    <td class="n">${fmt(s.tv, 0)}</td><td class="n">${fmt(x.tr, 1)}</td><td class="n">${fmt(x.sigma, 1)}</td>
    <td class="n"><b>${fmt(x.mass, 0)}</b></td><td class="n">${fmt(x.kvReq, 3)}</td>
    <td class="n"><b>${x.em.kind === 'fbh' ? fmt(x.mass / 60, 2) + ' l/min' : (x.open ? 'offen' : x.setting)}</b></td>
    <td class="n">${x.em.kind === 'fbh' ? '' : fmt(x.kvSet, 2)}</td>
    <td>${x.flags.map((f) => `<span class="badge warn">${esc(f)}</span>`).join(' ')}</td></tr>`).join('');
  return `<div class="row" style="gap:24px;margin-bottom:8px">
    <div><b>${fmt(s.tv, 0)} °C</b><br><span class="mute">Systemvorlauf (Referenzraum: ${esc(s.refRoom)}, Bedarf ${fmt(s.tvMaxReq, 1)} °C)</span></div>
    <div><b>${fmt(s.volFlow, 3)} m³/h</b><br><span class="mute">Gesamtvolumenstrom</span></div>
    <div><b>${fmt(s.sigma, 1)} K</b><br><span class="mute">mittlere Spreizung (Rücklauf ${fmt(s.tr, 1)} °C)</span></div>
    <div><b>${fmt(s.pumpHead, 2)} m (${fmt(s.pumpHeadMbar, 0)} mbar)</b><br><span class="mute">Pumpen-Förderhöhe bei ${fmt(s.volFlow, 2)} m³/h</span></div>
    <div><b>${fmt(s.dpValve, 0)} mbar</b><br><span class="mute">Differenzdruck Ventil</span></div></div>
    ${hyd.warnings.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('')}
    <div class="tw"><table><thead><tr><th>Geschoss</th><th>Raum</th><th>Heizfläche</th><th class="n">Φ W</th><th class="n">Q_N / Fläche</th><th class="n">θV °C</th><th class="n">θR °C</th><th class="n">σ K</th><th class="n">m l/h</th><th class="n">Kv soll</th><th class="n">Voreinst.</th><th class="n">Kv ist</th><th>Hinweis</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function vHydraulik() {
  return `<div class="card noprint"><h2>Eingaben Verfahren B</h2><div class="grid">
    ${optSel('hyd', 'tvMode', 'Vorlauftemperatur', 'auto', [['auto', 'automatisch (Referenzraum)'], ['manual', 'manuell']])}
    ${optInp('hyd', 'tvManual', 'θV manuell [°C]', 55)}
    ${optInp('hyd', 'sigmaDesign', 'Auslegungsspreizung HK [K]', 10)}
    ${optInp('hyd', 'sigmaFbh', 'Auslegungsspreizung FBH [K]', 5)}
    ${optInp('hyd', 'dpBranch', 'Δp Anschluss Strang [mbar]', 150)}
    ${optInp('hyd', 'dpPipe', 'Δp Anbindeleitung [mbar]', 30)}
    ${optInp('hyd', 'dpEmitter', 'Δp Heizkörper [mbar]', 5)}
    ${optInp('hyd', 'dpMain', 'Δp Verteilnetz [mbar]', 100)}
    ${optInp('hyd', 'dpGen', 'Δp Wärmeerzeuger [mbar]', 50)}
    ${optInp('hyd', 'maxSigma', 'max. Spreizung [K]', 25)}</div>
    <label class="f" style="margin-top:10px">Kv-Werte der Ventil-Voreinstellungen (aufsteigend, Herstellerdaten eintragen)
    <input data-b="hyd.valveKvText" data-t="s" value="${esc(state.hyd?.valveKvText ?? DEFAULT_VALVE_KV.join(', '))}"></label></div>
    <div class="card"><div class="row"><h2 style="flex:1">Einstellwerte Heizkörperventile &amp; Pumpe</h2>
    <button class="noprint" data-act="csv">Einstellprotokoll als CSV</button></div><div id="out">${hydHtml()}</div>
    <p class="mute">Verfahren B: Raumheizlast → Heizflächenleistung bei gemeinsamer Vorlauftemperatur → Rücklauf/Massenstrom je Heizfläche → Kv = V̇/√Δp → nächstliegende Voreinstellung. Druckverluste sind pauschale Annahmen; bei Bedarf Rohrnetz berechnen.</p></div>`;
}

function hpHtml() {
  const o = hp.opts;
  if (hp.tvSys === null) return '<div class="msg warn">Keine Heizflächen erfasst.</div>';
  const v = hp.verdict, e = hp.energy;
  const maxTv = Math.max(...hp.rows.filter((x) => isFinite(x.tvReq)).map((x) => x.tvReq), 1);
  const rows = [...hp.rows].sort((a, b) => b.tvReq - a.tvReq).map((x) => `<tr>
    <td>${esc(x.floor)} / ${esc(x.room)}</td><td>${esc(x.label)}</td><td class="n">${fmt(x.phi)}</td>
    <td class="n"><b>${fmt(x.tvReq, 1)}</b></td><td style="width:110px"><div class="bar" style="width:${(Math.min(x.tvReq, maxTv) / maxTv * 100).toFixed(0)}%"></div></td>
    <td class="n">${x.kind === 'hk' ? fmt(x.QN) : '–'}</td><td class="n">${x.critical && x.kind === 'hk' ? fmt(x.QNReq) + ' (×' + fmt(x.factor, 2) + ')' : '–'}</td>
    <td>${x.critical ? '<span class="badge bad">über Ziel</span>' : '<span class="badge ok">ok</span>'}</td></tr>`).join('');
  const curve = hp.curve.map((c) => `<tr><td class="n">${fmt(c.thetaE, 0)}</td><td class="n">${fmt(c.load / 1000, 2)}</td><td class="n">${fmt(c.tv, 1)}</td><td class="n">${fmt(c.cop, 2)}</td></tr>`).join('');
  return `<div class="two"><div>
    <div class="msg ${v.css}"><b>Erforderliche Vorlauftemperatur ${fmt(hp.tvSys, 1)} °C (σ ${o.sigmaHp} K): ${v.level}</b><br>${v.text}</div>
    ${hp.rating ? `<div class="msg ${hp.rating.css}"><b>JAZ ≈ ${fmt(e.jaz, 2)} (${hp.rating.level})</b> – Heizen ${fmt(e.jazH, 2)}${e.qD ? `, inkl. Warmwasser` : ''}<br>
      Heizwärme ${fmt(e.qH, 0)} kWh/a · Vollbenutzungsstunden ${fmt(e.fullLoadHours, 0)} h · Strom ${fmt(e.wTot, 0)} kWh/a ≈ ${fmt(e.cost, 0)} €/a${e.qRod > 0 ? `<br>Heizstab-Anteil ${fmt(e.qRod, 0)} kWh/a` : ''}</div>` : ''}
    ${hp.capCheck ? `<div class="msg ${hp.capCheck.covered ? 'ok' : 'warn'}">WP-Leistung bei θe: ${fmt(hp.capCheck.capNA, 1)} kW vs. Heizlast ${fmt(hp.capCheck.load, 1)} kW – ${hp.capCheck.covered ? 'gedeckt' : 'Heizstab/Bivalenz nötig'}</div>` : ''}
    <h3>Heizkurve (Näherung)</h3><table><thead><tr><th class="n">θe °C</th><th class="n">Last kW</th><th class="n">θV °C</th><th class="n">COP</th></tr></thead><tbody>${curve}</tbody></table></div>
    <div><h3>Kritische Räume bei Ziel-Vorlauf ${fmt(o.tvTarget, 0)} °C: ${hp.critical.length}</h3>
    ${hp.critical.length ? `<ul>${hp.critical.slice(0, 8).map((x) => `<li>${esc(x.room)} (${esc(x.label)}): benötigt ${fmt(x.tvReq, 0)} °C${x.kind === 'hk' ? ` → Heizkörper auf ≈ ${fmt(x.QNReq)} W Normleistung (×${fmt(x.factor, 1)}) <i>oder</i> Heizlast um ${fmt(x.reductionNeeded * 100, 0)} % senken` : ''}</li>`).join('')}</ul>` : '<p class="mute">Alle Heizflächen reichen bei Ziel-Vorlauf aus.</p>'}</div></div>
    <h3>Ranking Heizflächen nach benötigter Vorlauftemperatur</h3><div class="tw"><table><thead><tr><th>Raum</th><th>Heizfläche</th><th class="n">Φ W</th><th class="n">θV nötig °C</th><th></th><th class="n">Q_N ist</th><th class="n">Q_N nötig @ Ziel</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function vWP() {
  return `<div class="card noprint"><h2>Annahmen Wärmepumpe</h2><div class="grid">
    ${optSel('hp', 'source', 'Wärmequelle', 'luft', [['luft', 'Luft/Wasser'], ['sole', 'Sole/Wasser'], ['wasser', 'Wasser/Wasser']])}
    ${optInp('hp', 'sigmaHp', 'Spreizung WP [K]', 5)}${optInp('hp', 'tvTarget', 'Ziel-Vorlauftemp. [°C]', 55)}
    ${optInp('hp', 'thetaHG', 'Heizgrenze [°C]', 15)}${optInp('hp', 'capNA', 'WP-Heizleistung bei θe [kW] (0 = ohne Prüfung)', 0)}
    ${optInp('hp', 'dhwKWh', 'Warmwasser-Nutzenergie [kWh/a]', 0)}${optInp('hp', 'dhwTemp', 'Warmwasser-Temp. [°C]', 55)}
    ${optInp('hp', 'consumptionKWh', 'gemessener Heizwärmebedarf [kWh/a] (0 = rechnen)', 0)}${optInp('hp', 'priceKWh', 'Strompreis [€/kWh]', 0.30)}</div></div>
    <div class="card"><h2>Wärmepumpencheck</h2><div id="out">${hpHtml()}</div>
    <p class="mute">Die JAZ wird mit einem Carnot-basierten Gütegradmodell und einer genäherten Temperaturhäufigkeit geschätzt – <b>keine Berechnung nach VDI 4650</b>. Zur Orientierung und Maßnahmenpriorisierung, nicht als Nachweis.</p></div>`;
}

function vBericht() {
  const t = calc.total;
  return `<div class="card noprint"><div class="row"><h2 style="flex:1">Bericht</h2><button class="primary" data-act="print">Drucken / als PDF speichern</button></div>
    <p class="mute">Die Seite wird beim Drucken ohne Bedienelemente ausgegeben.</p></div>
    <div class="card"><h2>${esc(state.name)}</h2><p>${esc(state.client)} · ${esc(state.address)} · ${esc(state.date)}</p>
      <p>Normaußentemperatur ${fmt(state.climate.thetaE, 0)} °C (${esc(state.climate.city)}) · n50 ${state.n50} · ΔU_WB ${state.wb} W/m²K ·
      Gebäudeheizlast <b>${fmt(t.phiHL / 1000, 2)} kW</b> auf ${fmt(t.area, 1)} m² (${fmt(t.specific, 0)} W/m²)</p></div>
    <div class="card"><h2>Heizlast</h2>${heatloadHtml()}</div>
    <div class="card"><h2>Hydraulischer Abgleich – Verfahren B</h2>${hydHtml()}</div>
    <div class="card"><h2>Wärmepumpencheck</h2>${hpHtml()}</div>
    <div class="card"><h3>Rechenannahmen &amp; Hinweis</h3><p class="mute">Vereinfachte Berechnung in Anlehnung an DIN/TS 12831-1:2020-04; Pauschalfaktoren für Erdreich (f=0,45) und unbeheizte Räume (f=0,5) sofern nicht abweichend angegeben. Kein zertifizierter Nachweis und keine Förderfreigabe; Eingaben und Ergebnisse sind fachlich zu prüfen.</p></div>`;
}

// ---------- Interaktion ----------
function parse(el) {
  const t = el.dataset.t, v = el.value;
  if (t === 'n') { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; }
  if (t === 'nn') { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; }
  return v;
}
const numeric = new Set(['wb', 'shielding', 'baujahr']);

$('#view').addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.actIn === 'preset') return;
  if (!el.dataset.b) return;
  let val = parse(el);
  if (el.tagName === 'SELECT' && numeric.has(el.dataset.b)) val = parseFloat(val);
  if (el.dataset.b === 'innenmasse') val = val === 'true';
  setPath(state, el.dataset.b, val);
  const a = el.dataset.actIn;
  if (a === 'roomType') { const r = curRoom(); const t = ROOM_TYPES[r.type]; r.theta = t.theta; r.nmin = t.nmin; save(); render(); return; }
  if (a === 'city') {
    const p = CLIMATE_PRESETS.find((c) => c.name === val);
    if (p) { state.climate.thetaE = p.thetaE; state.climate.thetaM = p.thetaM; }
  }
  if (el.tagName === 'INPUT' && el.dataset.b?.startsWith('climate.theta')) state.climate.city = 'custom';
  save();
  if (el.hasAttribute('data-rr')) { render(); return; }
  recompute();
  if (ui.tab === 'gebaeude') { updateLive(); if (a === 'name') { const d = document.querySelector('.tree .rm.on span'); if (d) d.textContent = val; } }
  else if (ui.tab === 'hydraulik') { $('#out').innerHTML = hydHtml(); renderKpi(); }
  else if (ui.tab === 'wp') { $('#out').innerHTML = hpHtml(); renderKpi(); }
  else renderKpi();
});

$('#view').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.actIn === 'preset' && el.value !== '') {
    const r = curRoom(); const i = +el.dataset.i; const elt = r.elements[i];
    const [label, u] = presetsFor(elt.type)[+el.value];
    elt.U = u; if (!elt.label) elt.label = label;
    save(); render();
  }
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, i = +b.dataset.i, j = +b.dataset.j, r = curRoom();
  switch (a) {
    case 'tab': ui.tab = b.dataset.v; break;
    case 'selRoom': ui.fi = i; ui.ri = j; break;
    case 'addFloor': state.floors.push(newFloor(`Geschoss ${state.floors.length + 1}`)); ui.fi = state.floors.length - 1; ui.ri = 0; break;
    case 'delFloor': if (!confirm('Geschoss mit allen Räumen löschen?')) return; state.floors.splice(ui.fi, 1); if (!state.floors.length) state.floors.push(newFloor('Erdgeschoss')); ui.fi = 0; ui.ri = 0; break;
    case 'addRoom': state.floors[i].rooms.push(newRoom(`Raum ${state.floors[i].rooms.length + 1}`)); ui.fi = i; ui.ri = state.floors[i].rooms.length - 1; break;
    case 'delRoom': if (!r || !confirm('Raum löschen?')) return; state.floors[ui.fi].rooms.splice(ui.ri, 1); ui.ri = Math.max(0, ui.ri - 1); break;
    case 'dupRoom': { if (!r) return; const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.name += ' (Kopie)'; c.elements.forEach((x) => (x.id = uid())); c.radiators.forEach((x) => (x.id = uid())); state.floors[ui.fi].rooms.splice(ui.ri + 1, 0, c); ui.ri++; break; }
    case 'estimate': {
      if (!r) return;
      const n = parseInt(prompt('Anzahl der Außenwände dieses Raums (1–4)?', '1'), 10);
      if (!(n >= 1)) return;
      const e = estimateFacade(r.type, n, r.area);
      const bj = state.baujahr ?? 4;
      const u = (key, row, fb) => B15[key][row][1][bj] ?? fb;
      const w = newElement('wand'); w.label = `Außenwand (geschätzt, ${n} Außenw.)`; w.area = +e.AW.toFixed(2); w.U = u('wand', 4, 1.4);
      const f = newElement('fenster'); f.label = 'Fenster (geschätzt)'; f.area = +e.AF.toFixed(2); f.U = u('fenster', 1, 2.7);
      r.elements.push(w); if (e.AF > 0) r.elements.push(f);
      break;
    }
    case 'addEl': r.elements.push(newElement(b.dataset.v)); break;
    case 'delEl': r.elements.splice(i, 1); break;
    case 'addRad': r.radiators.push({ id: uid(), label: `Heizkörper ${r.radiators.length + 1}`, QN: 1000, n: 1.3 }); break;
    case 'delRad': r.radiators.splice(i, 1); break;
    case 'csv': return downloadCsv();
    case 'print': return window.print();
    default: return;
  }
  save(); render();
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); URL.revokeObjectURL(url);
}
function downloadCsv() {
  if (!hyd.system) return;
  const d = (v, k = 1) => (isFinite(v) ? v.toFixed(k).replace('.', ',') : '');
  const head = ['Geschoss', 'Raum', 'Heizfläche', 'Heizlast W', 'Normleistung W', 'Vorlauf °C', 'Rücklauf °C', 'Spreizung K', 'Massenstrom l/h', 'Kv soll', 'Voreinstellung', 'Kv ist', 'Hinweise'];
  const rows = hyd.rows.map((x) => [x.floor, x.room, x.em.label, d(x.phi, 0), x.em.kind === 'hk' ? d(x.em.QN, 0) : '', d(hyd.system.tv, 0), d(x.tr), d(x.sigma), d(x.mass, 0), d(x.kvReq, 3), x.open ? 'offen' : x.setting, d(x.kvSet, 2), x.flags.join(' | ')]);
  download(`Einstellprotokoll_${state.name.replace(/\W+/g, '_')}.csv`, '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
}

$('#btnNew').onclick = () => { if (confirm('Neues leeres Projekt anlegen? Nicht exportierte Daten gehen verloren.')) { state = newProject(); ui = { tab: 'projekt', fi: 0, ri: 0 }; save(); render(); } };
$('#btnDemo').onclick = () => { if (confirm('Beispielprojekt laden? Aktuelle Daten werden ersetzt.')) { state = demoProject(); ui = { tab: 'gebaeude', fi: 0, ri: 0 }; save(); render(); } };
$('#btnExport').onclick = () => download(`${state.name.replace(/\W+/g, '_')}.json`, JSON.stringify(state, null, 2), 'application/json');
$('#fileImport').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!Array.isArray(p.floors) || !p.climate) throw new Error('Format');
    state = p; ui = { tab: 'gebaeude', fi: 0, ri: 0 }; save(); render();
  } catch { alert('Datei konnte nicht gelesen werden.'); }
  e.target.value = '';
};

render();
