# Releases

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

Die Versionsnummer wird ausschließlich in `js/version.js` gepflegt; Footer und
Service-Worker-Cachename leiten sich automatisch daraus ab.

## [0.3.2] – 2026-08-22

### Added

- `compare.html` + `js/compare.js`: stellt WMTS-Kachelcache und Geonorge-WMS
  synchronisiert nebeneinander. Layer- und Formatauswahl kommen live aus den
  Capabilities des Dienstes, sodass sich die richtige Konfiguration am realen
  Dienst ermitteln lässt, statt sie zu raten.

### Fixed

- Auflösungsmessung in `diagnose.html` stufte weiches Hochskalieren als
  „echtes Detail" ein. Die Schwelle von 2 % Pixelabweichung ignorierte, dass
  eine glatte Vergrößerung an jeder Kante ein paar Prozent leicht abweichender
  Pixel erzeugt, ohne neue Information zu tragen. Bewertet wird jetzt zusätzlich
  über die mittlere Differenz, mit „grenzwertig" als Zwischenstufe.

### Notes

- Messergebnis am Live-Dienst: nutzbares Kartendetail endet bei etwa z15;
  darüber skaliert der Dienst nur noch hoch. Details in `docs/bugs.md`, B3.

## [0.3.1] – 2026-08-22

### Added

- `diagnose.html` misst jetzt die **Auflösungsgrenze** des Dienstes: jede
  Kachel wird mit dem verdoppelten passenden Viertel der Stufe darunter
  verglichen. Ein reines Hochskalieren ergibt null Abweichung, echtes
  Kartendetail nicht – damit ist objektiv bestimmbar, ab wann der Dienst nur
  noch vergrößert. Logik gegen synthetische Kacheln verifiziert.
- Diagnose probt alternative WMS-Endpunkte, die für einen Ausschnitt in
  beliebiger Pixelgröße rendern statt aus einem festen Kachel-Cache

### Notes

- Der Screenshot des Nutzers zeigt harte, nearest-neighbor-artige Pixelblöcke.
  Da weder eigenes CSS noch Leaflet `image-rendering: pixelated` setzen, kommt
  das Hochskalieren vom Dienst. `detectRetina` (0.3.0) bringt oberhalb der
  nativen Auflösung folglich kein Detail, kostet aber die vierfache
  Kachelmenge – Entscheidung darüber steht bis zum Messergebnis aus.

## [0.3.0] – 2026-08-22

Behebt die grobe Kartendarstellung (B2). Ursache war nicht die Kartenquelle,
sondern die fehlende Behandlung hochauflösender Displays.

### Added

- High-DPI-Darstellung (`detectRetina`): auf Geräten mit
  `devicePixelRatio > 1` wird eine Zoomstufe tiefer geladen und auf halber
  Fläche gezeichnet. Aufgedruckte Lotungen und Untiefen-Symbolik werden
  dadurch lesbar.
- Hinweis im Offline-Panel auf den dadurch rund vierfachen Speicherbedarf

### Changed

- **Breaking (intern):** Der Offline-Downloader speichert jetzt die
  Service-Zoomstufen, die der Anzeige-Layer anfordert, statt der Karten-Zoomstufen.
  Ohne das hätte High-DPI den Offline-Cache still unbrauchbar gemacht.
  Bereits gespeicherte Kacheln bleiben gültig, decken aber nur den Zoombereich
  ohne Offset ab – für die neue Darstellung ist ein erneuter Download nötig.
- Tile-URLs entstehen nur noch in `seaTileUrl()` statt an zwei Stellen
- Obergrenze des Zoom-Reglers folgt `map.getMaxZoom()` statt fest 17
- `maxZoom` des Layers auf 18 (vom Dienst tatsächlich angeboten), vorher 17

### Fixed

- TileMatrix-Identifier werden zweistellig null-aufgefüllt (`"04"` statt `"4"`),
  wie in den Capabilities deklariert. Betraf Zoomstufen unter 10.
- Offline-Download war ein stiller No-Op mit Anzeige „0 / 0", wenn die Karte
  bereits weiter hineingezoomt war als die gewählte maximale Zoomstufe
- B1 geklärt: `tilematrix={z}` ist korrekt, die qualifizierte Variante
  `webmercator:{z}` liefert HTTP 500. Warnung in der Doku entfernt.

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
