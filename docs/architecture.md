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
js/install.js       Installationshinweis (PWA), getrennt von der Karten-Logik
js/rotate.js        Kartenausrichtung Nord/Fahrtrichtung samt Leaflet-Korrekturen
js/wakelock.js      hält den Bildschirm an, solange die App vorn ist
compare.html        Wartungsseite: Prüfstand für Kartendienste, js/compare.js
sw.js               Service Worker für den App-Shell (muss im Root liegen)
manifest.json       PWA-Manifest
icons/              App-Icons: zwei SVG-Vorlagen und die daraus gerenderten PNGs
vendor/             Leaflet 1.9.4 lokal
docs/               Dokumentation
```

Ladereihenfolge in `index.html`: Leaflet → `version.js` → `sources.js` →
`tilecache.js` → `rotate.js` → `app.js` → `install.js` → `wakelock.js`.
`rotate.js` steht vor `app.js`, weil es Leaflet patcht, bevor die Karte
entsteht. Klassische Skripte ohne Module, damit die App auch ohne Server-
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
Detailebenen weg. Bei `288` blieben die groben Tiefwasser-Objekte, das feine
küstennahe Detail dünnte aus – siehe B5 in `bugs.md`.

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

### Tiefenzonen lesbar machen

Multiply allein genügt für die Tiefenzonen nicht. Der Dienst zeichnet sie in
sehr blassem Blau – an der gemessenen Stelle liegt das dunkelste Pixel der
Flächenebene bei Helligkeit 127 von 255 – und multipliziert mit dem ebenfalls
blassen Blau des OSM-Wassers fallen die Stufen fast zusammen.

Gemessen wurde der RGB-Abstand benachbarter Zonen nach dem Blenden, über den
Bereich, den der Dienst tatsächlich liefert (Weiß bis Helligkeit 127). Größer
ist besser unterscheidbar:

| Filter | Stufen | Bemerkung |
| --- | --- | --- |
| ohne Filter | 30 / 41 / 57 | Ausgangslage |
| `saturate(3)` | 47 / 60 / 64 | gewählt |
| `saturate(4)` | 58 / 72 / 52 | Kanäle laufen an, die letzte Stufe schließt sich wieder |
| `saturate(1.8) contrast(1.3)` | 19 / 57 / 73 | schlechter als ohne Filter |

`contrast()` war die naheliegende Wahl und ist die falsche: sein Drehpunkt
liegt bei Mittelgrau, es schiebt blasse Zonen also Richtung Weiß und macht
ausgerechnet die Stufe schlechter, auf die es im Flachwasser ankommt.
Sättigung wirkt am anderen Ende: sie entfernt eine Farbe proportional zu dem
Farbanteil, den sie schon hat, verschiebt eine kaum blaue Zone also deutlich,
während weißes Tiefwasser ohne Farbanteil weiß bleibt. Grau bleibt unberührt,
Tiefenlinien, Lotungen und Symbole kommen unverändert durch; Alpha bleibt
ebenfalls unberührt.

Der Filter steht als Eigenschaft `filter` an der Quelle, getrennt vom
Blend-Modus, und wird über dieselbe `className` gelegt – erst filtern, dann
blenden.

## Kartenebenen

Fünf Quellen, in Zeichenreihenfolge:

| Ebene | Quelle | Rolle | Abdeckung | Auflösungsgrenze |
| --- | --- | --- | --- | --- |
| Grundkarte | `tile.openstreetmap.org` | Land, Küstenlinie, Häfen | weltweit | z19 |
| Tiefendaten | `wms.geonorge.no/skwms1/wms.dybdedata2`, Layer `Dybdedata2` | Tiefenzonen, Lotungen, Grunde, Schären, Tiefenlinien soweit vermessen | Norwegen | keine (WMS) |
| Tiefenlinien | `ows.emodnet-bathymetry.eu/wms`, Layer `contours` | Tiefenlinien | Europa | ~115 m (z15) |
| Seekarte | `ideihm.covam.es/wms/cartaENCp3…p5`, Layer `grupo_2` | Lotungen, Felsen, Wracks, Hindernisse, Tiefenlinien | spanische Gewässer | Maßstabsband je Zweck (z17) |
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
  Verbindungen nur zu den fünf Kachel-Hosts, die die Ebenen wirklich brauchen –
  `tile.openstreetmap.org`, `wms.geonorge.no`, `ows.emodnet-bathymetry.eu`,
  `ideihm.covam.es`, `tiles.openseamap.org` – jeweils in `img-src` und
  `connect-src`. Das unterbindet versehentliches Nachladen technisch, nicht nur
  per Konvention; eine neue Quelle muss hier ausdrücklich eingetragen werden.
  `style-src` erlaubt zusätzlich `'unsafe-inline'`, weil Leaflet Kachel- und
  Marker-Positionen zur Laufzeit als Inline-Styles setzt.
- **`innerHTML` nur aus eigenen Konstanten:** Messwerte, Positionen und alles,
  was von außen kommt, gehen ausschließlich über `textContent`. Die einzige
  Ausnahme ist der Kartennachweis, der die Attributionstexte aus
  `js/sources.js` zusammensetzt – Links, die im eigenen Quelltext stehen, keine
  Fremddaten. Auf der Wartungsseite `compare.html` wird alles, was von fremden
  Servern ins Protokoll geht, vorher escaped.
- **Keine Secrets:** keiner der Kartendienste braucht einen API-Key, es gibt
  daher weder `.env` noch Zugangsdaten im Repo.

## Distanzmarken auf der Kurslinie

Die Kurslinie ist eine Projektion und hängt deshalb ganz am selben Schalter wie
die Marken darauf: ist er aus, verschwindet die Linie mit. Eine Linie ohne ihre
Werte war ein halber Zustand, den niemand bestellt hatte.

Statt einer Kachel mit Projektionswerten trägt die Kurslinie Punkte bei festen
Distanzen – 200 m, 500 m, 1 km, 5 km und 10 km. Der Wert steht damit dort, wo er hingehört:
an der Stelle, die er beschreibt. Die Linie reicht knapp über die äußerste Marke
hinaus, damit deren Beschriftung nicht auf dem Linienende sitzt.

**Farbe.** Orange sah am Schreibtisch richtig aus und fiel auf dem Wasser durch:
gegen das Blau der Seeflächen hat es bei praller Sonne zu wenig Kontrast. Die
Linie ist deshalb schwarz – mehr Kontrast gegen eine helle Karte gibt es nicht –
und liegt auf einer hellen Unterlinie, damit sie über dunklem Grund nicht
ihrerseits verschwindet. Dieselbe Paarung tragen die Marken: schwarze Punkte mit
hellem Ring.

Die Linie zum Ziel hat dasselbe Problem gehabt und folgt derselben Bauweise,
aber nicht derselben Farbe: zwei schwarze Linien vom selben Boot wären nur noch
am Strichmuster auseinanderzuhalten. Sie ist magenta – die Farbe, in der auf
einer Seekarte ein von Hand gelegter Kurs steht, weit weg von allem, was die
Grundkarte für Wasser und Land verwendet – ebenfalls auf heller Unterlinie.

An jeder Marke stehen zwei Angaben auf gegenüberliegenden Seiten der Linie:

- die **Fahrzeit** bis dorthin bei aktueller Geschwindigkeit, waagerecht und in
  der kräftigeren Schrift – das ist die Zahl, die abgelesen wird. Gerundet auf
  volle Minuten; unter einer halben Minute stünde sonst „0 min", dort steht
  `<1 min`. Jenseits einer Stunde wird auf Viertelstunden umgestellt – „1,5 h"
  statt „95 min": Minuten sind dort nicht mehr die Einheit, in der jemand
  denkt, und genauer als eine Viertelstunde ist die Schätzung ohnehin nicht,
  denn sie rechnet die aktuelle Geschwindigkeit auf anderthalb Stunden hoch.
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
   hineingezoomt trifft das zuerst die weit entfernten.
3. Liegen zwei Marken auf dem Bildschirm näher beieinander als
   `MIN_MARK_SPACING_PX`, würden ihre Labels sich überdecken. Gemessen wird
   gegen die zuletzt **behaltene** Marke, nicht gegen die zuletzt geprüfte –
   sonst könnte eine übersprungene Marke die nächste doch wieder zu nah
   heranlassen. Herausgezoomt rücken die nahen Marken auf dem Bildschirm
   zusammen und fallen dadurch weg.

Da die Distanzen fest sind, hängt die Sichtbarkeit nur noch am Zoom, nicht mehr
an der Geschwindigkeit – und die beiden Regeln greifen von entgegengesetzten
Seiten, sodass **eine** Leiter von 200 m bis 10 km den ganzen Bereich abdeckt,
ohne dass irgendwo Zoomstufen abgefragt werden. Gemessen bei Kurs 0°:

| Zoom | Auflösung | gezeigte Marken |
| --- | --- | --- |
| z16 | 1,2 m/px | 200 m |
| z14 | 4,7 m/px | 200 m, 500 m, 1 km |
| z12 | 19 m/px | 1 km, 5 km |
| z11 | 38 m/px | 5 km, 10 km |
| z10 | 76 m/px | 5 km, 10 km |
| z9 | 151 m/px | 5 km |

Die Linie ist mit `1,15 × 10 km` entsprechend lang. Weit hineingezoomt läuft sie
damit über den Bildschirmrand hinaus, was nichts kostet – sie wird ohnehin
abgeschnitten – und dafür bleibt ihre Länge konstant, statt bei jedem Zoom
mitzuwandern.

Zwei Details, die sonst still Ärger machen:

- Marken und Labels sind `interactive: false`. Sonst würde ein Tipp darauf vom
  Marker geschluckt und kein Ziel gesetzt.
- Neu bewertet wird auch bei `moveend`/`zoomend`, nicht nur beim GPS-Fix:
  welche Marken hineinpassen, hängt am Kartenausschnitt.

Der Versatz der Zeitangabe muss größer sein als ihre halbe Breite, da sie auf
dem Versatzpunkt zentriert wird – bei 15 px lag sie noch auf der Linie, bei
34 px bleiben 8–17 px Abstand. Die Distanzbeschriftung sitzt mit 13 px enger,
weil sie an der Linie entlangläuft statt quer dazu.

## Installation als PWA

Installiert ist die App das, was sie sein soll: ohne Browserleiste, eigenes
Icon, eigener Speicher, Start ohne Empfang. Dafür nötig sind `manifest.json`,
ein Service Worker mit `fetch`-Handler und Icons in 192 und 512 px – alles
vorhanden.

### Systemleisten

`display` ist `standalone`, nicht `fullscreen`. Vollbild blendet die
Statusleiste des Telefons aus, und damit Uhrzeit und Akkustand – zwei Angaben,
die auf dem Wasser dazugehören. Aus demselben Grund steht die
iOS-Statusleiste auf `black` statt `black-translucent`: sonst liefe die Karte
unter Uhr und Akkuanzeige hindurch. Eine bereits installierte App übernimmt den
geänderten Modus erst, wenn der Browser das Manifest neu einliest – auf Android
nach ein paar Stunden von selbst, sofort bei einer Neuinstallation.

Mit `standalone` kommt neben der oberen auch die **untere** Systemleiste zurück,
Androids Gesten- bzw. Dreiknopfleiste. Deren Farbe bestimmt in einer
installierten App **Chrome selbst**, nicht die Seite: `theme-color` färbt die
obere Leiste, `background_color` den Startbildschirm, und für die untere gibt
es keine Angabe im Manifest oder in CSS, die sie zuverlässig setzt. Im Browser
sieht es richtig aus, weil Chrome dort dieselbe Leiste nach der Seite
einfärbt – im WebAPK nach seinem eigenen Thema.

Angelegt ist trotzdem alles, was greifen *kann*: `color-scheme: dark`, ein
dunkler Hintergrund auf `html` (der auf das Canvas durchschlägt, also auch in
den Bereich hinter den Systemleisten), `viewport-fit=cover` für den
Edge-to-Edge-Fall neuerer Android-Versionen und `theme-color` zusätzlich mit
`media`-Varianten für `prefers-color-scheme` und `display-mode: standalone`,
die manche Chrome-Versionen für die Systemleisten heranziehen. Bleibt die
Leiste hell, hilft nur das Thema von Chrome selbst (Einstellungen → Design →
Dunkel).

**Nur die untere Leiste ausblenden geht nicht.** Die Fullscreen-API nimmt beide
Leisten oder keine, und Androids selektiven Immersive-Modus, mit dem native
Apps einzelne Leisten verstecken, erreicht eine Webseite nicht. Statt das im
Manifest festzuschreiben – `display: fullscreen` hatte genau diesen Preis und
kostete Uhr und Akkustand – steht der Tausch jetzt als Schalter in der Ecke der
Fußleiste: normal laufen die Systemleisten mit, ein Tipp gibt den ganzen
Bildschirm. Der Knopf erscheint nur, wo `document.fullscreenEnabled` es
zulässt; iOS gibt Vollbild allein an Video-Elemente, und ein Knopf, der nichts
kann, ist schlimmer als keiner. Beim Wechsel ändern sich die Safe-Area-Ränder,
deshalb werden Leistenhöhe und Kartengröße danach neu vermessen.

### Icons

Zwei SVG-Vorlagen im Ordner `icons/`, aus denen die PNGs gerendert sind:

| Datei | Zweck |
| --- | --- |
| `icon.svg` | Vorlage `purpose: any`, abgerundetes Quadrat, transparente Ecken |
| `icon-maskable.svg` | Vorlage `purpose: maskable`, randlos, Zeichnung im 80-%-Sicherheitskreis |
| `icon-192.png`, `icon-512.png` | aus `icon.svg` |
| `icon-maskable-512.png` | aus `icon-maskable.svg` |
| `apple-touch-icon.png` (180 px) | aus `icon-maskable.svg`; iOS maskiert selbst und mag keine Transparenz |

Die Zeichnung ist bewusst grob – eine Kompassnadel im Ring, zwei Farben. Auf
dem Homescreen ist das Icon 48 px groß, alles Feinere zerfällt dort.

### Der Hinweis

Browser bieten die Installation selbst an, verstecken sie aber in einem Menü,
das beim Ablegen niemand öffnet. `js/install.js` fängt deshalb
`beforeinstallprompt` ab – sonst legt der Browser seine eigene Leiste über die
Karte – und zeigt stattdessen eine Karte in der Ablesespalte, wo sie nichts
verdecken kann. Der Knopf spielt das gespeicherte Ereignis ab.

iOS kennt `beforeinstallprompt` nicht und lässt keine programmatische
Installation zu. Dort beschreibt der Hinweis nur den Weg über das Teilen-Menü,
und der Knopf entfällt – ein Knopf, der nichts kann, ist schlimmer als keiner.
Angezeigt wird der Hinweis nur in Safari, dem einzigen Browser dort, der
installieren kann.

Nicht gezeigt wird er, wenn die App bereits installiert läuft
(`display-mode`-Query, auf iOS `navigator.standalone`) oder der Hinweis einmal
weggeklickt wurde – ein Hinweis, der wiederkommt, ist Werbung.

## Fixiertes Ziel

Ein Ziel, das eine Minute unverändert stand, reagiert nicht mehr auf Taps auf
die Karte. Der Grund ist die Umgebung: unterwegs wird das Telefon mit nassen
Händen auf einem schwankenden Boot bedient, und ein Fehltipper, der das Ziel
still woanders hinsetzt, fällt spät auf – im schlechtesten Fall erst, wenn
Peilung und ETA schon eine Weile auf den falschen Punkt zeigen.

Jede Änderung startet die Minute neu, solange also noch gesucht wird, ist
nichts fixiert. Danach führt der Weg über „Ziel löschen", einen Knopf, den
niemand versehentlich trifft.

Der Zustand muss sichtbar sein, sonst wirkt die App kaputt: Der Marker bekommt
einen leuchtenden Rand, die Zielkarte eine Zeile, und ein ignorierter Tap
beantwortet sich selbst über die Snackbar – eine stille Nichtreaktion wäre
nicht von einem Fehler zu unterscheiden. Der Marker ist ein `<img>`, an das
sich kein Pseudoelement hängen lässt; deshalb der Filter statt eines Symbols.

## Kartenausrichtung: Nord oder Fahrtrichtung

Drei Zustände: **Nordung** ist der Lesemodus – er passt zur Papierkarte, und die
Umgebung behält ihre Plätze. **Fahrtrichtung** ist der Steuermodus – was oben
gezeichnet ist, liegt voraus. **Von Hand gedreht** entsteht, sobald zwei Finger
die Karte drehen: sie bleibt dann stehen, wo sie hingelegt wurde, wie eine
Papierkarte auf dem Tisch. Die ersten beiden bleiben gespeichert, das
Handgedrehte nicht – es ist ein Zustand, keine Einstellung.

Zwei Finger drehen dieselbe Geste, die auch zoomt: Leaflet liest ihren Abstand,
`js/rotate.js` ihren Winkel. Damit eine Kneifbewegung, die sich zufällig etwas
mitdreht, nicht die Karte verstellt, zählt der Winkel erst ab 12 Grad. Wird
nahe Norden losgelassen, rastet die Karte auf genau Norden ein – eine Karte,
die drei Grad schief steht, will niemand. Ein Griff in die Karte beendet den
Fahrtrichtungsmodus, so wie ein Ziehen das Folgen beendet; der Knopf richtet
sie mit einem Tipp wieder nach Norden aus.

Leaflet kann keine Karte drehen, also dreht CSS sie: `#map` wird um seine Mitte
rotiert, `#mapviewport` schneidet ab. Daraus folgen drei Dinge, und die sind der
ganze Inhalt von `js/rotate.js`.

