# Architektur & technische Entscheidungen

## Überblick

Reine Client-Anwendung aus statischen Dateien, ohne Build-Schritt und ohne
Backend. Ausgeliefert wird über GitHub Pages.

```
index.html          Markup, CSP-Meta-Tag, Panel-Struktur
style.css           Dark-Theme, Layout
js/version.js       APP_VERSION – einzige Pflegestelle der Versionsnummer
js/sources.js       Kartenquellen: je eine url(z,x,y)-Funktion pro Quelle
js/tilecache.js     IndexedDB-Kachelspeicher + generischer Leaflet-Layer
js/app.js           Geodäsie, GPS-Handling, UI-Verdrahtung, Boot
sw.js               Service Worker für den App-Shell (muss im Root liegen)
vendor/             Leaflet 1.9.4 lokal
docs/               Dokumentation
```

Ladereihenfolge in `index.html`: Leaflet → `version.js` → `sources.js` →
`tilecache.js` → `app.js`. Klassische Skripte ohne Module, damit die App auch ohne Server-
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

## Kartenebenen

Drei Quellen, in Zeichenreihenfolge:

| Ebene | Quelle | Rolle | Standard | Auflösungsgrenze |
| --- | --- | --- | --- | --- |
| Landkarte | `cache.kartverket.no`, Layer `topograatone` | Land, Küstenlinie | an | z18 |
| Seekarte (Raster) | `cache.kartverket.no`, Layer `sjokartraster` | Verkehrstrennung, Sperrgebiete, Kabel | aus | z15, gedeckelt |
| Tiefendaten | `wms.geonorge.no/skwms1/wms.dybdedata2`, Layer `Dybdedata2` | Tiefenlinien, Lotungen, Grunde, Schären | an | keine |
| Seezeichen | `tiles.openseamap.org` | Tonnen, Baken, Feuer | an | z18 |

Die Rasterseekarte liefert bewusst nicht mehr den navigationsrelevanten
Inhalt: als Raster endet ihre echte Auflösung bei z15, und ihre Tiefenangaben
sind aufgedruckte Pixel. Sie bleibt nur zuschaltbar, weil sie Symbolik trägt,
die den übrigen Ebenen fehlt.

### Warum nicht OpenStreetMap als Landkarte

OSM wäre die naheliegende Wahl, scheidet aber an den Nutzungsbedingungen von
`tile.openstreetmap.org` aus: Bulk-Downloading ist untersagt, und die Policy
nennt „Download city/country for offline use" und „Save area for later"
ausdrücklich als Beispiele. Das ist exakt das Kernfeature dieser App; solche
Clients werden laut Policy ohne Vorwarnung gesperrt. Kartverkets
`topograatone` ist das offene, ausdrücklich zur Weiterverwendung gedachte
Gegenstück für Norwegen – und als Graustufenkarte tritt sie unter den
Tiefenlinien und Seezeichen zurück, statt mit ihnen um Aufmerksamkeit zu
konkurrieren.

Die Zeichenreihenfolge ergibt sich aus der Reihenfolge in `CHART_SOURCES` und
wird über `zIndex` durchgesetzt – nicht daraus, in welcher Reihenfolge Ebenen
eingeschaltet werden. Sonst legte sich eine nachträglich zugeschaltete
undurchsichtige Ebene über alles darunter.

Jede Quelle in `js/sources.js` besitzt genau eine `url(z, x, y)`-Funktion.
Anzeige-Layer und Offline-Downloader gehen beide darüber – sie können sich
also nicht darüber uneinig werden, welche Kachel gemeint ist. Eine solche
Abweichung würde erst offline auffallen, im denkbar schlechtesten Moment.

### Schärfe und Symbolgröße

Beides hängt zusammen und lässt sich nur gemeinsam lösen. Ein Telefon läuft
mit `devicePixelRatio` 2–3; fordert man vom WMS die doppelte Pixelzahl an,
wird das Bild schärfer – aber alles halb so groß, weil MapServer Linien und
Beschriftungen in festen Pixelmaßen zeichnet und wir das größere Bild in
derselben CSS-Fläche darstellen.

`MAP_RESOLUTION` ist MapServers Skalierungsfaktor für Symbolik (Standard
72 dpi) und entkoppelt beides: die Pixelzahl steuert die Schärfe, die
Resolution die gezeichnete Größe. In `js/sources.js` sind das zwei getrennte
Konstanten, die sich multiplizieren:

- `DEPTH_OVERSAMPLE = 2` → 512 px pro 256-CSS-px-Kachel, also doppelte Schärfe
- `DEPTH_SYMBOL_SCALE = 2` → Symbole doppelt so groß wie nominal

zusammen `MAP_RESOLUTION = 72 × 2 × 2 = 288`. Nominalgröße wäre zum Ablesen
an Bord zu klein.

Dass der Dienst MapServer ist, verrät seine eigene Fehlermeldung
(`msShapefileOpen`, siehe B4 in `bugs.md`).

## Zwei getrennte Cache-Mechanismen

Bewusst nicht vermischt, weil sie unterschiedliche Anforderungen haben:

| Ebene | Mechanismus | Warum |
| --- | --- | --- |
| App-Shell (HTML/CSS/JS/Leaflet) | Cache API im Service Worker (`sw.js`) | wenige, bekannte Dateien; Cache-API-Standardfall |
| Kartenkacheln aller Ebenen | IndexedDB (`js/tilecache.js`) | tausende Einzeldateien mit Fortschrittsanzeige, Größenermittlung und Duplikatprüfung – dafür ist die Cache API zu grobkörnig |

