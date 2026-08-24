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

## Schärfe der Tiefendaten, und warum die Symbole nicht größer werden

Ein Telefon läuft mit `devicePixelRatio` 2–3, eine 256-px-Kachel wird dort
also über rund 660 Gerätepixel gestreckt. Deshalb fordert `depthUrl()` die
doppelte Pixelzahl an (`DEPTH_OVERSAMPLE = 2`).

`MAP_RESOLUTION` muss dann um exakt denselben Faktor steigen – und keinen
größeren. MapServer nutzt den Wert zweifach:

1. Er skaliert Symbolgrößen, Linienstärken und Beschriftungen. Ohne ihn würden
   die Symbole beim größeren Bild optisch schrumpfen.
2. Er geht in den **Maßstabsnenner** ein, den der Server für die Anfrage
   berechnet und gegen den er maßstabsabhängige Ebenen prüft.

Die doppelte Pixelzahl halbiert diesen Nenner, die doppelte Resolution
verdoppelt ihn – beides hebt sich auf, und der Server zeichnet genau das
Detail, das zu dieser Zoomstufe gehört, nur mit mehr Pixeln.

Ein höherer Wert, um die Symbole zusätzlich zu vergrößern, zerstört diese
Kompensation: der Server hält die Karte für weiter herausgezoomt und lässt
Detailebenen weg. Bei `288` blieben die groben Tiefwasser-Objekte, die feinen
Flachwasser-Tiefenlinien verschwanden – siehe B5 in `bugs.md`.

**Größere Symbole sind aus diesem Dienst deshalb nicht zu haben, ohne Detail
zu verlieren.** Im Flachwasser ist Detail das Sicherheitsrelevante, also hat es
Vorrang. Der Weg zum besseren Ablesen ist eine Zoomstufe mehr.

### Überlagerung ohne Verdecken

Der Dienst rendert eine vollständige Seekarte, Wasserflächen und Küstenkontur
eingeschlossen, und diese Füllungen sind undurchsichtig – `transparent=true`
betrifft nur den Bildrand. Sie überdeckten die Grundkarte, sichtbar etwa an
Brücken und Straßennummern.

`mix-blend-mode: multiply` auf dem Kachel-Container der Ebene löst das ohne
Annahmen über die internen Sublayer-Namen des Dienstes: helle Füllungen lassen
die Grundkarte unverändert durch, dunkle Farbe bleibt dunkel. Der Blend-Modus
steht als Eigenschaft `blend` an der Quelle und wird über `className` auf den
Container gelegt.

## Kartenebenen

Drei Quellen, in Zeichenreihenfolge:

| Ebene | Quelle | Rolle | Abdeckung | Auflösungsgrenze |
| --- | --- | --- | --- | --- |
| Grundkarte | `tile.openstreetmap.org` | Land, Küstenlinie, Häfen | weltweit | z19 |
| Tiefendaten | `wms.geonorge.no/skwms1/wms.dybdedata2`, Layer `Dybdedata2` | Tiefenlinien, Lotungen, Grunde, Schären | Norwegen | keine (WMS) |
| Seezeichen | `tiles.openseamap.org` | Tonnen, Baken, Feuer | weltweit | z18 |

Die Wahl fiel auf weltweit verfügbare Quellen, weil das Boot dieses Jahr in
Norwegen und nächstes womöglich im Mittelmeer liegt – eine nationale Karte
müsste dann getauscht werden. Die Tiefendaten sind die Ausnahme: eine freie
globale Entsprechung existiert nicht, und außerhalb Norwegens zeichnet die
Ebene schlicht nichts, was nichts kostet.

Jede Quelle in `js/sources.js` besitzt genau eine `url(z, x, y)`-Funktion und
eine stabile ID. Die ID ist zugleich der Namensraum im Kachelspeicher – eine
Quelle, die etwas anderes ausliefert als bisher, muss deshalb eine **neue** ID
bekommen, sonst würden Kacheln des alten Dienstes als Kacheln des neuen
ausgegeben.

Die Zeichenreihenfolge ergibt sich aus der Reihenfolge in `CHART_SOURCES` und
wird über `zIndex` durchgesetzt – nicht daraus, in welcher Reihenfolge Ebenen
eingeschaltet werden. Sonst legte sich eine nachträglich zugeschaltete
undurchsichtige Ebene über alles darunter.

### Kein Vorab-Download

Die Nutzungsbedingungen von `tile.openstreetmap.org` untersagen
Bulk-Downloading und nennen "Download city/country for offline use" sowie
"Save area for later" ausdrücklich als Beispiele; solche Clients werden ohne
Vorwarnung gesperrt. Ausdrücklich erlaubt ist der umgekehrte Fall: Kacheln
behalten, die der Nutzer tatsächlich angesehen hat.

