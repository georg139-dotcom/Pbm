# Heizlast & hydraulischer Abgleich

Web-Anwendung (ohne Build-Schritt, ohne Abhängigkeiten) für

1. **Heizlastberechnung** in Anlehnung an DIN/TS 12831-1:2020-04 (vereinfacht, raumweise)
2. **Hydraulischen Abgleich nach Verfahren B** (Heizkörper & Fußbodenheizung, Ventilvoreinstellung, Pumpe)
3. **Heizungsoptimierung** (Vorlauftemperatur-Ermittlung über den Referenzraum, Spreizung je Heizfläche)
4. **Wärmepumpencheck** (benötigte Vorlauftemperatur, kritische Räume, Heizkurve, JAZ-Näherung)

Eingabe **geschossweise → raumweise → Bauteile & Heizflächen**. Export: JSON (Projekt), CSV (Einstellprotokoll), Druck/PDF (Bericht).

## Start

```bash
npm start      # http://localhost:8080
npm test       # Tests des Rechenkerns (Node ≥ 20)
```

Projektdaten liegen im `localStorage` des Browsers; mit „JSON speichern“ sichern.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `js/core/heatload.js` | Transmission, Lüftung, Aufheizen, Gebäudesumme |
| `js/core/emitters.js` | Leistung Heizkörper (n-Exponent, log. Übertemperatur) und Fußbodenheizung; Rücklauf-/Vorlauf-Solver |
| `js/core/hydraulics.js` | Verfahren B: θV, Massenstrom, Kv, Voreinstellung, Pumpe |
| `js/core/heatpump.js` | Wärmepumpencheck |
| `js/core/catalog.js` | Konstanten, U-Wert-Vorlagen, Raumtypen, Klimawerte |
| `js/ui/app.js` | Oberfläche |
| `test/` | Tests (Handrechnung, Energiebilanz, Plausibilität) |

## Rechenansatz

- Φ_T = Σ A · (U + ΔU_WB) · f · (θi − θe); f = 1 (Außenluft), 0,45 (Erdreich), 0,5 (unbeheizt) bzw. aus Temperaturdifferenz bei beheiztem Nachbarraum – je Bauteil überschreibbar.
- Φ_V = 0,34 · max(V̇_inf; V̇_min) · (θi − θe), V̇_inf = 2 · V · n50 · e · ε, V̇_min = n_min · V.
- Gebäudeheizlast ohne Wärmeübertragung zwischen beheizten Räumen.
- Heizkörper: Q = Q_N · (ΔT_m / 49,83)^n, ΔT_m logarithmisch. Für die Systemvorlauftemperatur bestimmt der Raum mit dem höchsten Bedarf (bei Auslegungsspreizung) θV; für alle anderen Heizflächen wird der Rücklauf numerisch gelöst → Spreizung → Massenstrom m = Φ / (1,163 · σ).
- Ventil: Kv = V̇ / √Δp, Wahl der nächstliegenden Voreinstellung aus der (editierbaren) Kv-Liste; Pumpe aus Volumenstrom und Druckverlust-Annahmen.

## Grenzen – bitte beachten

- **Kein zertifizierter Normnachweis.** Vereinfachte Pauschalfaktoren (Erdreich, unbeheizt, Wärmebrücken, Infiltration). Normaußentemperaturen sind Richtwerte und anhand der Normtabelle zu prüfen.
- **Fußbodenheizung** nur als Näherungsmodell, nicht nach DIN EN 1264.
- **JAZ** über Carnot-Gütegradmodell und genäherte Temperaturhäufigkeit – **nicht** nach VDI 4650. Nur zur Orientierung.
- Voreinstellungs-Kv-Werte sind generische Werte; Herstellerdaten eintragen. Druckverluste sind pauschale Eingaben (kein Rohrnetzverfahren).
- Die Ausdrucke sind **nicht** als BEG-/BAFA-Nachweis freigegeben; Förderanforderungen separat prüfen.
- Eine Anlage = ein Vorlauftemperaturniveau; Mischerkreise (z. B. FBH + Heizkörper) sind nicht separat abgebildet.

## Mögliche nächste Schritte

Heizkreise mit Mischern, Rohrnetzberechnung, Herstellerkataloge für Heizkörper/Ventile, EN-1264-Fußbodenheizung, Normklimatabelle nach PLZ, CAD-/Aufmaßimport, PDF-Layout nach Förderformular.
