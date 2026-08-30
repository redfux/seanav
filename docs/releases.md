# Releases

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

Die Versionsnummer wird ausschließlich in `js/version.js` gepflegt; Footer und
Service-Worker-Cachename leiten sich automatisch daraus ab.

## [0.22.0] – 2026-08-30

### Added

- **„Schiffe in der Nähe"** im Ebenenmenü: ein Link, der den gezeigten
  Ausschnitt – Kartenmitte und Zoom – bei VesselFinder öffnet. Dort stehen
  Name, Typ, Kurs, Geschwindigkeit und Zielhafen ohne Anmeldung.
- Ohne Empfang springt er nicht ins Leere, sondern sagt es: der Eintrag
  blasst ab, der Hinweistext wechselt, ein Tippen bringt eine Meldung.
- Kein neuer CSP-Eintrag und kein Schlüssel – ein Link lädt nichts nach. Die
  Kartenmitte geht dabei einmalig an den Fremdanbieter; das ist die einzige
  Ausnahme von „keine Übertragung von Positionsdaten" und steht so in
  `features.md`.

## [0.21.2] – 2026-08-30

### Changed

- **Der AIS-Plan ist entschieden:** Weg A, ein Sprungknopf in eine
  öffentliche AIS-Karte, weil die Anforderung weltweit gilt und Sportboote
  ohnehin nicht gebraucht werden. In `architecture.md` steht jetzt der
  Vergleich der drei verlinkbaren Seiten samt Linkform, dazu Platzierung,
  Verhalten ohne Netz und das benannte Zugeständnis an „Datensparsam".
  Weiterhin kein Code – der Wunsch war ausdrücklich „noch nicht umsetzen".

## [0.21.1] – 2026-08-30

### Added

- **Recherche zu einer AIS-Ebene** in `architecture.md`: Vergleich von acht
  Quellen (aisstream, BarentsWatch/Kystverket, Digitraffic, AISHub, DMA,
  Kystdatahuset, eigener Empfänger an Bord, MarineTraffic/VesselFinder),
  drei mögliche Wege und der Entwurf der Ebene. Kein Code – der Wunsch war
  ausdrücklich „nur recherchieren und planen". Als O14 in `features.md`.

## [0.21.0] – 2026-08-26

### Changed

- **Der Kurs schwingt schneller ein.** `HEADING_SMOOTHING` steht auf 0,45 statt
  0,35. Gemessen über acht Rauschmuster je Wert: meldet das Gerät einen eigenen
  Kurs – der Normalfall am Telefon –, ist eine Wende von 90° auf 180° damit
  nach **3 s** auf ±10° eingeschwungen statt nach 4 s, bei 3,6° statt 3,2°
  mittlerer Abweichung im Geradeauslauf. Im Code nachgemessen: 3 s.
- **Ohne Gerätekurs bleibt es bei 7 s**, und das ist keine Einstellungssache:
  dort gibt die 12-Meter-Basislinie das Tempo vor. Ein größeres α macht es
  schlechter (0,8 → 16 s), eine kürzere Basislinie ebenfalls (8 m → 13 s bei
  13,6° Ruhelage), weil beides mehr Rauschen durchlässt, als es an Aktualität
  gewinnt. Die Messreihen stehen in `architecture.md`.
- **Der Schalter unten rechts blendet jetzt die ganze Kurslinie aus**, nicht
  nur die Zahlen daran. Die Linie ist eine Projektion wie die Marken auf ihr;
  eine Linie ohne ihre Werte war ein halber Zustand.

## [0.20.1] – 2026-08-26

### Fixed

- **Das Boot drehte sich bei Geradeausfahrt.** Der Kurs kam aus der Peilung
  zwischen den letzten beiden Fixes, und der gemeldete Gerätekurs wurde
  ungeglättet übernommen. Ein GPS-Fix streut um einige Meter, bei 5 kn liegen
  zwei Fixes 2,5 m auseinander – der Fehler war so groß wie die Strecke.
  Nachgerechnet an simulierter Geradeausfahrt (90°, 5 kn, σ = 3 m): mittlere
  Abweichung **69,4°**, Ausreißer bis **178,2°**, das Boot zeigte zeitweise
  rückwärts.
- Der Kurs entsteht jetzt aus einer Basislinie von mindestens 12 m statt aus
  zwei benachbarten Fixes, wird unterhalb von 0,5 m/s gar nicht mehr
  angefasst – ein liegendes Boot zeigt weiter dorthin, wohin es zuletzt zeigte
  – und läuft anschließend durch ein **zirkuläres** gleitendes Mittel, das
  über den Einheitsvektor rechnet und deshalb am Nulldurchgang nicht kippt.
  Der Gerätekurs geht denselben Weg; er stammt aus denselben verrauschten
  Positionen.