Die App speichert deshalb beim Betrachten und bietet keinen Gebiets-Download.
Praktisch heißt das: eine einmal abgefahrene Strecke bleibt ohne Empfang
verfügbar, ein unbekanntes Revier nicht. Wer echte Offline-Nutzung braucht,
müsste zu einem Anbieter wechseln, der Prefetching gestattet – die meisten
verlangen dafür einen API-Schlüssel.

Zwei Mechanismen halten den Speicher dabei brauchbar:

- `pruneRemovedSources()` löscht beim Start Kacheln von Quellen, die es nicht
  mehr gibt, statt sie dauerhaft Platz belegen zu lassen.
- `navigator.storage.persist()` bittet den Browser, den Speicher nicht bei
  Speicherdruck zu verwerfen. Ohne das gilt IndexedDB als "best effort" – und
  würde vermutlich genau dann geleert, wenn kein Empfang zum Nachladen ist.

## Zwei getrennte Cache-Mechanismen

Bewusst nicht vermischt, weil sie unterschiedliche Anforderungen haben:

| Ebene | Mechanismus | Warum |
| --- | --- | --- |
| App-Shell (HTML/CSS/JS/Leaflet) | Cache API im Service Worker (`sw.js`) | wenige, bekannte Dateien; Cache-API-Standardfall |
| Kartenkacheln aller Ebenen | IndexedDB (`js/tilecache.js`) | tausende Einzeldateien mit Größenermittlung, Aufräumen pro Quelle und Duplikatprüfung – dafür ist die Cache API zu grobkörnig |

Der `fetch`-Handler im Service Worker klammert alle Kachel-Hosts deshalb
explizit aus: Kacheln laufen ausschließlich über `js/tilecache.js`, sonst
würden beide Ebenen dieselben Daten doppelt vorhalten.

`CachedTileLayer` liest zuerst aus IndexedDB und geht nur bei einem Fehltreffer
ins Netz; erfolgreich geladene Kacheln werden zurückgeschrieben. Normale Nutzung
bei Empfang baut den Offline-Cache also nebenbei mit auf.

Scheitert `fetch()`, wird die Kachel ersatzweise direkt als `<img>` geladen.
Das deckt Hosts ab, die keine CORS-Header senden: dort schlägt `fetch()` fehl,
obwohl ein gewöhnliches Bild lädt. Solche Kacheln sind sichtbar, aber nicht speicherbar.

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
nicht unterscheiden lassen – jenes eine Upgrade musste den Store deshalb
leeren. Seither werden veraltete Einträge gezielt pro Quelle entfernt, sodass
alles Weiterverwendbare erhalten bleibt.

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

## Distanzmarken auf der Kurslinie

Statt einer Kachel mit Projektionswerten trägt die Kurslinie Punkte bei festen
Distanzen – 200 m und 500 m. Der Wert steht damit dort, wo er hingehört: an der
Stelle, die er beschreibt.

An jeder Marke stehen zwei Angaben auf gegenüberliegenden Seiten der Linie:

- die **Fahrzeit** bis dorthin bei aktueller Geschwindigkeit, waagerecht und in
  der kräftigeren Schrift – das ist die Zahl, die abgelesen wird. Gerundet auf
  volle Minuten; unter einer halben Minute stünde sonst „0 min", dort steht
  `<1 min`.
- die **Distanz** klein und parallel zur Linie laufend, als Beschriftung der
  Marke selbst.

Der Rotationswinkel für die mitlaufende Beschriftung wird aus dem Kurs
berechnet: Kurs 0 zeigt nach oben, die Bildschirmrichtung der Linie ist also
`(sin h, −cos h)`. Winkel jenseits der Senkrechten werden um 180° gedreht, sonst
stünde die Schrift auf westlichen Kursen auf dem Kopf. Geprüft über alle acht
Hauptrichtungen: der Winkel bleibt stets zwischen −90° und 90°.

Eine Marke wird nur gezeichnet, wenn sie lesbar ist. Drei Regeln, in dieser
Reihenfolge:

1. Unterhalb von `MIN_PROJECTION_SPEED_MS` gibt es weder einen projizierbaren
   Kurs noch eine sinnvolle Fahrzeit – dann keine Marken.
2. Liegt eine Marke außerhalb des sichtbaren Ausschnitts, entfällt sie. Weit
   hineingezoomt trifft das die 500-m-Marke.
3. Liegen zwei Marken auf dem Bildschirm näher beieinander als
   `MIN_MARK_SPACING_PX`, würden ihre Labels sich überdecken. Gemessen wird
   gegen die zuletzt **behaltene** Marke, nicht gegen die zuletzt geprüfte –
   sonst könnte eine übersprungene Marke die nächste doch wieder zu nah
   heranlassen. Herausgezoomt fallen so beide weg.