**1. Ein gedrehtes Rechteck deckt das Fenster nicht mehr ab.** Der Container
bekommt deshalb im Fahrtrichtungsmodus die Diagonale des Fensters als Kantenlänge –
dann ist bei jedem Winkel jede Ecke gedeckt. Das kostet: die Fläche wächst auf
gut das 2,5-fache, also lädt die Karte entsprechend mehr Kacheln. In der Nordung
bleibt der Container fenstergroß, der Normalfall lädt also nichts zusätzlich.

**2. Zeigerpositionen stimmen nicht mehr.** Leaflet rechnet Klicks über das
Bounding-Rect des Containers um, und das ist bei einem gedrehten Element der
achsenparallele Kasten darum – ein Tap würde das Ziel woanders hinsetzen.
Korrigiert wird in `L.Map.prototype.mouseEventToContainerPoint`: Der Mittelpunkt
bleibt bei einer Drehung um die Mitte, wo er ist, also wird von dort gemessen und
um den Kurswinkel zurückgedreht. Nicht an `L.DomEvent.getMousePosition`, denn
das gebündelte Leaflet ruft diesen Helfer intern über einen modulinternen Namen
auf – das exportierte Alias zu ersetzen bewirkt nichts.

**3. Ziehen ginge schräg.** Leaflet verschiebt die Karte um den rohen
Bildschirmversatz. Korrigiert wird in `L.Draggable.prototype._updatePosition`,
der einzigen Stelle, die die Pane-Position schreibt – `_onMove` rechnet und
schreibt in einem Zug, eine Korrektur danach käme jedes Mal einen Schritt zu
spät. Leaflets `_startPos` ist nicht die Startposition, sondern diese minus dem
Versatz, der das Ziehen über die Schwelle gebracht hat; die echte Startposition
wird deshalb beim ersten Update des Ziehens am Element abgelesen.