- Dieselbe simulierte Fahrt danach: **9,4°** mittlere Abweichung, Maximum
  **25,5°**. Bei 2 kn, wo die Basislinie nicht mehr voll zusammenkommt und die
  längste vorhandene genommen wird: 12,3° und 52,7°.
- Der Preis ist Nachlauf: eine harte Wende von 90° auf 180° ist nach **9 s**
  auf ±10° eingeschwungen. Für ein Boot der richtige Tausch – eine echte Wende
  dauert länger als die Anzeige.
- Die Fix-Historie ist von 6 auf 15 Einträge gewachsen, damit die Basislinie
  auch bei langsamer Fahrt zusammenkommt. Die Geschwindigkeit schaut wie bisher
  nur auf die letzten beiden.

## [0.20.0] – 2026-08-25

### Added

- **Vollbild auf Knopfdruck**, als Schalter in der Ecke der Fußleiste. Anlass
  war die weiße Systemleiste unten: sie allein ausblenden geht nicht – die
  Fullscreen-API nimmt beide Leisten oder keine, und Androids selektiven
  Immersive-Modus erreicht eine Webseite nicht. Statt das im Manifest
  festzuschreiben (`display: fullscreen` kostete Uhr und Akkustand) steht der
  Tausch jetzt zur Wahl: normal laufen die Systemleisten mit, ein Tipp gibt den
  ganzen Bildschirm.
- Der Knopf erscheint nur, wo `document.fullscreenEnabled` es zulässt – iOS
  gibt Vollbild allein an Video-Elemente. Beim Wechsel ändern sich die
  Safe-Area-Ränder, deshalb werden Leistenhöhe und Kartengröße danach neu
  vermessen.

## [0.19.2] – 2026-08-25

### Changed

- `theme-color` steht jetzt zusätzlich mit `media`-Varianten für
  `prefers-color-scheme` (hell wie dunkel) und `display-mode: standalone` im
  Kopf. Manche Chrome-Versionen ziehen diese Angaben für die Systemleisten der
  installierten App heran; alle Varianten tragen dieselbe Farbe wie die
  Fußleiste.

### Hinweis

- **Die untere Systemleiste von Android färbt Chrome in einer installierten
  App selbst**, nicht die Seite. Es gibt weder im Manifest noch in CSS eine
  Angabe, die sie zuverlässig setzt; im Browser sieht es richtig aus, weil
  Chrome die Leiste dort nach der Seite einfärbt. Sie ist mit 0.19.0
  überhaupt erst aufgetaucht: `display: fullscreen` blendete beide
  Systemleisten aus, `standalone` bringt beide zurück. Bleibt sie hell, hilft
  nur Chromes eigenes Design (Einstellungen → Design → Dunkel). Angelegt ist
  seitens der App alles, was greifen kann – `color-scheme: dark`, dunkler
  `html`-Hintergrund bis unter die Systemleisten, `viewport-fit=cover`,
  `theme-color` in allen Varianten.

## [0.19.1] – 2026-08-25

### Fixed

Durchgang durch die gesamte Dokumentation. Was nicht mehr stimmte:

- **`architecture.md` behauptete, die CSP lasse nur `cache.kartverket.no` zu.**
  Diesen Host verwendet die App seit 0.6.0 nicht mehr; erlaubt sind die fünf
  Kachel-Hosts der heutigen Ebenen. Eine falsche Sicherheitsaussage ist die
  unangenehmste Sorte veralteter Doku.
- **`architecture.md` behauptete „kein `innerHTML`".** Das stimmt seit dem
  Kartennachweis nicht mehr, der die Attributionstexte aus `js/sources.js`
  zusammensetzt. Jetzt steht dort, was tatsächlich gilt: `innerHTML` nur aus
  eigenen Konstanten, alles von außen über `textContent`, und auf der
  Wartungsseite escaped.
- `readme.md`: Abschnitt hieß „Navigation", Geschwindigkeit stand als „in
  Knoten" fest, die Liste der ausgehenden Verbindungen kannte EMODnet und IHM
  nicht, die Tabelle der Speicherschlüssel weder Kartenausrichtung noch
  Geschwindigkeitseinheit.
- `features.md`: F1 beschrieb die 0.6.0 entfernte Rasterkarte als vorhanden;
  F2 und F4 waren überholt; die Tabellen waren durch das Anhängen neuer Zeilen
  aus der Ordnung geraten und sind jetzt wieder nach Nummer sortiert.

### Removed

- **`diagnose.html` und `js/diagnose.js`.** Die Seite prüfte den
  Kartverket-WMTS, den die App seit 0.6.0 nicht mehr verwendet – ihre eigene
  Beschreibung in der readme sagte, sie könne weg, sobald B1/B2 geklärt sind,
  und das sind sie. `compare.html` ist die Nachfolgerin.

## [0.19.0] – 2026-08-25

### Changed

