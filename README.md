# Heizlast & hydraulischer Abgleich

Web-Anwendung (ohne Build-Schritt, ohne Abhängigkeiten) für

1. **Heizlastberechnung** nach dem vereinfachten Verfahren der DIN EN 12831-1:2017-09 (Abschn. 7) mit den nationalen Eingangsgrößen der DIN/TS 12831-1:2020-04
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
- Optional: Bauteilflächen als Innenmaße (Außenwand × 1,25, TS Tab. 21).
- U-Wert-Vorlagen nach Baujahr (DIN/TS 12831-1, Tab. 33) und U-Wert nach nachträglicher Dämmung (Tab. 34 = EN Tab. B.16).
- Auslegungsinnentemperaturen nach TS Tab. 32 (Wohn-/Schlafräume, Flure, WC 20 °C · Bäder 24 °C · beheizte Nebenräume außerhalb der Wohnung 15 °C).
- Schätzung von Außenwand- und Fensterfläche aus der Raumfläche (TS Abschn. 5.1.4, Tab. 22/23).
- Gebäudeheizlast ohne Wärmeübertragung zwischen beheizten Räumen.

**Optional „Erweiterte Näherung“** (eigene Annahmen, keine Normvorgabe): Erdreich f = 0,45, Nachbarräume nach tatsächlicher Temperaturdifferenz, Infiltration über n50.

**Hydraulik und Wärmepumpe**

- Heizkörper: Q = Q_N · (ΔT_m / 49,83)^n, ΔT_m logarithmisch. Der Raum mit dem höchsten Bedarf (bei Auslegungsspreizung) bestimmt θV; für alle anderen Heizflächen wird der Rücklauf numerisch gelöst → Spreizung → Massenstrom m = Φ / (1,163 · σ).
- **Fußbodenheizung nach DIN EN 1264-2/-3** (Rohre im Estrich, Typ A/C/H/I/J): Kennlinie q = B·a_B·a_T^m_T·a_u^m_u·a_D^m_D·Δθ_H (Gl. 4–11, 26) mit Tab. A.1–A.3, Grenzkurve (Gl. 19–21, Tab. A.4–A.7), Spline-Interpolation, Spreizung ≤ 5 K.
- **Heizkreise:** je Kreis optional Mischer mit eigener Vorlauftemperatur; Kreise ohne Mischer laufen mit dem Erzeugervorlauf (höchster Kreisbedarf). Primärstrom von Mischerkreisen über ideale Beimischung. Zuordnung der Räume zu Kreisen im Raumeditor (sonst automatisch nach Heizflächenart).
- **Rohrnetz:** Druckverlust nach Darcy-Weisbach (Swamee-Jain, Wasser ≈ 60 °C) für die Anbindeleitung je Raum und die Hauptleitung (ungünstigster Weg) je Kreis; ersetzt die Pauschalen. Pumpen-Förderhöhe je Kreis = Δp Anschluss + Hauptleitung + Mischer/Armaturen (+ Erzeuger bei Kreisen ohne Mischer). Kein verzweigtes Netz: ein Strang je Kreis.
- Ventil: Kv = V̇ / √Δp, Wahl der nächstliegenden Voreinstellung aus der (editierbaren) Kv-Liste; Pumpe aus Volumenstrom und Druckverlust-Annahmen.

## Grenzen – bitte beachten

- **Kein zertifizierter Normnachweis.** Umgesetzt ist das **vereinfachte Verfahren** (EN 12831-1 Abschn. 7) mit den nationalen Eingangsgrößen der DIN/TS 12831-1; das **Standardverfahren** (Abschn. 6, Zeitkonstante, Zonen, Lüftungsmodell) und das Hüllflächenverfahren sind nicht umgesetzt. Alle Tabellenwerte sind aus den Normen abgeschrieben (zusammengefasste Zellen der TS Tab. 33 aufgelöst) und stichprobenartig zu prüfen. **Normaußentemperaturen:** die PLZ-Tabelle der TS liegt im elektronischen Anhang (CD-ROM) und ist hier nicht enthalten; die Städtewerte sind Richtwerte. Höhenkorrektur und Aufheizzuschlag nach TS sind nicht umgesetzt.
- **Fußbodenheizung:** nur Rohre im Estrich (Typ A/C/H/I/J, T ≤ 0,375 m). Nicht umgesetzt: Typ B/D, Randzonen, Wärmeverlust nach unten, Kühlung.
- **JAZ** über Carnot-Gütegradmodell und genäherte Temperaturhäufigkeit – **nicht** nach VDI 4650. Vorliegend war nur die Ergänzung mit Korrekturfaktoren F_ϑ1–3 (Tab. 13–18, 29) ohne das Rechenverfahren aus VDI 4650 Blatt 1; dafür wird zusätzlich das Hauptdokument benötigt.
- Voreinstellungs-Kv-Werte sind generische Werte; Herstellerdaten eintragen. Druckverluste sind pauschale Eingaben (kein Rohrnetzverfahren).
- Die Ausdrucke sind **nicht** als BEG-/BAFA-Nachweis freigegeben; Förderanforderungen separat prüfen.
- Rohrnetz als Ersatzleitung je Kreis (kein verzweigtes Netz, keine Teilstrecken-Auslegung); Rohrinnendurchmesser sind typische Werte.

## Mögliche nächste Schritte

verzweigtes Rohrnetz mit Teilstrecken, Herstellerkataloge für Heizkörper/Ventile, JAZ nach VDI 4650, Normklimatabelle nach PLZ (elektronischer Anhang der TS), CAD-/Aufmaßimport, PDF-Layout nach Förderformular.