**Was die Drehung nicht kann:** Die Beschriftungen der Kartendienste – Tiefenzahlen,
Ortsnamen, Seezeichensymbole – stehen bei gedrehter Karte schief. Sie sind in
die Kacheln eingebrannt; OSM, Kartverket und OpenSeaMap liefern fertige Bilder,
keine Objekte. Was in ein Bild gezeichnet ist, dreht sich mit dem Bild, und kein
Eingriff auf der Client-Seite kann einzelne Pixel wieder aufrichten. Aufrecht
zu halten wären sie nur, wenn die Karte aus Vektordaten gezeichnet würde
(Vektorkacheln mit MapLibre GL, oder die Tiefendaten als GeoJSON über WFS und
selbst beschriftet) – das wäre ein Austausch der Renderschicht, siehe O11 in
`features.md`.

Was aufrecht bleiben muss und aufrecht bleiben *kann*, dreht zurück: die
Zeitmarken an der Kurslinie und die Zielnadel über `--map-counter-rot`. Die Distanzbeschriftung nicht – sie soll an
der Linie liegen, und die Linie dreht mit. Das Boot bekommt immer den
geografischen Kurs: in der Nordung dreht sich das Boot, im Fahrtrichtungsmodus
dreht sich die Karte darunter, und das Boot zeigt nach oben.