- **Die App heißt SeaGlimpse.** „SeeNavi" hat behauptet, was sie ausdrücklich
  nicht ist – ein Navigationssystem. Umbenannt sind Manifest (`name`,
  `short_name`, Beschreibung), Seitentitel, iOS-App-Titel, Installationshinweis
  und Fußzeile, dazu `readme.md` und die Wartungsseiten. Der Ordnername im
  Repository bleibt `seanav`: er steckt in der Adresse der installierten App.
- Die Speicherschlüssel behalten ihr altes Präfix (`seenavi-tiles`,
  `seenavi.*`). Sie sind unsichtbar, und ein Umbenennen würde Kachelspeicher
  und Einstellungen wegwerfen.

### Added

- **Der Haftungshinweis steht jetzt dauerhaft in der App**, nicht nur in der
  readme: „Kein Navigationssystem – ersetzt Seekarte und Ausrüstung nicht", in
  Warnfarbe über dem Impressum. Eine Warnung, die in einer readme steht, hat
  niemand gelesen, wenn es darauf ankommt.

### Fixed

- Kartennachweis und Fußzeile bilden eine Leiste statt zweier getrennt
  positionierter Zeilen – mit fünf Kartenebenen wurde der Nachweis so lang,
  dass er sich über die Fußzeile schob.
- Die Schaltflächen richten sich nach der **gemessenen** Höhe dieser Leiste,
  statt nach einer Konstanten: wie hoch sie ist, hängt vom Umbruch ab und der
  vom Gerät, von der Schriftgröße und von der Zahl eingeschalteter Ebenen.
  Gemessen wird beim Start, bei Größenänderung und bei jedem Ebenenwechsel.
- Leaflet steht nicht mehr im Nachweis auf dem Bildschirm: BSD-2 verlangt den
  Vermerk in der Verteilung, und dort steht er (`THIRD_PARTY_LICENSES.md`).
  Das spart der Karte eine Zeile.

## [0.18.0] – 2026-08-25

### Added

- **Die offizielle spanische Seekarte als Ebene** (IHM, ENC-gerendert):
  Lotungen, Felsen, Wracks, Hindernisse und Tiefenlinien für spanische
  Gewässer, Kanaren eingeschlossen.
- Angefordert wird gezielt der Sublayer `grupo_2`, nicht die ganze Karte. S-57
  trennt „Haut der Erde" (Gruppe 1: Land- und Wasserflächen als deckende
  Füllungen) von allem, was darauf liegt (Gruppe 2). Nur die zweite ist
  gewollt – die erste würde OpenStreetMap zudecken, wie es die norwegische
  Gruppenebene getan hat. Gemessen: 8,22 % gezeichnet, dunkelstes Pixel 0/255,
  gegen 100 % bei der vollständigen Karte. Die Ebene braucht dadurch weder
  Blend-Modus noch Filter.
- **Der Kartenzweck folgt dem Zoom.** Das IHM trennt nach Maßstabsbändern, und
  außerhalb seines Bandes zeichnet ein Zweck nichts. Da die URL-Funktion den
  Zoom kennt, wählt die Quelle selbst: ≤ z12 Zweck 3, z13–z14 Zweck 4, ab z15
  Zweck 5. Eine Ebene statt drei, ohne Mehrverkehr.
- Der Prüfstand fragt jetzt zusätzlich Zweck 3 ab – das einzige Band, das noch
  nicht antwortend gesehen wurde –, und prüft bei allen IHM-Diensten dieselbe
  Ebene, die die App anfordert.

### Hinweis

- Das IHM weist darauf hin, dass seine Dienste **nicht zur Navigation**
  bestimmt sind, und verlangt die Nennung „© Instituto Hidrográfico de la
  Marina". Beides ändert nichts am ohnehin geltenden Haftungshinweis der App;
  der Nachweis steht in der Fußzeile.

## [0.17.0] – 2026-08-25

### Added

- **Tiefenlinien für europäische Gewässer** aus dem EMODnet-Bathymetry-WMS
  (Ebene `contours`, CC-BY 4.0). Damit haben Kanaren und Mittelmeer
  Tiefenlinien, ohne dass beim Revierwechsel etwas getauscht werden müsste –
  außerhalb der Abdeckung zeichnet die Ebene wie alle anderen einfach nichts.
  Gemessen bei 28.00902, −16.58136 (Teneriffa Süd, z13): 2,12 % der Kachel
  gezeichnet, dunkelstes Pixel 0 von 255, also schwarze Linien auf
  transparentem Grund – die Ebene braucht deshalb weder Blend-Modus noch
  Filter. Angefragt wird in Kachelgröße statt überabgetastet, damit die Linien
  die Stärke behalten, für die der Dienst sie zeichnet; ab z15 skaliert
  Leaflet die letzte echte Kachel, denn die Quelle löst nur rund 115 m auf.
  Die farbig flächige Variante desselben Dienstes ist bewusst nicht dabei: sie
  malt das ganze Meer zu.