Der `fetch`-Handler im Service Worker klammert alle Kachel-Hosts deshalb
explizit aus: Kacheln laufen ausschließlich über `js/tilecache.js`, sonst
würden beide Ebenen dieselben Daten doppelt vorhalten.

`CachedTileLayer` liest zuerst aus IndexedDB und geht nur bei einem Fehltreffer
ins Netz; erfolgreich geladene Kacheln werden zurückgeschrieben. Normale Nutzung
bei Empfang baut den Offline-Cache also nebenbei mit auf.

Scheitert `fetch()`, wird die Kachel ersatzweise direkt als `<img>` geladen.
Das deckt Hosts ab, die keine CORS-Header senden: dort schlägt `fetch()` fehl,
obwohl ein gewöhnliches Bild lädt. Solche Kacheln sind sichtbar, aber nicht
offline speicherbar – der Downloader zählt sie als „nicht speicherbar", statt
sie stillschweigend zu überspringen.

Schlägt auch das fehl, bekommt die Basisebene über `_placeholderDataUrl()` eine
schraffierte Canvas-Kachel als sichtbaren Hinweis auf eine Lücke. Overlays
bleiben stattdessen transparent – jede fehlende Overlay-Kachel zu schraffieren
würde die Karte zudecken.

### Datenmodell IndexedDB

Datenbank `seenavi-tiles`, Version 2, ein Object Store `tiles`:
Schlüssel `"quelle/z/x/y"` (String), Wert das PNG als `Blob`. Kein Index, da
immer nur der Punktzugriff über den Schlüssel gebraucht wird.

Der Namensraum pro Quelle ist nötig, seit mehrere Ebenen denselben
Kachelraster benutzen. Version 1 hatte bloße `z/x/y`-Schlüssel, die sich davon
nicht unterscheiden lassen – das Upgrade leert den Store deshalb, statt
Kacheln zurückzulassen, die nichts mehr adressieren kann.

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

## Kartendatenquellen: Raster vs. Vektor

Der Vergleich mit einer kommerziellen App (Skippo, gerendert über Mapbox) hat
die grundsätzliche Grenze des bisherigen Ansatzes sichtbar gemacht. Dort sind
bei 100 m Maßstab Tiefenlinien, Lotungen und ein `Obstn`-Hindernis mit den
Werten `(1)` und `(3)` gestochen scharf zu lesen. Das ist kein besseres
Rasterbild, sondern ein anderer Datentyp:

| | Raster (`sjokartraster`) | Vektor (ENC/S-57) |
| --- | --- | --- |
| Auflösung | fest, endet praktisch bei z15 | beliebig, wird clientseitig gezeichnet |
| Tiefen | als Pixel aufgedruckt | Attribut am Objekt, abfragbar |
| Filtern nach Tiefe | nicht möglich | möglich |
| Verfügbarkeit für Norwegen | frei | offizielle ENC nur lizenziert über PRIMAR-Distributoren |

Kein Rasterendpunkt kann diese Lücke schließen; die Suche nach einer besseren
Rasterquelle war der falsche Weg.

### Frei verfügbare Alternativen

- **Kartverket „Sjøkart – Dybdedata" (WMS/WFS)** – die öffentliche,
  unklassifizierte Tiefendatensammlung, die auch norgeskart.no verwendet:
  `https://wms.geonorge.no/skwms1/wms.dybdedata2`. Tiefenpunkte mit 50 m
  Abstand, Tiefenlinien in Intervallen 2/5/10/15/20/30/40/50/100 m. Als WMS
  nicht an eine Kachelpyramide gebunden und per GetFeatureInfo abfragbar –
  damit wäre „Antippen → Tiefe" möglich.
  Wichtige Einschränkung: Detaillierte Bathymetrie ist in Norwegen
  zugangsbeschränkt. Auflösungen ab 25×25 m gelten als vertraulich, 25–50 m als
  beschränkt; frei nutzbar ist nur 50×50 m und gröber.
- **OpenSeaMap Seezeichen** – Tonnen, Baken und Feuer als transparentes
  Raster-Overlay, `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png`,
  CC-BY-SA. Deckung ist community-abhängig.
- **OpenSeaMap Tiefenlinien** – WMS unter
  `https://depth.openseamap.org/cgi-bin/mapserv.fcgi`, Layer `contour`/`contour2`.
- **Offizielle ENC** – der einzige echte Ersatz, erfordert aber eine
  Vereinbarung mit einem PRIMAR-Distributor.

`compare.html` legt diese Quellen übereinander, damit sich am realen Revier
beurteilen lässt, ob die Kombination reicht.

## Bewusste Abweichung: kein Material Design

Der Masterprompt nennt Google Material Design als gestalterische Grundlage für
Web-UIs. Die App nutzt stattdessen ein dunkles, maritimes Theme mit großen
Kontrasten und wenigen, großflächigen Bedienelementen, zugeschnitten auf
Ablesbarkeit bei Sonnenlicht und Bedienung mit nassen Händen an Bord.

Der Punkt ist als O4 in `features.md` offen vermerkt und beim Nutzer zur
Entscheidung – eine Umstellung wäre ein reiner CSS-/Markup-Wechsel und würde
die Logik in `js/` nicht berühren.