### Ein Knopf für Position und Ausrichtung

Position und Ausrichtung sind zwei Hälften derselben Frage – „wo bin ich und
wie herum" –, und zwei Knöpfe dafür waren einer zu viel auf einem Bildschirm,
der überwiegend Karte sein soll. Sie liegen deshalb auf einem Knopf, wie auf
dem Telefon üblich:

| Zustand | Symbol | Was das Tippen tut |
| --- | --- | --- |
| folgt nicht | Fadenkreuz | Boot zurück in die Mitte, Folgen an |
| folgt, Nordung | Kompass mit N | auf Fahrtrichtung umschalten |
| folgt, Fahrtrichtung | drehende Nadel | zurück auf Nordung |
| von Hand gedreht | drehende Nadel | geradestellen und zentrieren |

Das Symbol zeigt immer, was der nächste Tipp tut, nicht, was gerade der Fall
ist – ein Fadenkreuz heißt „ich hole das Boot zurück", nicht „hier ist das
Boot". Eine von Hand gedrehte Karte zählt dabei als „weg": der Tipp, der das
Boot zurückholt, stellt sie mit gerade, statt sie in einem Winkel stehen zu
lassen, den niemand mehr will.

Die Kompassnadel im Knopf hängt an derselben Variablen `--map-rot` wie
die Karte selbst. Damit zeigt sie immer dorthin, wo Norden auf dem Bildschirm
liegt – und in der Nordung ist der Winkel null, die Nadel steht also von selbst
aufrecht, mit dem N obenauf. Deshalb ist dieses eine Symbol inline gezeichnet
statt aus dem Symbolsatz geholt: hinter einem `<use>` wäre die Nadel für CSS
nicht erreichbar. Das N gehört zur stehenden Nadel und entfällt, sobald die
Karte gedreht ist – mitgedreht läge es nur auf der Seite.

Zoomknöpfe und Kartennachweis waren Leaflet-Controls **innerhalb** der Karte.
Das geht nicht mehr: sie säßen an den Ecken des übergroßen Containers, also
außerhalb des Fensters, und würden mitdrehen. Beides ist jetzt eigenes Markup
außerhalb der Karte, der Nachweis wird aus den eingeschalteten Ebenen
zusammengesetzt.

**Nicht genommen:** das Plugin `leaflet-rotate` macht dieselbe Arbeit
gründlicher, steht aber unter GPL-3.0. Dieses Projekt ist MIT; es einzubinden
würde die ganze App unter Copyleft stellen. Für zwei Koordinatentransformationen
ist das zu teuer.

Trägheits-Panning ist im Fahrtrichtungsmodus abgeschaltet: der Schwung wird aus
rohen Zeigerpositionen berechnet, die diese Korrektur nicht durchlaufen, und
würde in die falsche Richtung auslaufen. Geradliniges Ziehen ist korrigiert und
stimmt exakt.

## Der Karte folgen

Die Karte hält das Boot in der Mitte, bis sie **gezogen** wird – das ist die eine
Geste, die „ich will woanders hinsehen" heißt. Zoomen zählt nicht dazu, es
behält das Boot im Blick, also überlebt das Folgen einen Zoom. Der
Positionsknopf schaltet das Folgen wieder ein und zentriert, **ohne die
Zoomstufe anzufassen**: er heißt „zurück zu mir", nicht „fang mit einer
Zoomstufe von vorn an, die du nicht gewählt hast". Nur der allererste Fix setzt
eine Zoomstufe, danach gehört sie dem Bedienenden.

Eine Ausnahme: Während eine Zoom-Animation läuft, zentriert das Folgen nicht.
Sonst würde es auf die Zoomstufe zentrieren, die die Animation noch nicht
erreicht hat, und die Animation damit abbrechen – der Zoom fiele auf den
Ausgangswert zurück. Der nächste Fix ist eine Sekunde später da.

## Bildschirm an

Eine Navigationsanzeige, die nach 30 Sekunden dunkel wird, ist keine. Solange
die App vorn ist, hält ein `screen`-Wake-Lock das Telefon wach. Das System gibt
ihn beim Wechsel in den Hintergrund von selbst frei, es muss also nichts
zurückgegeben werden und ein Telefon in der Tasche verbraucht nichts – deshalb
die erneute Anforderung bei jedem `visibilitychange`.

Manche Browser erteilen die Sperre erst nach einer Berührung der Seite. Die
erste Ablehnung wird daher nicht gemeldet, sondern beim ersten Tap wiederholt;
erst wenn auch das scheitert, sagt die App es – dass der Bildschirm ausgehen
kann, will man vor dem Ablegen wissen, nicht danach.

## Genauigkeit und Glättung

**Geschwindigkeit.** `onPosition()` bevorzugt `speed` des Geräts und rechnet
sonst aus den letzten beiden Fixes. Geglättet wird per exponentiellem
gleitendem Mittel (α = 0,35): kostet etwas Reaktionszeit, hält die Anzeige
dafür ruhig genug zum Ablesen.

**Kurs.** Der teuerste Teil, denn hier teilt sich Rauschen durch eine kleine
Zahl. Ein GPS-Fix streut auch im Stillstand um einige Meter; ein Kurs aus zwei
Fixes im Sekundenabstand dividiert diese Streuung durch die Strecke dazwischen,
und die beträgt bei 5 kn ganze 2,5 m. Gemessen an simulierter Geradeausfahrt
mit σ = 3 m Positionsrauschen ergab das eine mittlere Kursabweichung von
**69°** und Ausreißer bis **178°** – das Boot zeigte zeitweise rückwärts.