### Changed

- Der Prüfstand zeigt jetzt, was ein abgelehnter GetMap **begründet**: Der
  `ServiceExceptionReport` wird ausgewertet und Code samt Meldung
  ausgeschrieben, statt die ersten 220 Zeichen XML-Schema-Kopf zu zeigen. Beim
  GRAFCAN-Dienst war genau das der blinde Fleck.
- Ebenen, die ein Dienst mit Präfix führt (`emodnet:contours`), aber ohne
  akzeptiert, werden nicht mehr als „in den Capabilities nicht gefunden"
  gemeldet, sondern mit ihrem echten Namen.

## [0.16.2] – 2026-08-25

### Changed

- **`compare.html` ist vom Tiefendaten-Test zum Dienste-Prüfstand geworden.**
  Geprüft werden jetzt mehrere Dienste nacheinander – Kartverket, IHM Zweck 4
  und 5, GRAFCAN Topobathymetrie, EMODnet – und pro Dienst vier Dinge, die
  sich aus keiner Dokumentation beantworten lassen: ob er diesem Browser
  antwortet (mit CORS oder nur als Bild), wie seine Ebenen heißen (aus den
  Capabilities gelesen), ob er die Stelle laut eigener Bounding Box abdeckt
  und EPSG:3857 kann, und was er dort tatsächlich zeichnet (pixelweise wie
  bisher).
- Voreingestellte Orte – Bergen, Las Palmas, Teneriffa Süd – damit sich die
  Reviere vergleichen lassen, ohne hinzufahren.
- Fremde Antworten werden beim Protokollieren escaped: der Text kommt von
  einem fremden Server.

## [0.16.1] – 2026-08-24

### Changed

- **Fahrzeiten über einer Stunde stehen als Viertelstunden**, in ETA und an den
  Marken gleichermaßen: „1,5 h" statt „95 min", „1,25 h" statt „73 min". Nie
  krumm – gerundet wird auf 15 Minuten, volle Stunden ohne Nachkommastelle.
  Genauer wäre die Angabe auch nicht: sie rechnet die aktuelle Geschwindigkeit
  auf Stunden hoch.

## [0.16.0] – 2026-08-24

### Added

- **Marken bei 5 km und 10 km.** Die Leiter reicht damit von 200 m bis 10 km,
  und welche Sprossen zu sehen sind, entscheidet weiter der Ausschnitt: nahe
  Marken fallen weg, sobald sie auf dem Bildschirm zusammenrücken, ferne,
  sobald sie aus dem Bild laufen. Gemessen bei Kurs 0°: z16 nur 200 m, z14
  200 m/500 m/1 km, z12 1 km/5 km, z11 und z10 5 km/10 km, z9 5 km. Es wird
  dafür nirgends eine Zoomstufe abgefragt – die beiden bestehenden Regeln
  greifen von entgegengesetzten Seiten.

### Changed

- **Die Linie zum Ziel ist magenta statt türkis**, auf derselben hellen
  Unterlinie wie die Kurslinie. Türkis auf Meerblau war in der Sonne kaum zu
  sehen; schwarz konnte sie nicht werden, weil zwei schwarze Linien vom selben
  Boot nur noch am Strichmuster auseinanderzuhalten wären. Magenta ist die
  Farbe, in der auf einer Seekarte ein von Hand gelegter Kurs steht.

## [0.15.0] – 2026-08-24

### Changed

- **Die Kurslinie ist schwarz statt orange.** Gegen das Blau der Seeflächen
  hatte Orange bei praller Sonne zu wenig Kontrast. Schwarz hat den größten
  Kontrast gegen eine helle Karte, und damit es über dunklem Grund nicht
  seinerseits verschwindet, liegt es auf einer hellen Unterlinie – wie eine
  Richtfeuerlinie auf der Seekarte gezeichnet ist. Die Marken tragen dieselbe
  Paarung: schwarze Punkte mit hellem Ring.
- **Dritte Marke bei 1 km**, die Linie reicht entsprechend weiter (1150 m, wie
  bisher knapp über die äußerste Marke hinaus). Die Beschriftung steht dort als
  „1 km" statt „1000 m".

## [0.14.1] – 2026-08-24

### Fixed

- **Die drei Werte der Zielkarte stehen jetzt sauber untereinander.** Distanz,
  ETA und Peilung teilen sich eine Labelspalte und eine gemeinsame rechte
  Kante, und der Zeilenabstand ist überall derselbe. Vorher verkürzte der
  Aufklapppfeil nur die beiden Kopfzeilen, sodass deren Werte weiter links
  endeten als die Peilung darunter; der Pfeil sitzt jetzt in einem eigenen
  Streifen am Rand, außerhalb des Textflusses.

## [0.14.0] – 2026-08-24

### Changed

