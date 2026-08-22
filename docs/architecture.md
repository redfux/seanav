# Architektur & technische Entscheidungen

## Überblick

Reine Client-Anwendung aus statischen Dateien, ohne Build-Schritt und ohne
Backend. Ausgeliefert wird über GitHub Pages.

```
index.html          Markup, CSP-Meta-Tag, Panel-Struktur
style.css           Dark-Theme, Layout
js/version.js       APP_VERSION – einzige Pflegestelle der Versionsnummer
js/tilecache.js     IndexedDB-Kachelspeicher + eigener Leaflet-Layer
js/app.js           Geodäsie, GPS-Handling, UI-Verdrahtung, Boot
sw.js               Service Worker für den App-Shell (muss im Root liegen)
vendor/             Leaflet 1.9.4 lokal
docs/               Dokumentation
```

Ladereihenfolge in `index.html`: Leaflet → `version.js` → `tilecache.js` →
`app.js`. Klassische Skripte ohne Module, damit die App auch ohne Server-
Konfiguration (MIME-Typen, CORS) läuft.

## Kein Framework, kein Build

Die App besteht aus wenigen hundert Zeilen Logik über einer Kartenbibliothek.
Ein Framework würde Bundle-Größe, ein Node-Toolchain und einen Build-Schritt
mitbringen, ohne dass es an dieser Stelle etwas vereinfacht. Statische Dateien
lassen sich zudem direkt von GitHub Pages ausliefern und offline cachen.

Aus demselben Grund kein ESLint/Prettier, sondern `.editorconfig`: beide setzen
`package.json` und `node_modules` voraus.

## Kartenquelle

WMTS-Cache-Dienst des Kartverket (norwegische Seekartenbehörde), kostenlos und
ohne API-Key nutzbar:

```
https://cache.kartverket.no/v1/service
Layer:            sjokartraster
Tile-Matrix-Set:  webmercator (EPSG:3857)
```

`webmercator` entspricht der üblichen XYZ-/Slippy-Map-Kachelmathematik, sodass
Leaflets Kachelkoordinaten und die eigene Berechnung in `latLngToTile()` ohne
Umrechnung zusammenpassen.

Gegen die Live-Capabilities verifiziert (siehe B1 in `bugs.md`):

- Der Dienst bietet 19 Stufen, `"00"` … `"18"` – die Identifier sind
  **zweistellig null-aufgefüllt**, `seaTileUrl()` füllt entsprechend auf.
- `tilematrix={z}` ist korrekt; die qualifizierte Form `webmercator:{z}`
  liefert HTTP 500.
- Unbekannte Layer-Namen werden abgewiesen, es gibt also keinen still
  ausgelieferten Default-Layer.

Tile-URLs entstehen ausschließlich in `seaTileUrl()`. Anzeige-Layer und
Offline-Downloader teilen sich diese Funktion, damit sie nicht auseinanderlaufen.

Bewusst Rasterkarten statt offizieller ENC-Vektordaten (S-57/S-63): letztere
erfordern Lizenzierung und einen Vektor-Renderer mit S-52-Symbolik, was für
reine Streckenplanung und Orientierung nicht nötig ist.

Der Preis ist prinzipiell und nicht durch Darstellungsarbeit behebbar: Ein
Rasterbild trägt keine Attribute. Tiefen sind als Zahlen *aufgedruckt* und
damit ablesbar, aber nicht abfragbar – kein Antippen einer Stelle für die
Tiefe, keine Tiefenlinien-Filter, keine automatische Warnung bei
Unterschreitung. Dafür bräuchte es Vektordaten (ENC/S-57, für Norwegen über
PRIMAR lizenzpflichtig) oder ein separates Bathymetrie-Dataset; hochauflösende
Tiefendaten sind in Norwegen zudem zugangsbeschränkt.

## Zwei getrennte Cache-Mechanismen

Bewusst nicht vermischt, weil sie unterschiedliche Anforderungen haben:

| Ebene | Mechanismus | Warum |
| --- | --- | --- |
| App-Shell (HTML/CSS/JS/Leaflet) | Cache API im Service Worker (`sw.js`) | wenige, bekannte Dateien; Cache-API-Standardfall |
| Kartenkacheln | IndexedDB (`js/tilecache.js`) | tausende Einzeldateien mit Fortschrittsanzeige, Größenermittlung und Duplikatprüfung – dafür ist die Cache API zu grobkörnig |

Der `fetch`-Handler im Service Worker klammert `kartverket.no` deshalb explizit
aus: Kacheln laufen ausschließlich über `js/tilecache.js`, sonst würden beide
Ebenen dieselben Daten doppelt vorhalten.

`OfflineWMTSLayer` liest zuerst aus IndexedDB und geht nur bei einem Fehltreffer
ins Netz; erfolgreich geladene Kacheln werden zurückgeschrieben. Normale Nutzung
bei Empfang baut den Offline-Cache also nebenbei mit auf. Schlägt beides fehl,
liefert `_placeholderDataUrl()` eine schraffierte Canvas-Kachel – ein sichtbarer
Hinweis auf eine Lücke statt eines kaputten Bildsymbols.

### Datenmodell IndexedDB