Drei Stufen dagegen, in dieser Reihenfolge:

1. **Mindestgeschwindigkeit** (`MIN_HEADING_SPEED_MS`, 0,5 m/s ≈ 1 kn). Darunter
   gibt es keinen Kurs, der die Rechnung lohnt; der letzte bleibt stehen. Ein
   liegendes Boot zeigt weiter dorthin, wohin es zuletzt zeigte.
2. **Lange Basislinie** (`MIN_HEADING_BASELINE_M`, 12 m). Gesucht wird rückwärts
   ab dem neuesten Fix der erste, der weit genug entfernt liegt – die kürzeste
   ausreichende Strecke, also die mit dem geringsten Nachlauf. Über 12 m kippen
   dieselben drei Meter Fehler die Linie um wenige Grad statt um fünfzig.
   Langsam genug summiert selbst die ganze Historie keine 12 m; dann wird die
   längste vorhandene Strecke genommen, sofern sie 5 m überschreitet – ein
   ungenauer Kurs bei zwei Knoten kostet weniger als einer, der vor einer
   Stunde stehen geblieben ist.
3. **Zirkuläres gleitendes Mittel** (`HEADING_SMOOTHING`, α = 0,45). Winkel
   lassen sich nicht als Zahlen mitteln – 359° und 1° ergäben 180°, die
   Gegenrichtung –, deshalb läuft das Mittel über den Einheitsvektor, aus dem
   der Winkel zurückgelesen wird. Das dämpft von selbst: ein einzelner
   Ausreißer verkürzt den Vektor, statt ihn zu drehen. Kollabiert der Vektor
   ganz, weil die Messungen wirklich in alle Richtungen zeigen, beginnt er beim
   aktuellen Wert neu.

Auch der vom Gerät gemeldete Kurs läuft durch dieselbe Kette: er stammt aus
denselben verrauschten Positionen und zittert genauso.

Gemessen nach dem Umbau, gleiche simulierte Fahrt:

| Fall | mittlere Abweichung | Maximum |
| --- | --- | --- |
| vorher, 5 kn | 69,4° | 178,2° |
| nachher, 5 kn | 9,4° | 25,5° |
| nachher, 2 kn | 12,3° | 52,7° |

**Wie schnell das einschwingt, hängt daran, woher der Kurs kommt.** Meldet das
Gerät einen eigenen – der Normalfall am Telefon, und der ohne Basislinien-Lauf –
entscheidet allein α. Muss er aus Positionen abgeleitet werden, gibt die
Basislinie das Tempo vor und kein α kommt darunter. Gemessen über acht
Rauschmuster je Wert, harte Wende von 90° auf 180°, 5 kn:

| α | Gerätekurs: Einschwingen | Geradeaus Ø | abgeleitet: Einschwingen | Geradeaus Ø |
| --- | --- | --- | --- | --- |
| 0,35 | 4 s | 3,2° | 7 s | 9,8° |
| **0,45** | **3 s** | **3,6°** | **7 s** | **10,8°** |
| 0,55 | 2 s | 4,1° | 8 s | 11,8° |
| 0,80 | 1 s | 5,3° | 16 s | 14,3° |

Gewählt ist 0,45: schnell genug für ein kleines Motorboot, das in ein paar
Sekunden herum ist, und noch ruhig genug. Über 0,55 hinaus wird der abgeleitete
Kurs deutlich schlechter, weil das Filter dann dem Rauschen folgt statt es zu
glätten.

Auch die Basislinie wurde gegengeprüft: kürzer macht **beides** schlechter –
bei 8 m statt 12 m steigt die Einschwingzeit auf 13 s und die Ruhelage auf
13,6°, weil die kürzere Strecke mehr Rauschen durchlässt, das das Filter dann
wieder ausbügeln muss. Die 12 m bleiben.

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

### Kandidaten außerhalb Norwegens

Recherchiert für die Kanaren, gemessen mit `compare.html` bei 28.00902,
−16.58136 (Teneriffa Süd, z13):

| Dienst | Endpunkt | Inhalt | Lizenz |
| --- | --- | --- | --- |
| IHM (Spanien) | `ideihm.covam.es/wms/cartaENCp4`, `…p5` | Seekarte aus offizieller ENC, nach Maßstabszweck getrennt | frei einsehbar, Namensnennung „© Instituto Hidrográfico de la Marina", kommerziell vertragspflichtig; ausdrücklich **nicht zur Navigation** |
| GRAFCAN (Kanaren) | `idecan1.grafcan.es/ServicioWMS/Topobatimetrico` | durchgehendes Land-See-Modell, 2,5 m, Tiefe je Insel −65 m bis −785 m | offener IDE-Dienst, Namensnennung |
| EMODnet (Europa) | `ows.emodnet-bathymetry.eu/wms`, Ebenen `mean_multicolour`, `contours` | Tiefenmodell und Tiefenlinien, ~115 m Auflösung | CC-BY 4.0 |

**Das Messergebnis:**

| Dienst | Antwort | Befund |
| --- | --- | --- |
| Kartverket | Abdeckung nein, alle Ebenen leer | wie erwartet – außerhalb Norwegens kostenlos still |
| IHM Zweck 4 | `ENC_ES4` 100 % gezeichnet, dunkelstes Pixel 0/255; `grupo_2` 8,22 % gezeichnet, ebenfalls 0/255 | vollständige Seekarte; `grupo_2` ist deren Tinte ohne die deckende Flächenhaut aus `grupo_1` |
| IHM Zweck 5 | leer | Hafenmaßstab, hier draußen gibt es keine |
| GRAFCAN | `ServiceExceptionReport` statt Bild | Capabilities in Ordnung, GetMap abgelehnt – Grund war im gekürzten Protokoll nicht zu sehen, der Prüfstand zeigt ihn jetzt |
| EMODnet | `contours` 2,12 % gezeichnet, 0/255; `mean_multicolour` 86,41 % | Linien auf transparentem Grund, genau das Gesuchte; die Flächenvariante malt das ganze Meer zu |

Eingebaut wurde daraus `contours`. GRAFCAN liefert küstennah feineres Relief
als Kartverket, ist aber ein Geländemodell: kein Lot, kein Hindernissymbol,
kein Seezeichen – und antwortet vorerst nicht. Seezeichen brauchen ohnehin
keinen Ersatz, OpenSeaMap ist weltweit.

### Die spanische Seekarte