- **Position und Kartenausrichtung liegen auf einem Knopf**, wie auf dem
  Telefon üblich: Der erste Tipp holt das Boot zurück in die Mitte, jeder
  weitere wechselt zwischen Nordung und Fahrtrichtung. Der eigene
  Ausrichtungsknopf entfällt damit, die Knopfleiste ist einen Platz kürzer und
  gibt der Karte den frei.
- Das Symbol zeigt, was der nächste Tipp tut: ein **Fadenkreuz**, solange das
  Boot zurückzuholen ist, ein **Kompass**, sobald die Karte folgt – mit N über
  der stehenden Nadel in der Nordung, ohne N und mitdrehend im
  Fahrtrichtungsmodus.
- Eine von Hand gedrehte Karte zählt als „weg": derselbe Tipp stellt sie
  gerade und zentriert, statt sie in einem Winkel stehen zu lassen.

## [0.13.0] – 2026-08-24

### Added

- **Die Karte lässt sich mit zwei Fingern drehen.** Es ist dieselbe Geste, die
  auch zoomt: Leaflet liest den Abstand der Finger, SeeNavi ihren Winkel. Ab
  12 Grad zählt die Drehung, damit eine Kneifbewegung mit leichtem Drall die
  Karte nicht verstellt; nahe Norden losgelassen, rastet sie auf genau Norden
  ein. Ein Griff in die Karte beendet den Fahrtrichtungsmodus – sie bleibt
  dann stehen, wo sie hingelegt wurde, und ein Tipp auf den Kompassknopf
  richtet sie wieder nach Norden aus. Von Hand gedreht wird nicht gespeichert:
  das ist ein Zustand, keine Einstellung.

### Notes

- **Die Beschriftungen der Kartendienste drehen bei gedrehter Karte mit** und
  stehen dann schief – Tiefenzahlen, Ortsnamen, Seezeichen. Das lässt sich
  nicht beheben: OSM, Kartverket und OpenSeaMap liefern fertige Bilder, und was
  in ein Bild gezeichnet ist, dreht sich mit ihm. Aufrecht wären sie nur mit
  einer vektorbasierten Renderschicht. Aufgenommen als O11 in `features.md`.

## [0.12.0] – 2026-08-24

### Added

- **Geschwindigkeit auf Tippen in Knoten oder km/h.** Die Kachel im Kopf ist
  der Schalter, die Wahl bleibt gespeichert. Die Einheit steht klein neben der
  Zahl, damit „km/h" die beiden Nachbarwerte nicht aus der Leiste drängt.
- **Die Kompassnadel im Ausrichtungsknopf zeigt immer nach Norden.** Sie hängt
  an derselben Variablen wie die Kartendrehung; in der Nordung ist der Winkel
  null, die Nadel steht also aufrecht und trägt ein N. Im Fahrtrichtungsmodus
  dreht sie mit und das N entfällt – mitgedreht läge es nur auf der Seite.

### Changed

- Die ETA wird **auf volle Minuten gerundet**. Aus einer geglätteten
  GPS-Geschwindigkeit gerechnet ist sie nicht sekundengenau, und eine
  rennende Sekundenstelle ist auf einer Zahl zum Hinsehen nur Unruhe.
- Die ETA steht ausgeklappt in derselben Größe und Schrift wie die Distanz und
  wird erst eingeklappt zur kleinen Zeile darunter; das Wort „ETA" erscheint
  nur ausgeklappt.
- Eingeklappt hat die Zielkarte eine feste Mindestbreite, die auch die längste
  ETA trägt: die Karte bleibt stehen, wenn die Minutenzahl umspringt, statt
  bei jedem Wechsel zu zucken.
- Der Ausrichtungsknopf sitzt als zweiter direkt unter dem Positionsknopf, weil
  beide zur Frage „wo bin ich und wie herum" gehören.

## [0.11.1] – 2026-08-24

### Fixed

- **Die Statusleiste des Telefons war in der installierten App verschwunden.**
  `display` stand auf `fullscreen`, was Uhrzeit und Akkustand ausblendet – auf
  dem Wasser zwei Angaben, die dazugehören. Jetzt `standalone`, und die
  iOS-Statusleiste steht auf `black` statt `black-translucent`, damit die Karte
  nicht unter Uhr und Akkuanzeige hindurchläuft. Eine bereits installierte App
  übernimmt das, sobald der Browser das Manifest neu einliest; sofort nach
  einer Neuinstallation.
- Die Zoomknöpfe links schließen unten bündig mit der untersten Schaltfläche
  rechts ab; beide Seiten hängen jetzt an derselben Kante.

### Changed

- **Die Zielkarte ist deutlich kleiner.** Eingeklappt trägt sie die Distanz und
  darunter klein die ETA und ist damit 157 statt 252 Pixel breit; die
  Ablesespalte gibt keinem Feld mehr eine feste Breite vor, jede Karte nimmt
  nur den Platz, den ihr Inhalt braucht. Die ETA ist damit auch eingeklappt
  ablesbar, statt nur in der ausgeklappten Karte zu stehen.