Datenbank `seenavi-tiles`, Version 1, ein Object Store `tiles`:
Schlüssel `"z/x/y"` (String), Wert das PNG als `Blob`. Kein Index, da immer
nur der Punktzugriff über den Schlüssel gebraucht wird.

`z` ist dabei immer die **Service-Zoomstufe** – die tatsächlich angeforderte –,
nicht die Zoomstufe der Karte. Bei High-DPI-Darstellung unterscheiden sich
beide um `ZOOM_OFFSET` (siehe unten).

## High-DPI-Darstellung

Mobile Displays laufen mit `devicePixelRatio` 2–3. Eine 256-px-Kachel über
256 CSS-Pixel gezeichnet wird dort über rund 2,6 Gerätepixel gestreckt – bei
einer Rasterseekarte verschmieren dadurch genau die Details, auf die es
ankommt: aufgedruckte Lotungen und Untiefen-Symbolik.

Deshalb `detectRetina: true`. Leaflet halbiert dann die Kachelgröße auf 128 px
und erhöht `zoomOffset` um 1: bei Karten-Zoom 12 wird also Service-Zoom 13
geladen und auf halber Fläche gezeichnet, was die Pixelzuordnung wieder auf
etwa 1:1 bringt.

Das betrifft den Offline-Cache unmittelbar. Der Downloader bekommt vom UI
Karten-Zoomstufen und rechnet sie über `ZOOM_OFFSET` in Service-Zoomstufen um.
Täte er das nicht, würde er Kacheln speichern, die der Anzeige-Layer nie
abfragt – der Offline-Modus wäre still kaputt und das erst ohne Empfang
aufgefallen. `ZOOM_OFFSET` spiegelt exakt die Bedingung, unter der Leaflet
`detectRetina` aktiviert (`L.Browser.retina` und `maxZoom > 0`).

Preis: rund viermal so viele Kacheln pro Fläche. Das Offline-Panel weist darauf
hin.

## Warum `sw.js` im Root bleibt

Nach Masterprompt gehört eigenes Browser-JS nach `/js`. Ein Service Worker kann
aber nur Seiten auf oder unterhalb seines eigenen Pfades kontrollieren – aus
`/js/sw.js` würde der Scope `/js/`, und `index.html` bliebe unkontrolliert.
`sw.js` liegt deshalb als einzige Ausnahme im Root und holt sich die Version
über `importScripts('js/version.js')`.

## Versionsnummer an einer Stelle

`js/version.js` definiert `APP_VERSION`. Davon leiten sich ab:

- die Footer-Anzeige (`js/app.js`, `boot()`)
- der Cachename des Service Workers (`seenavi-shell-v<version>`)

Der versionierte Cachename dient zugleich als Cache-Busting: eine neue Version
erzeugt einen neuen Cache, der `activate`-Handler löscht alle übrigen. Ein
Release erfordert damit genau eine Änderung im Code plus den Eintrag in
`releases.md`.

## Sicherheit

- **CSP** als Meta-Tag in `index.html`: `default-src 'self'`, ausgehende
  Verbindungen nur nach `cache.kartverket.no` (`img-src`, `connect-src`).
  Das unterbindet versehentliches Nachladen technisch, nicht nur per Konvention.
  `style-src` erlaubt zusätzlich `'unsafe-inline'`, weil Leaflet Kachel- und
  Marker-Positionen zur Laufzeit als Inline-Styles setzt.
- **Kein `innerHTML`:** alle dynamischen Werte werden über `textContent` bzw.
  `style.width` gesetzt, es entsteht also kein XSS-Vektor aus Kartendaten oder
  Positionswerten.
- **Keine Secrets:** der Kartverket-Dienst braucht keinen API-Key, es gibt
  daher weder `.env` noch Zugangsdaten im Repo.

## Genauigkeit und Glättung

`onPosition()` bevorzugt `speed`/`heading` des Geräts, weil diese bei
langsamer Fahrt meist genauer sind als eine Ableitung aus zwei nahe
beieinanderliegenden GPS-Punkten. Fehlen sie, wird aus den letzten Fixes
gerechnet, wobei Bewegungen unter 1 m für den Kurs verworfen werden, damit
GPS-Rauschen im Stillstand die Kurslinie nicht rotieren lässt.

Geglättet wird per exponentiellem gleitendem Mittel (α = 0,35). Das kostet
etwas Reaktionszeit – bei Anlegemanövern können Werte sichtbar nachlaufen –
hält die Anzeige dafür aber ruhig genug zum Ablesen.

Distanz und Peilung über Haversine bzw. Großkreis-Anfangspeilung auf einer
Kugel mit R = 6.371 km. Der Fehler gegenüber einem Ellipsoidmodell liegt bei
den hier relevanten Distanzen unter der GPS-Genauigkeit.

## Bewusste Abweichung: kein Material Design

Der Masterprompt nennt Google Material Design als gestalterische Grundlage für
Web-UIs. Die App nutzt stattdessen ein dunkles, maritimes Theme mit großen
Kontrasten und wenigen, großflächigen Bedienelementen, zugeschnitten auf
Ablesbarkeit bei Sonnenlicht und Bedienung mit nassen Händen an Bord.

Der Punkt ist als O4 in `features.md` offen vermerkt und beim Nutzer zur
Entscheidung – eine Umstellung wäre ein reiner CSS-/Markup-Wechsel und würde
die Logik in `js/` nicht berühren.