Zwei Entscheidungen unterscheiden diese Quelle von allen anderen.

**Nur `grupo_2`, nicht die ganze Karte.** S-57 teilt seine Objekte in zwei
Gruppen: Gruppe 1 ist die „Haut der Erde" – Land- und Wasserflächen, als
deckende Füllungen gezeichnet –, Gruppe 2 alles, was darauf liegt. Gewollt ist
hier nur die zweite; die erste würde OpenStreetMap zudecken, genau wie es die
norwegische Gruppenebene getan hat, und einen Blend-Modus kosten, um es wieder
rückgängig zu machen. Gemessen: `grupo_2` zeichnet 8,22 % der Kachel mit
dunkelstem Pixel 0/255, die ganze Karte 100 %.

Praktischer Nebeneffekt der S-57-Aufteilung: Tiefenlinien, Lotungen, Felsen,
Wracks und Hindernisse liegen alle in Gruppe 2. Was wegfällt, sind genau die
Flächen, die stören.

**Der Dienst wechselt mit dem Zoom.** Das IHM trennt seine Karten nach
Kartenzweck, jeder deckt ein Maßstabsband ab, und eine Anfrage außerhalb des
Bandes zeichnet nichts. Da `url(z, x, y)` den Zoom kennt, wählt die Quelle den
passenden Zweck selbst – eine Ebene, keine drei:

| Zoom | Maßstab bei 28° N | Zweck | Band |
| --- | --- | --- | --- |
| ≤ z12 | 1:121k | `cartaENCp3` | 1:90k – 1:350k |
| z13–z14 | 1:60k / 1:30k | `cartaENCp4` | 1:22k – 1:90k |
| ≥ z15 | 1:15k | `cartaENCp5` | 1:4k – 1:22k |

Die Maßstäbe sind für eine 256-Pixel-Kachel und die OGC-Pixelgröße gerechnet.
Daraus folgt auch, warum hier **nicht** überabgetastet wird: ein größeres Bild
über derselben Box halbiert den Maßstabsnenner, den der Server berechnet – und
dieser Dienst lässt dann ganze Karteninhalte weg. Dieselbe Falle wie
`MAP_RESOLUTION` bei Kartverket, nur von der anderen Seite.

Zweck 4 und 5 sind gemessen, Zweck 3 folgt demselben Muster, ist aber noch
nicht antwortend gesehen worden – der Prüfstand fragt ihn jetzt mit ab.

### Der Prüfstand

`compare.html` beantwortet die vier Fragen, die vor dem Einbau einer Quelle
offen sind und sich aus keiner Dokumentation beantworten lassen:

1. **Antwortet der Dienst diesem Browser?** Ein Dienst ohne CORS-Header lässt
   sich anzeigen – die App fällt auf ein einfaches `<img>` zurück –, seine
   Kacheln aber nie offline speichern. Der Prüfstand unterscheidet beides,
   indem er nach einem gescheiterten `fetch` dieselbe URL als Bild lädt.
2. **Wie heißen die Ebenen?** Ein WMS weist die ganze GetMap-Anfrage zurück,
   sobald ein Layername unbekannt ist, und die Namen stehen nirgends außer in
   den Capabilities. Die werden deshalb gelesen und ausgewertet – auch
   namenlose Gruppenebenen, die sich nicht anfordern lassen, werden dabei
   aussortiert.
3. **Deckt er diese Stelle ab?** Die angegebene Bounding Box beantwortet das,
   bevor eine einzige Kachel geholt wird. Ebenso, ob EPSG:3857 dabei ist –
   GRAFCAN rechnet nativ in UTM 28N.
4. **Zeichnet er hier etwas, und mit welchem Kontrast?** Pixelweise, wie in
   B8: Anteil gezeichneter Pixel, dunkelste Helligkeit, Farbanzahl, dazu die
   Kachel vergrößert über Schachbrett.

Voreingestellte Orte (Bergen, Las Palmas, Teneriffa Süd) machen den Vergleich
zwischen den Revieren möglich, ohne hinzufahren.

## Andere Schiffe (AIS): recherchiert, nicht gebaut

Gewünscht ist eine abschaltbare Ebene mit anderen Schiffen, antippbar für
Kurs, Geschwindigkeit und Zielhafen – aus frei zugänglichen Quellen. Die
Recherche ist gemacht, gebaut ist nichts. Der Grund steht in den drei Sätzen,
an denen jede Quelle scheitert oder nicht scheitert:

1. **Keine Server-Komponente.** Die App liegt als statische Dateien auf GitHub
   Pages. Es gibt niemanden, der eine Verbindung offen hält oder einen
   Schlüssel verwahrt.
2. **Kein Geheimnis im Repository.** Was im Quelltext steht, steht öffentlich.
   Ein API-Schlüssel im Frontend ist kein Schlüssel mehr.
3. **Jede Gegenstelle braucht CORS und einen CSP-Eintrag.** Kartenkacheln
   dürfen zur Not ohne CORS als `<img>` kommen; Positionsdaten nicht, die
   müssen durch `fetch` oder WebSocket, und beides prüft der Browser.

### Was es gibt

| Quelle | Zugang | Revier | Befund |
| --- | --- | --- | --- |
| aisstream.io | WebSocket, kostenloser Schlüssel nach Anmeldung | weltweit | Die Bedingungen untersagen die direkte Browserverbindung ausdrücklich: „Direct browser connections are not permitted. Connect from your own server and proxy only the information your clients need." Dazu läge der Schlüssel öffentlich im Repo. **Scheidet aus** |
| BarentsWatch / Kystverket | REST und Server-Sent-Events, OAuth `client_credentials` über `id.barentswatch.no/connect/token`, `scope=ais` | norwegische Wirtschaftszone samt Svalbard und Jan Mayen | Die Daten selbst sind frei (NLOD), aber ein Client muss registriert werden, und selbst registrierte Clients können nur `client_credentials` – also Client-Secret, also nicht im Frontend. Ohne Fischereifahrzeuge unter 15 m und Freizeitboote unter 45 m. **Nur mit Proxy** |
| Digitraffic (Fintraffic) | REST ohne Schlüssel (`meri.digitraffic.fi/api/ais/v1/locations`, `…/vessels`), zusätzlich MQTT über WebSocket; erbeten wird nur ein `Digitraffic-User`-Header | nur finnische Gewässer | Genau die gesuchte Bauform, freundlich zum Browser – aber das falsche Revier, weder Bergen noch die Kanaren |
| AISHub | HTTP-Webservice mit Nutzernamen | weltweit | Zugang nur im Tausch: eigene Empfängerstation, die im 7-Tage-Mittel mindestens 10 Schiffe sieht und zu 90 % läuft. Die Zugangsdaten wären wieder ein Geheimnis |
| Danish Maritime Authority | CSV-Archive über `web.ais.dk` | dänische Gewässer | Historische Aufzeichnungen, kein Live-Bild |
| Kystdatahuset | offener WMS | Norwegen | Verkehrsdichteraster von 2011 – Wege, keine Schiffe |
| Eigener AIS-Empfänger an Bord | NMEA über WLAN, `http://` im lokalen Netz | Sichtweite, ~20 sm | Von einer über HTTPS ausgelieferten Seite nicht erreichbar: Mixed Content, dazu Chromes Private Network Access. Ginge nur mit einem im Telefon gültigen Zertifikat für das Bordnetz |
| MarineTraffic, VesselFinder | öffentliche Schiffsseiten je MMSI | weltweit | Als **Ziel** eines Antippens brauchbar – das ist ein Link, keine Datenabfrage. Die Kartendaten selbst sind kostenpflichtig |