Da die Distanzen fest sind, hängt die Sichtbarkeit nur noch am Zoom, nicht mehr
an der Geschwindigkeit. Bei Kurs 20°: z14–z16 beide Marken, z17 nur 200 m,
z18 und z12 keine.

Zwei Details, die sonst still Ärger machen:

- Marken und Labels sind `interactive: false`. Sonst würde ein Tipp darauf vom
  Marker geschluckt und kein Ziel gesetzt.
- Neu bewertet wird auch bei `moveend`/`zoomend`, nicht nur beim GPS-Fix:
  welche Marken hineinpassen, hängt am Kartenausschnitt.

Der Versatz der Zeitangabe muss größer sein als ihre halbe Breite, da sie auf
dem Versatzpunkt zentriert wird – bei 15 px lag sie noch auf der Linie, bei
34 px bleiben 8–17 px Abstand. Die Distanzbeschriftung sitzt mit 13 px enger,
weil sie an der Linie entlangläuft statt quer dazu.

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

### Umgesetzt

- **Kartverket "Sjøkart – Dybdedata" (WMS)** – die öffentliche,
  unklassifizierte Tiefendatensammlung, die auch norgeskart.no verwendet.
  Tiefenpunkte mit 50 m Abstand, Tiefenlinien in Intervallen
  2/5/10/15/20/30/40/50/100 m. Als WMS nicht an eine Kachelpyramide gebunden.
  Einschränkung: detaillierte Bathymetrie ist in Norwegen zugangsbeschränkt –
  Auflösungen ab 25×25 m gelten als vertraulich, 25–50 m als beschränkt; frei
  nutzbar ist nur 50×50 m und gröber. Und der Dienst deckt nur norwegische
  Gewässer ab.
- **OpenSeaMap Seezeichen** – Tonnen, Baken und Feuer als transparentes
  Overlay, CC-BY-SA. Deckung ist community-abhängig.

### Verworfen oder offen

- **OpenSeaMap Tiefenlinien** (`depth.openseamap.org`, Layer
  `contour`/`contour2`) – nicht eingebunden; die Kartverket-Daten sind im
  aktuellen Revier dichter. Käme als globaler Ersatz in Frage, wenn sich das
  Revier verlagert.
- **Offizielle ENC** – der einzige vollwertige Ersatz für Rasterkarten,
  erfordert aber eine Vereinbarung mit einem PRIMAR-Distributor. Siehe O7 in
  `features.md`.

`compare.html` legt Kandidatenquellen übereinander, damit sich am realen
Revier beurteilen lässt, ob eine Kombination reicht.

## Oberfläche: Material 3

Grundlage ist Material 3 in dunkler Ausprägung, mit zwei bewussten
Abweichungen vom Standard:

- **Kontrast über der Material-Vorgabe.** Die Flächen sind dunkler, die
  Vordergrundfarben heller als in der Referenz-Dark-Palette. Das Display
  konkurriert an Bord mit offenem Himmel.
- **Messwerte in Display-Größen** statt der Body-/Title-Größen, die ein
  Material-Layout dafür vorsähe. Kurs und Speed stehen in 36 px, die
  Kartenwerte in 26 px, jeweils mit tabellarischen Ziffern, damit die Zahlen
  beim Zählen nicht springen. Sie müssen in einem Blick weg vom Wasser lesbar
  sein – das ist der Zweck der App.

Die Tokens stehen als CSS-Variablen in `style.css` (`--md-surface`,
`--md-primary`, `--md-radius-*` …); ein Umfärben berührt nur diesen Block.

**Keine Webfont.** Es darf nichts von einem CDN geladen werden, und Roboto
lokal einzubetten würde Gewicht für wenig Gewinn kosten. Verwendet wird ein
System-Stack, für Zahlen ein monospacer Stack, damit Ziffern gleich breit
laufen.

**Icons als Inline-SVG.** Einmal in `index.html` als `<defs>` definiert und per
`<use>` referenziert – kein Icon-Font, kein externes Sprite, keine
CSP-Ausnahme. Die vorherigen Emoji sahen auf jedem System anders aus.

### Flächenaufteilung

Der Bildschirm ist in Zonen aufgeteilt, die sich nicht überschneiden – auf
390 px Breite ist das kein Selbstläufer, frühere Fassungen hatten dort echte
Überlappungen:

| Zone | Inhalt |
| --- | --- |
| oben, volle Breite | App-Bar mit Kurs, Speed, GPS |
| oben links | Ablesekarten (Navigation, Projektion), gestapelt in einer Spalte |
| Mitte oben | Sheets für Ebenen und Speicher, gegenseitig ausschließend |
| unten rechts | Schaltflächen |
| unten links | Zoom-Control |
| unten, volle Breite | Attribution über dem Footer |
