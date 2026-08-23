# Releases

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

Die Versionsnummer wird ausschließlich in `js/version.js` gepflegt; Footer und
Service-Worker-Cachename leiten sich automatisch daraus ab.

## [0.6.0] – 2026-08-22

Umstellung auf global verfügbare Quellen. Die App war auf Norwegen
zugeschnitten; Ziel ist, dass sie ohne Umbau auch im Mittelmeer funktioniert.

### Changed

- **Breaking:** Grundkarte ist jetzt OpenStreetMap
  (`tile.openstreetmap.org`) statt der norwegischen `topograatone`. Weltweite
  Abdeckung, bis z19.
- Höchste Zoomstufe der Karte von 18 auf 19 angehoben
- Tiefendaten sind als „nur Norwegen" gekennzeichnet. Sie bleiben, weil es
  keine freie globale Entsprechung gibt und die Ebene außerhalb Norwegens
  einfach nichts zeichnet – das kostet nichts.
- Kachelspeicher-Panel ersetzt das Offline-Panel: es zeigt den Bestand und
  erlaubt das Leeren, bietet aber keinen Vorab-Download mehr.

### Added

- Verwaiste Kacheln entfernter Quellen werden beim Start automatisch aus dem
  Speicher geräumt (`pruneRemovedSources`). Entscheidend dafür ist, dass die
  Quellen-ID stabil bleibt: eine Quelle, die etwas anderes ausliefert, bekommt
  eine neue ID – sonst würden alte Kacheln als neue ausgegeben.
- Die App fordert beim Start persistenten Speicher an
  (`navigator.storage.persist()`). Ohne das gilt IndexedDB als „best effort"
  und kann bei Speicherdruck verworfen werden – lautlos, und vermutlich genau
  dann, wenn kein Empfang zum Nachladen da ist.

### Removed

- **Rasterseekarte** vollständig entfernt
- **Vorab-Download ganzer Gebiete** entfernt. Die Nutzungsbedingungen von
  `tile.openstreetmap.org` untersagen Prefetching von Kacheln, die niemand
  angesehen hat. Das Zwischenspeichern tatsächlich angezeigter Kacheln ist
  ausdrücklich erlaubt und bleibt.

### Fixed

- Ebenen- und Speicher-Panel liegen an derselben Bildschirmposition; beide
  gleichzeitig geöffnet, verdeckte das obere das untere und verschluckte
  dessen Taps. Die beiden schließen sich jetzt gegenseitig.

## [0.5.0] – 2026-08-22

### Added

- **Landkarte** als neue Basisebene: Kartverkets `topograatone`, eine
  graustufige topografische Karte. Bewusst **nicht** `tile.openstreetmap.org` –
  dessen Nutzungsbedingungen untersagen Bulk-Downloads ausdrücklich, und
  „Bereich offline speichern" ist genau das; solche Clients werden ohne
  Vorwarnung gesperrt. Kartverkets Dienst ist das offene, für Weiterverwendung
  gedachte Gegenstück für Norwegen.

### Changed

- Tiefenangaben und Tiefenlinien werden doppelt so groß gezeichnet.
  `DEPTH_SYMBOL_SCALE` trennt die Symbolgröße von der Schärfe: die Pixelzahl
  steuert weiterhin die Schärfe (2×), `MAP_RESOLUTION` jetzt zusätzlich die
  Symbolgröße (2×). Vorher hielt es die Symbole nur auf Nominalgröße.
- Rasterseekarte ist standardmäßig **aus**. Sie bleibt zuschaltbar, weil sie
  Symbolik trägt, die den anderen Ebenen fehlt – Verkehrstrennung,
  Sperrgebiete, Kabel.
- Voreinstellung, ob eine Ebene an ist, kommt jetzt aus der Quelle selbst
  statt pauschal „an"

### Fixed

- Zeichenreihenfolge folgt der Quellen-Registry statt der Reihenfolge, in der
  Ebenen eingeschaltet werden. Vorher legte sich die undurchsichtige
  Rasterseekarte über die Tiefendaten, wenn man sie zuletzt zuschaltete, und
  verdeckte sie vollständig.