## [0.11.0] – 2026-08-24

### Added

- **Der Bildschirm bleibt an**, solange die App vorn ist. Das System gibt die
  Sperre beim Wechsel in den Hintergrund selbst frei, ein Telefon in der Tasche
  verbraucht also nichts. Browser, die die Sperre erst nach einer Berührung
  erteilen, bekommen einen zweiten Versuch beim ersten Tap; erst wenn auch der
  scheitert, meldet die App es.
- **Die Karte folgt der Position.** Sie hält das Boot in der Mitte, bis sie
  verschoben wird – Zoomen beendet das Folgen nicht. Der Positionsknopf
  schaltet es wieder ein und zentriert, ohne die Zoomstufe anzufassen. Nur der
  allererste Fix setzt noch eine Zoomstufe.
- **Eigene Position als Boot**, spitzer Bug, flaches Heck, in den Kurs gedreht.
  Ein Punkt sagt, wo das Boot ist; das hier sagt, wohin es zeigt.
- **Karte wahlweise nordwärts oder in Fahrtrichtung.** Nordung ist der
  Lesemodus und passt zur Papierkarte, Fahrtrichtung der Steuermodus: was oben
  gezeichnet ist, liegt voraus. Umschalten über den Kompassknopf, die Wahl
  bleibt gespeichert.

### Changed

- Der Zielmarker ist eine eigene Nadel statt Leaflets Standardsymbol – nur ein
  eigenes Element lässt sich aufrecht halten, während die Karte darunter dreht.
- Zoomknöpfe und Kartennachweis sitzen außerhalb der Karte statt als
  Leaflet-Controls darin: im gedrehten, übergroßen Kartencontainer lägen sie
  außerhalb des Bildschirms und würden mitdrehen. Der Nachweis wird jetzt aus
  den eingeschalteten Ebenen zusammengesetzt.
- Im Fahrtrichtungsmodus ist Trägheits-Panning abgeschaltet und die Karte lädt
  rund das 2,5-fache an Kacheln: ein gedrehtes Rechteck deckt das Fenster nur,
  wenn der Container die Diagonale als Kantenlänge hat. Die Nordung bleibt
  unverändert fenstergroß.

### Fixed

- Ein GPS-Fix während einer laufenden Zoom-Animation brach diese ab und ließ
  den Zoom auf den Ausgangswert zurückfallen. Das Folgen wartet die Animation
  jetzt ab.

## [0.10.0] – 2026-08-24

### Added

- **Die App ist installierbar.** `manifest.json` vervollständigt (Icons, `id`,
  `scope`, Beschreibung, `display_override`), dazu die Meta-Angaben, die iOS
  statt des Manifests liest. Installiert startet SeeNavi im Vollbild ohne
  Browserleiste, mit eigenem Icon und ohne Empfang.
- **Eigenes App-Icon:** Kompassnadel im Ring, in den Farben der Oberfläche.
  Zwei SVG-Vorlagen – abgerundet für `purpose: any`, randlos mit Zeichnung im
  80-%-Sicherheitskreis für `maskable` – daraus 192/512 px, ein
  Apple-Touch-Icon und das SVG selbst. Die Icons liegen im App-Shell-Cache,
  eine ohne Empfang gestartete App ist also kein leeres Quadrat.
- **Installationshinweis in der App.** Der Browser bietet die Installation nur
  in einem Menü an, das beim Ablegen niemand öffnet. Der Hinweis erscheint als
  Karte in der Ablesespalte, sobald der Browser die Installation tatsächlich
  anbietet – auf iOS, wo es keine programmatische Installation gibt, mit dem
  Weg über das Teilen-Menü statt eines wirkungslosen Knopfes. Einmal
  weggeklickt, kommt er nicht wieder; installiert erscheint er gar nicht erst.
- **Das Ziel fixiert sich nach einer Minute ohne Änderung.** Danach verschiebt
  ein Tap auf die Karte es nicht mehr; gelöst wird es nur über „Ziel löschen".
  Jede Änderung startet die Minute neu. Auf einem schwankenden Boot ist ein
  Fehltipper sonst schnell passiert und fällt spät auf. Der Zustand ist
  sichtbar: leuchtender Rand am Marker, Zeile in der Zielkarte, und ein
  ignorierter Tap meldet sich über eine Snackbar zurück, statt stumm nichts zu
  tun.

### Changed

- Die Zielkarte füllt Distanz, Peilung und ETA sofort beim Setzen des Ziels,
  statt bis zur nächsten GPS-Position mit Strichen dazustehen

## [0.9.2] – 2026-08-24

### Fixed

