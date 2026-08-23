# Anforderungen

## Zweck

Orientierungshilfe für Bootsfahrten in der Region Bergen, nutzbar ohne
Mobilfunkempfang. Kein Ersatz für vorschriftsmäßige Seekarten und Ausrüstung.

## Umgesetzt

| # | Anforderung | Seit |
| --- | --- | --- |
| F1 | Seekarte als Kartenuntergrund (Kartverket „Sjøkart Raster") | 0.1.0 |
| F2 | Eigene Position per Geräte-GPS, Marker auf der Karte | 0.1.0 |
| F3 | Kurs über Grund (COG) als Linie in Fahrtrichtung | 0.1.0 |
| F4 | Geschwindigkeit in Knoten, geglättet | 0.1.0 |
| F5 | Ziel per Klick/Tap setzen und wieder löschen | 0.1.0 |
| F6 | Distanz, Peilung und ETA zum Ziel | 0.1.0 |
| F7 | Projektion: Strecke in 1 min, Zeit für 200 m / 500 m | 0.1.0 |
| F8 | Kartenausschnitt für Offline-Nutzung herunterladen, mit Fortschritt und Abbruch | 0.1.0 |
| F9 | App startet ohne Netzverbindung (App-Shell im Service Worker) | 0.1.0 |
| F10 | Fehlende Kacheln als erkennbarer Platzhalter statt kaputtem Bild | 0.1.0 |
| F11 | Anzeige des belegten Kachelspeichers | 0.1.0 |
| F12 | Scharfe Kartendarstellung auf hochauflösenden Displays (High-DPI) | 0.3.0 |
| F13 | Tiefenlinien, Lotungen, Grunde und Schären aus dem Kartverket-Tiefendaten-WMS | 0.4.0 |
| F14 | Seezeichen (Tonnen, Baken, Feuer) aus OpenSeaMap | 0.4.0 |
| F15 | Kartenebenen einzeln ein-/ausschaltbar, Auswahl bleibt erhalten | 0.4.0 |
| F16 | Kachelspeicher nach Ebene aufgeschlüsselt, manuell leerbar | 0.4.0 |
| F17 | Graustufige topografische Landkarte als Basisebene | 0.5.0 |

## Nichtfunktionale Anforderungen

- **Offline-first:** zur Laufzeit wird außer Kartenkacheln nichts aus dem Web
  nachgeladen; keine CDN-Links
- **Datensparsam:** keine Server-Komponente, keine Analytics, keine
  Übertragung von Positionsdaten
- **Buildfrei:** direkt auslieferbare statische Dateien, keine `package.json`
- **Mobile-first:** Bedienung einhändig am Telefon, Kontraste für Tageslicht
- **Zielumgebung:** aktuelle Evergreen-Browser (Chrome, Firefox, Edge, Safari)

## Offen / nicht umgesetzt

| # | Anforderung | Status |
| --- | --- | --- |
| O1 | PWA-Icons (`manifest.json` → `icons` ist derzeit leer), damit die Installation auf dem Homescreen ein eigenes Symbol bekommt | offen |
| O2 | Gezieltes Löschen einzelner Offline-Bereiche bzw. des gesamten Kachelcaches aus der App heraus | offen |
| O5 | Abfragbare Tiefenwerte (Antippen → Tiefe) – blockiert durch einen Serverfehler des Dienstes, siehe B4 in `bugs.md` | extern blockiert |
| O7 | Offizielle ENC-Vektorkarten (S-57) über einen PRIMAR-Distributor – der einzige vollwertige Ersatz für Rasterkarten, aber lizenzpflichtig | Beschaffungsentscheidung |
| O3 | Routen mit mehreren Wegpunkten statt nur einem Einzelziel | offen |
| O4 | Google Material Design als gestalterische Grundlage (Masterprompt-Vorgabe) – siehe Begründung der aktuellen Abweichung in `architecture.md` | zu entscheiden |