Das Muster ist überall dasselbe: die Daten sind frei, der *Zugang* ist es
nicht. Wer AIS weltweit ausliefert, will wissen, wer fragt, und knüpft das an
einen Schlüssel – und ein Schlüssel setzt genau die Server-Komponente voraus,
die diese App bewusst nicht hat.

### Drei mögliche Wege

**Weg A – verlinken statt zeichnen.** Keine Schiffe auf der eigenen Karte,
aber ein Knopf, der den aktuellen Ausschnitt in einer öffentlichen AIS-Karte
öffnet. Kostet nichts, braucht keinen Schlüssel und keinen CSP-Eintrag, weil
nichts geladen wird – es wird nur verlassen. **Das ist der gewählte Weg**,
siehe unten.

**Weg B – echte Ebene über einen eigenen Relay.** Ein winziger, lesender
Vermittler (Cloudflare Worker o. ä.) hält den Schlüssel, spricht mit
BarentsWatch oder aisstream, filtert auf die angefragte Bounding Box und
antwortet mit CORS-Header. Erst damit ist die Ebene baubar – und erst damit
hat die App eine Server-Komponente, einen laufenden Hostnamen, eine
Betriebsverantwortung und eine Stelle, an der Positionsanfragen sichtbar
werden. Das ist keine technische, sondern eine Grundsatzentscheidung; alles,
was `features.md` unter „Offline-first" und „Datensparsam" führt, steht daran.

**Weg C – Digitraffic als Prototyp.** Die finnische Quelle lässt sich ohne
Proxy, ohne Schlüssel und ohne Geheimnis einbinden. Damit ließe sich die
ganze Ebene fertig bauen und ausprobieren, nur eben in der Ostsee wirksam;
Weg B wäre danach ein Quellenwechsel, kein Neubau.

### Gebaut: der Sprungknopf (Weg A)

Nachgeschärfte Anforderung: **weltweit**, nicht ein Land; Sportboote sind
egal; genutzt wird es auch an Land, wenn die Kinder wissen wollen, was da
draußen fährt. Damit fällt der ganze Zielkonflikt weg – gebraucht wird kein
Live-Layer, sondern ein Knopf, der den aktuellen Ausschnitt in einer
öffentlichen AIS-Karte öffnet.

**Welche Seite?** In Frage kommt, was die Position im Link entgegennimmt, die
Karte ohne Anmeldung zeigt und weltweit empfängt:

| Seite | Link mit Position | Ohne Anmeldung | Auf dem Telefon |
| --- | --- | --- | --- |
| **MarineTraffic** | `…/en/ais/home/centerx:<lon>/centery:<lat>/zoom:<z>`, Zoom 2–17 | Karte frei, ein Teil der Detailfelder erst nach Anmeldung | schwer: Cookie-Banner und App-Hinweis vor der Karte – **aber die Adresse trägt den Ausschnitt**, gemessen am Gerät |
| **VesselFinder** | Website: **gar keine**; `…/aismap?lat=&lon=&zoom=` ist die Einbettungs-Karte | Karte und Schiffsdetails frei, meist mit Foto | die leichteste Seite, als Sprungziel dennoch untauglich |
| **MyShipTracking** | `…/?lat=<lat>&lng=<lon>&zoom=<z>` – ungeprüft, dieselbe Form wie bei VesselFinder und damit verdächtig | Karte frei | dazwischen |

Eingebaut war zuerst **VesselFinder** – und das war falsch. Am Gerät zeigte
sich, was aus keiner Dokumentation hervorging: die Website liest `lat/lon/zoom`
nicht. Diese Parameter gehören ihrer **Einbettungs**-Karte unter `/aismap`.
Ihre Website hält ihren Ausschnitt überhaupt nicht in der Adresse; sie öffnet
dort, wo der Browser sie zuletzt verlassen hat. Siehe B10 in `bugs.md`.

Eingebaut ist seit 0.22.1 **MarineTraffic**:

```
https://www.marinetraffic.com/en/ais/home/centerx:<lon>/centery:<lat>/zoom:<z>
```

Pfadsegmente statt Parameter, `centerx` ist die Länge, Zoom 2–17. Der
Unterschied zur ersten Wahl ist nicht die Quelle der Adressform, sondern ihre
Art: **diese Form erzeugt die Zielseite selbst**, während man auf ihr
navigiert. Genau das ist das Prüfkriterium, und es kostet keinen Code – die
Karte der Zielseite verschieben und sehen, ob die Adresse mitwandert. Tut sie
es nicht, gibt es dort keinen Sprungpunkt, gleichgültig was in einer
Einbettungs-Anleitung steht.

Gemessen ist alles diesseits der Landesgrenze dieser Umgebung – die Hosts
selbst sind hier gesperrt: dass der Link der Karte folgt (z14 → z10 → am
oberen Anschlag z17 statt der 19 der eigenen Karte), dass er ohne Netz nicht
springt, sondern eine Meldung zeigt, und dass er danach wieder zurückfindet.

Seit 0.23.0 steht **VesselFinder als zweiter, leiserer Knopf daneben** – zum
Vergleichen, nicht als Notnagel. Verlinkt ist dort die Einbettungs-Karte, der
einzige Teil dieser Seite, der eine Position liest:

```
https://www.vesselfinder.com/aismap?zoom=<z>&lat=<lat>&lon=<lon>&names=true
```

