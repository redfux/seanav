# Releases

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

Die Versionsnummer wird ausschließlich in `js/version.js` gepflegt; Footer und
Service-Worker-Cachename leiten sich automatisch daraus ab.

## [0.2.1] – 2026-08-22

### Added

- `diagnose.html` + `js/diagnose.js`: Diagnoseseite für den Kartverket-WMTS.
  Testet beide `tilematrix`-Varianten nebeneinander, liest die Capabilities
  (Layer-Namen, TileMatrixSets, verfügbare Zoomstufen) und stellt mehrere
  Layer gegenüber, um einen stillschweigend ausgelieferten Default-Layer zu
  erkennen. Nötig, weil der Dienst aus der Entwicklungsumgebung nicht
  erreichbar ist. Alle Netzzugriffe mit Timeout, damit die Seite bei
  blockiertem Dienst eine Meldung zeigt statt hängenzubleiben.
- `docs/bugs.md`: B2 (Kartendarstellung zu grob, keine Tiefenwerte) mit
  Ursachenanalyse

## [0.2.0] – 2026-08-22

Anpassung an die Konventionen des Masterprompts. Bechtle-spezifische Vorgaben
(KI-Label-Icon, Bechtle Design System, Corporate-Farben) entfallen, da es sich
um ein rein privates Projekt ohne Firmenbezug handelt.

### Added

- `.gitignore` (`node_modules/`, `.env`, Build-Ausgaben, IDE-, OS- und
  Tool-Verzeichnisse)
- `LICENSE` (MIT)
- `js/version.js` als einzige Pflegestelle der Versionsnummer
- Dokumentation nach Schema: `docs/releases.md`, `docs/features.md`,
  `docs/architecture.md`, `docs/bugs.md`, `docs/changes.md`,
  `docs/THIRD_PARTY_LICENSES.md`
- Kommentar `thought up by human, coded by ai` in allen Hauptquelldateien
- a11y: `aria-label` an den Toolbar-Buttons, `role="status"`/`aria-live` an
  Status- und Navigationspanel, `for`-Verknüpfung am Zoom-Slider,
  `aria-hidden` an den dekorativen Emoji-Icons

### Changed

- **Breaking:** Eigenes Browser-JS liegt jetzt in `/js` (`js/app.js`,
  `js/tilecache.js`, `js/version.js`) statt im Root
- `readme.md` von `/docs` in den Root verschoben und um Setup, Nutzung und
  Datenspeicherung ergänzt; technische Details nach `docs/architecture.md`
- `sw.js` bezieht den Cachenamen über `importScripts('js/version.js')` aus
  `APP_VERSION`, statt die Version ein zweites Mal fest zu verdrahten
- Footer- und Kommentartext auf einheitlich „thought up by human, coded by ai"
  (vorher im Footer „created by ai")
- `.editorconfig` auf die Standard-Config des Masterprompts reduziert

### Removed

- `README.md` im Root (ersetzt durch `readme.md`)

## [0.1.0] – 2026-08-21

### Added

- Erstfassung: Leaflet-Karte mit Kartverket-WMTS „sjokartraster" als Untergrund
- Positions-, Kurs- und Geschwindigkeitsanzeige per `navigator.geolocation`
  mit gleitender Glättung
- Ziel per Kartenklick mit Distanz-, Peilungs- und ETA-Berechnung
- Projektionspanel (Strecke in 1 min, Zeit für 200 m / 500 m)
- Offline-Kachel-Download in IndexedDB inkl. Fortschritt, Abbruch und
  Platzhaltern für fehlende Kacheln
- Service Worker für den App-Shell
- Content-Security-Policy, Leaflet lokal vendort (kein CDN)
