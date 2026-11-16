# Heizlast & hydraulischer Abgleich

Web-Anwendung (ohne Build-Schritt, ohne Abhängigkeiten) für

1. **Heizlastberechnung** nach dem vereinfachten Verfahren der DIN EN 12831-1:2017-09 (Abschn. 7, raumweise)
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

**Standard: DIN EN 12831-1:2017-09, vereinfachtes Verfahren (Abschn. 7, Anhang B)**

- Φ_T = Σ A · (U + ΔU_TB) · f_x · (θi − θe) mit f_x aus Tab. B.11: Außenluft 1,0 · unbeheizt 0,5 · Erdreich 0,3 · beheizter Nachbarraum 0,3 (nur bei Δθ > 4 K); ΔU_TB = 0,10 W/m²K (B.3.2).
- Φ_V = V · n · 0,34 · (θi − θe) mit n = 0,5 h⁻¹ (Tab. B.12).
- Optional: Bauteilflächen als Innenmaße (Außenwand × 1,25, Tab. B.10).
- U-Wert-Vorlagen nach Baujahr (Tab. B.15) und U-Wert nach nachträglicher Dämmung (Tab. B.16).
- Normheiztemperaturen nach Tab. B.14 (Wohnraum 20 °C, Bad 24 °C).
- Gebäudeheizlast ohne Wärmeübertragung zwischen beheizten Räumen.

**Optional „Erweiterte Näherung“** (eigene Annahmen, keine Normvorgabe): Erdreich f = 0,45, Nachbarräume nach tatsächlicher Temperaturdifferenz, Infiltration über n50.

**Hydraulik und Wärmepumpe**

- Heizkörper: Q = Q_N · (ΔT_m / 49,83)^n, ΔT_m logarithmisch. Der Raum mit dem höchsten Bedarf (bei Auslegungsspreizung) bestimmt θV; für alle anderen Heizflächen wird der Rücklauf numerisch gelöst → Spreizung → Massenstrom m = Φ / (1,163 · σ).
- Ventil: Kv = V̇ / √Δp, Wahl der nächstliegenden Voreinstellung aus der (editierbaren) Kv-Liste; Pumpe aus Volumenstrom und Druckverlust-Annahmen.

## Grenzen – bitte beachten

- **Kein zertifizierter Normnachweis.** Umgesetzt ist das vereinfachte Verfahren der **EN 12831-1:2017**, nicht die nationale **DIN/TS 12831-1:2020-04** und nicht das Standardverfahren (Abschn. 6). Die Tabellenwerte B.10–B.16 sind aus der Norm abgeschrieben und stichprobenartig zu prüfen. Normaußentemperaturen sind Richtwerte und anhand der Normtabelle zu prüfen.
- **Fußbodenheizung** nur als Näherungsmodell. EN 1264-1 (Begriffe) und -4 (Installation) enthalten keine Leistungsberechnung; dafür wären EN 1264-2/-3 nötig.
- **JAZ** über Carnot-Gütegradmodell und genäherte Temperaturhäufigkeit – **nicht** nach VDI 4650. Nur zur Orientierung.
- Voreinstellungs-Kv-Werte sind generische Werte; Herstellerdaten eintragen. Druckverluste sind pauschale Eingaben (kein Rohrnetzverfahren).
- Die Ausdrucke sind **nicht** als BEG-/BAFA-Nachweis freigegeben; Förderanforderungen separat prüfen.
- Eine Anlage = ein Vorlauftemperaturniveau; Mischerkreise (z. B. FBH + Heizkörper) sind nicht separat abgebildet.

## Mögliche nächste Schritte

Heizkreise mit Mischern, Rohrnetzberechnung, Herstellerkataloge für Heizkörper/Ventile, EN-1264-Fußbodenheizung, Normklimatabelle nach PLZ, CAD-/Aufmaßimport, PDF-Layout nach Förderformular.