- **Die Tiefenzonen sind jetzt unterscheidbar.** Der Dienst zeichnet sie in
  sehr blassem Blau – dunkelstes Pixel 127 von 255 –, multipliziert mit dem
  ebenfalls blassen Blau des OSM-Wassers fielen die Stufen fast zusammen. Die
  Ebene bekommt zusätzlich zum Multiply eine Sättigungsanhebung `saturate(3)`;
  der RGB-Abstand benachbarter Zonen nach dem Blenden steigt damit von
  30/41/57 auf 47/60/64. Grau bleibt von Sättigung unberührt, Tiefenlinien,
  Lotungen und Symbole kommen also unverändert durch.
- Der Filter aus 0.9.1 (`saturate(1.8) contrast(1.3)`) war nachgemessen
  schlechter als gar kein Filter: `contrast()` dreht um Mittelgrau und schiebt
  blasse Zonen Richtung Weiß, wodurch die Stufe zwischen Tiefwasser und erster
  Zone von 30 auf 19 fiel. Die Messreihe steht in `architecture.md`.

### Removed

- **Die separate Tiefenlinien-Ebene entfällt.** Pixelmessung derselben Kachel,
  die die App holt (z15/16836/9457 bei 60.31821, 4.97209): `Dybdekontur`
  antwortet mit HTTP 200 und einer leeren Kachel, `Dybdelag` zeichnet auf
  derselben Kachel 75,02 %. Die Linien fehlen nicht in der Anfrage, sondern in
  den Daten. Die eigene Ebene forderte damit dieselben Daten ein zweites Mal
  an und bot einen Schalter für etwas, was der Dienst küstennah nicht liefert;
  die Konturen der Gruppenebene bleiben unverändert vorhanden, wo es sie gibt.
- Kacheln der entfallenen Ebene räumt der Kachelspeicher beim nächsten Start
  selbst weg (F18)

## [0.9.1] – 2026-08-22

### Fixed

- **Die Konturebene lief im Multiply-Blend-Modus und war dadurch praktisch
  unsichtbar.** Multiply war für die Gruppenebene richtig, die undurchsichtige
  Flächenfüllungen hat; eine reine Linienebene hat nichts zu überdecken. Und
  Tiefenlinien sind blass blau – multipliziert mit dem blassen Blau des
  OSM-Wassers ergibt das fast keinen Unterschied. Die Lotungen sind nahezu
  schwarz und überlebten es, die Linien nicht.
  Die Ebene rendert jetzt ohne Blend, mit `brightness(0.5) saturate(2.2)`;
  beides lässt Alpha unangetastet, der transparente Grund bleibt transparent.
- Blend-Modus und Filter sind jetzt getrennte Eigenschaften der Quelle, statt
  dass ein Blend-Modus für alle Overlays gilt

### Changed

- `compare.html` ist jetzt ein Tiefenlinien-Test statt eines Kartenlabors: es
  holt dieselbe Kachel wie die App und wertet sie pixelweise aus – Anteil
  gezeichneter Pixel, dunkelste Helligkeit, Farbanzahl –, zeigt sie vergrößert
  über Schachbrett und stellt Gruppen-, Kontur-, Flächen- und Lotungsebene
  nebeneinander. Damit lässt sich unterscheiden, ob eine Kachel leer ist oder
  gezeichnet und nur unsichtbar dargestellt wird.

## [0.9.0] – 2026-08-22

### Changed

- **Die Marken stehen jetzt bei festen Distanzen, nicht bei festen Zeiten.**
  Punkte bei 200 m und 500 m; daneben steht, wie lange die Strecke bei der
  aktuellen Geschwindigkeit dauert, auf volle Minuten gerundet. Die Distanz
  selbst steht klein und parallel zur Linie auf der anderen Seite, damit
  erkennbar bleibt, um welche Marke es sich handelt.
- Unter einer halben Minute würde die Rundung 0 ergeben; dort steht `<1 min`
- Die Kurslinie hat wieder eine feste Länge (575 m, knapp über der 500-m-Marke),
  statt mit den Marken zu wachsen und zu schrumpfen

## [0.8.0] – 2026-08-22

### Changed

- **Die Kurs-Projektion steht jetzt auf der Kurslinie statt in einer Kachel.**
  Kleine Punkte markieren, wo das Boot in 1, 2 und 5 Minuten sein wird, die
  Zeitangabe steht daneben. Die Kachel „Bei aktuellem Kurs" entfällt damit
  ersatzlos.
- Eine Marke wird nur gezeichnet, wo sie etwas aussagt. Sie entfällt, wenn
  sie außerhalb des sichtbaren Kartenausschnitts liegt, wenn ihr Label das
  der vorigen Marke überdecken würde, oder wenn die Fahrt zu langsam für eine
  sinnvolle Projektion ist. Bei 6 kn und z16 stehen dadurch 1 und 2 min – die
  5-min-Marke liegt außerhalb des Ausschnitts.
- Die Kurslinie endet nicht mehr nach festen 800 m, sondern reicht knapp über
  die letzte gezeichnete Marke hinaus