Die beiden sehen einander nicht ähnlich: MarineTraffic ist die volle Seite
mit Cookie-Banner und App-Hinweis, VesselFinder die nackte Karte ohne alles.
Sie speisen sich außerdem aus verschiedenen Empfängernetzen, zeigen also nicht
zwingend dieselben Schiffe. Welcher bleibt, entscheidet der Gebrauch; die
Ziele stehen als Tabelle `AIS_MAPS` in `js/app.js`, ein weiterer ist eine
Zeile dort plus ein `<a data-ais="…">` im Ebenenmenü.

Ein Vorbehalt bleibt bei der Einbettungs-Karte: `width`/`height` gehen als
`100%` mit, und ein Prozentzeichen muss in einer Adresse als `%25` kodiert
sein. Ob die Seite das wieder dekodiert, ist von hier aus nicht prüfbar –
sitzt die Karte schief, sind es diese beiden Parameter.

**Rechtlich unkritisch:** ein gewöhnlicher Hyperlink auf eine öffentliche Seite
ist etwas anderes als das, was die Anbieter einschränken – nämlich das
Einbetten per iframe und das automatisierte Abgreifen der Daten. Beides
passiert hier nicht.

**Technisch klein**, umgesetzt in `js/app.js` als `wireAisLink()`:

- **Kein CSP-Eintrag nötig.** Die Richtlinie dieser App beschränkt das *Laden*
  von Ressourcen, nicht das *Navigieren*. Der Sprung lädt nichts nach, er
  verlässt die Seite.
- **`target="_blank"` mit `rel="noopener noreferrer"`.** In der installierten
  App öffnet Android eine Custom Tab mit Zurück-Pfeil; SeaGlimpse bleibt
  dahinter stehen und ist samt Zoom, Ziel und Kurs sofort wieder da.
- **Übergeben wird die Kartenmitte und der aktuelle Zoom**, begrenzt auf das
  Band der Zielseite (2–17). Im Folgemodus ist die Mitte die eigene Position –
  der Ausschnitt drüben passt also zu dem, was man gerade sieht. Die Adresse
  hängt an `moveend` und `zoomend` und ist deshalb auch dann aktuell, wenn man
  sie lange drückt und kopiert, statt sie anzutippen.
- **Ohne Netz nutzlos**, und das muss der Eintrag sagen statt ins Leere zu
  springen: bei `navigator.onLine === false` bleibt er inaktiv mit Hinweis.
- **Platz:** ein Eintrag im Ebenenmenü, unter einem Trennstrich hinter den
  Schaltern, kein fünfter Knopf. Die Knopfleiste ist mit vier Knöpfen voll,
  und der Sprung ist ja gerade der Ersatz für die Ebene, die es nicht geben
  kann. Ein `<a>` und kein `<button>`: es ist eine Adresse, und dann soll sie
  sich auch wie eine verhalten.

**Ein Zugeständnis, das benannt gehört.** `features.md` verspricht unter
„Datensparsam": keine Übertragung von Positionsdaten. Ein Sprung mit
Koordinaten im Link ist genau das – einmalig, an einen Fremdanbieter. Es
passiert ausschließlich auf ausdrückliches Antippen, nie im Hintergrund und
nie ohne Zutun; `rel="noreferrer"` hält zusätzlich zurück, von welcher Seite
der Sprung kam. Das Versprechen bekommt damit eine Ausnahme, und die steht
hier, statt in der Beschreibung stillschweigend zu verschwinden.

### Wie die Ebene aussähe, wenn sie gebaut wird

Gilt für Weg B oder C, falls die Frage je zurückkommt.

- **Keine Kachelquelle.** `sources.js` bleibt unberührt: Positionen sind keine
  Bilder. Die Ebene wäre eine eigene Datei `js/ais.js` mit einer
  Leaflet-`LayerGroup` und einem Eintrag im Ebenenmenü wie F15.
- **Nichts davon in den Kachelspeicher.** Positionen sind Sekundenware; der
  IndexedDB-Cache existiert für Karten, die offline gelten. Ohne Netz zeigt
  die Ebene nichts an – und sagt das auch.
- **Abfrage an der Bounding Box**, gedrosselt beim Verschieben, danach etwa
  alle 30 s; Marker als gedrehte Pfeile, die sich wie das Bootssymbol gegen
  die Kartendrehung zurückdrehen müssen, Farbe nach Schiffstyp.
- **Antippen öffnet eine Karte** mit Name, MMSI, Kurs, Geschwindigkeit und –
  falls die Quelle sie führt – Zielhafen, dazu einen Link auf die öffentliche
  Schiffsseite bei MarineTraffic oder VesselFinder.
- **CSP:** die neue Gegenstelle in `connect-src`, sonst nichts.

### Was dabei ehrlich dazugehört

AIS zeigt nicht alle Schiffe. Kleine Freizeitboote senden meist gar nicht,
Norwegen filtert Fischerei unter 15 m und Freizeit unter 45 m ausdrücklich
heraus, und terrestrisch empfangene Positionen sind je nach Netz Minuten alt.
Eine Schiffsebene in dieser App wäre also dasselbe wie die Seekarte hier: ein
Blick, keine Grundlage für eine Entscheidung. Der Hinweis in der Fußzeile gilt
unverändert – und für diese Ebene besonders.

## Die Fußzeile trägt den Haftungshinweis

Eine Warnung, die in einer readme steht, hat niemand gelesen, wenn es darauf
ankommt. „Kein Navigationssystem – ersetzt Seekarte und Ausrüstung nicht" steht
deshalb dauerhaft auf dem Bildschirm, in Warnfarbe und eine Spur größer als das
Impressum darunter: groß genug zum Erfassen, klein genug, um der Karte nicht
den Platz streitig zu machen.

Kartennachweis, Hinweis und Impressum bilden **eine** Leiste am unteren Rand.
Vorher lagen Nachweis und Fußzeile getrennt übereinander, jeder mit eigenem
Abstand vom unteren Rand – und beim ersten längeren Nachweis schoben sie sich
ineinander. In einer Leiste kann das nicht passieren.

Wie hoch diese Leiste ist, hängt vom Umbruch ihrer drei Zeilen ab, und der
hängt am Gerät, an der eingestellten Schriftgröße und daran, wie viele
Kartenebenen eingeschaltet sind. `fitControlsAboveFooter()` misst sie deshalb
und setzt `--controls-bottom` danach, statt eine Konstante zu raten, die auf
irgendeinem Telefon falsch ist. Gemessen wird beim Start, bei jeder
Größenänderung und bei jedem Ebenenwechsel.

Leaflet steht nicht im Nachweis: BSD-2 verlangt den Vermerk in der Verteilung,
nicht auf dem Bildschirm, und er steht in `THIRD_PARTY_LICENSES.md`. Die
Kartendienste stehen dort, weil ihre Lizenzen es verlangen.

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