## [0.4.0] – 2026-08-22

Umbau auf Vektor-basierte Kartenebenen. Die Rasterseekarte bleibt als
Hintergrund, liefert aber nicht mehr den navigationsrelevanten Inhalt.

### Added

- **Kartverket-Tiefendaten** (`wms.dybdedata2`, Layer `Dybdedata2`) als
  Ebene: Tiefenlinien, Lotungen, Grunde und Schären. Als WMS ohne
  Auflösungsdeckel, also bei jedem Zoom scharf.
- **OpenSeaMap-Seezeichen** als Ebene: Tonnen, Baken, Feuer (CC-BY-SA)
- Ebenen-Panel (🗺️) zum Ein- und Ausschalten; die Auswahl wird pro Gerät
  in `localStorage` gemerkt
- „Speicher leeren" im Offline-Panel
- Kachelspeicher-Anzeige jetzt nach Ebene aufgeschlüsselt
- Fällt `fetch()` aus (z. B. weil ein Host keine CORS-Header sendet), lädt
  die Kachel ersatzweise direkt als `<img>`. Sie ist dann sichtbar, nur nicht
  offline speicherbar – vorher wäre sie ganz ausgefallen.

### Changed

- **Breaking:** Cache-Schlüssel heißen jetzt `quelle/z/x/y` statt `z/x/y`.
  Die IndexedDB-Version steigt auf 2 und leert den Speicher beim ersten
  Start, da alte Schlüssel nicht mehr zuzuordnen sind. Offline genutzte
  Bereiche müssen einmalig neu geladen werden.
- Tile-URLs entstehen pro Quelle in genau einer `url(z, x, y)`-Funktion,
  die Anzeige und Downloader gemeinsam nutzen
- Rasterseekarte auf `maxNativeZoom: 15` gedeckelt – ihre gemessene
  Auflösungsgrenze. Darüber skaliert Leaflet die letzte echte Kachel weich,
  statt hartkantig hochskalierte Kacheln vom Dienst zu holen und zu speichern.
- `detectRetina` entfernt. Für die Tiefendaten wird stattdessen die doppelte
  Pixelzahl angefordert **und** über MapServers `MAP_RESOLUTION` die
  Symbolgröße mitskaliert – sonst wären Linien und Beschriftungen zwar
  schärfer, aber halb so groß.
- Offline-Download lädt alle aktiven Ebenen und meldet nicht speicherbare
  Kacheln, statt sie stillschweigend zu überspringen

### Removed

- Tipp-auf-die-Karte-Tiefenabfrage wurde nicht übernommen: Der Dienst
  antwortet auf GetFeatureInfo mit einem MapServer-Konfigurationsfehler
  (`msShapefileOpen(): Unable to access file`). Ein Feature, das eine
  Serverfehlermeldung anzeigt, ist schlechter als keins. Die Tiefenwerte
  stehen ohnehin in der Karte.

## [0.3.3] – 2026-08-22

### Changed

- `compare.html` von einem WMTS/WMS-Vergleich zu einem Kartenquellen-Labor
  umgebaut. Der Vergleich hatte sich erledigt: beide Quellen sind Raster und
  scheitern am selben Problem. Das Labor legt stattdessen die frei verfügbaren
  Vektor- und Tiefendatenquellen über die Rasterkarte:
  Kartverket-Tiefendaten (WMS, Layerliste live aus den Capabilities),
  OpenSeaMap-Seezeichen und OpenSeaMap-Tiefenlinien, jeweils schaltbar und
  in der Deckkraft regelbar.
- Tippen auf die Karte stellt eine GetFeatureInfo-Anfrage an die Tiefendaten
  und zeigt die Antwort – der Test dafür, ob „Antippen → Tiefe" machbar ist.

### Notes

- Der Vergleich mit einer kommerziellen App zeigte, dass dort Vektordaten
  (ENC/S-57) clientseitig gerendert werden. Keine Rasterquelle kann das
  einholen; die Datenquellen-Landschaft ist jetzt in `architecture.md`
  dokumentiert, offene Punkte als O5–O7 in `features.md`.

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