- Der 📐-Schalter blendet jetzt die Marken ein und aus statt der Kachel

### Notes

- Marken und Labels sind nicht anklickbar (`interactive: false`), sonst würde
  ein Tipp darauf kein Ziel setzen.
- Die Marken werden auch bei `moveend`/`zoomend` neu bewertet, nicht nur beim
  GPS-Fix: welche hineinpassen, hängt vom Kartenausschnitt ab.

## [0.7.1] – 2026-08-22

### Added

- **Zielkarte einklappbar.** Eingeklappt bleibt nur die Distanz stehen; die
  Karte schrumpft von 204 px auf 76 px Höhe. Der Zustand wird pro Gerät
  gemerkt, Voreinstellung ausgeklappt, damit Peilung und ETA beim ersten Ziel
  sichtbar sind. Eingeklappt entfällt zusätzlich das Label „Distanz" – eine
  Zahl mit Einheit spricht für sich und die Karte bleibt schmal.

### Fixed

- Messwerte konnten in den Karten umbrechen. Ein umgebrochener Wert ist im
  Vorbeischauen unlesbar und kostet genau die Höhe, die das Einklappen sparen
  soll. Spalte auf 252 px verbreitert, Werte einzeilig erzwungen.

### Notes

- **B7 geklärt:** Die Tiefenlinien erscheinen seit 0.7.0 im offenen Wasser –
  der Layer-Name `Dybdekontur` war also richtig. Dass sie küstennah fehlen,
  liegt an fehlenden Vermessungsdaten: Kartverket weist darauf hin, dass die
  flachsten küstennahen Bereiche nur begrenzt vermessen sind. Dort tragen die
  Lotungen die Tiefeninformation, wie auf der Papierseekarte auch.

## [0.7.0] – 2026-08-22

Oberfläche auf Material 3 umgebaut.

### Changed

- **Komplett neue Oberfläche nach Material 3.** Zwei Abweichungen vom Standard
  sind beabsichtigt: die Kontraste liegen über der Material-Vorgabe, weil das
  Display gegen offenen Himmel ankommt, und die Messwerte stehen in
  Display-Größen statt der Body-/Title-Größen eines normalen Layouts.
- **Messwerte deutlich größer:** Kurs und Speed von 20 px auf 36 px, die Werte
  in den Karten von 15 px auf 26 px, jeweils tabellarische Ziffern, damit
  nichts springt.
- Vollbreite App-Bar statt schwebender Leiste; Ablesekarten stapeln sich in
  einer Spalte, Bedienflächen als Sheets in der Mitte
- Icons als eigene Inline-SVGs statt Emoji – Material-nah, ohne Icon-Font oder
  externes Sprite
- Zoom-Control nach unten links; oben links gehören jetzt die Ablesekarten hin
- Tap-Ziele auf mindestens 44–56 px, aktive Schaltflächen zeigen ihren Zustand

### Added

- **Tiefenlinien** als eigene Ebene (`Dybdekontur`). Sie wird bewusst nicht in
  denselben WMS-Request wie die übrigen Tiefendaten gemischt: ein WMS weist die
  gesamte Anfrage zurück, sobald ein Layer-Name unbekannt ist. Getrennt kostet
  ein falscher Name nur diese eine Ebene. Siehe B7 in `bugs.md`.

### Fixed

- Zoom-Control lag hinter der Statusleiste
- Navigations- und Projektionskarte überlappten auf schmalen Displays
- Attribution und Footer stießen am unteren Rand zusammen
- Attribution behielt Leaflets hellen Hintergrund: dessen Regel ist
  spezifischer als die eigene und musste entsprechend adressiert werden

## [0.6.1] – 2026-08-22

### Fixed

- Tiefenlinien im Flachwasser fehlten. `MAP_RESOLUTION` war mit
  `72 × 2 × 2 = 288` über die High-DPI-Kompensation hinaus erhöht, um die
  Symbole zu vergrößern. MapServer berechnet daraus aber auch den
  Maßstabsnenner und hielt die Karte für doppelt so klein wie sie war,
  wodurch maßstabsabhängige Detailebenen wegfielen. Jetzt exakt kompensiert
  (`72 × DEPTH_OVERSAMPLE`). Siehe B5 in `bugs.md`.
- Tiefendaten verdeckten die Grundkarte an Brücken. Der Dienst zeichnet
  Wasserflächen und Küstenkontur undurchsichtig. Behoben über
  `mix-blend-mode: multiply` auf der Ebene. Siehe B6.

### Changed

- **Tiefenangaben sind wieder in Nominalgröße.** Größere Symbole und
  vollständiges Flachwasser-Detail schließen sich bei diesem Dienst
  gegenseitig aus; Detail hat Vorrang. Zum Ablesen eine Zoomstufe weiter
  hineinzoomen – die Karte geht bis z19.

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
