# Änderungswünsche

Eingangskorb für gewünschte, noch nicht umgesetzte Änderungen. Einträge werden
stichpunktartig notiert und nach Umsetzung nach „Erledigt" verschoben – im
Original-Wortlaut, ergänzt um Datum und eine kurze Umsetzungsnotiz. Gelöscht
wird hier nichts.

## Offen

- **„wenn sich die Karte dreht, drehen sich nicht die Seezeichen und
  Tiefenangaben, die stehen dann schief/auf dem Kopf. ist das anpassbar?"**
  (2026-08-24) Nicht mit Rasterkacheln – die Beschriftung ist ins Bild
  gezeichnet. Bliebe nur eine vektorbasierte Renderschicht; als O11 in
  `features.md` festgehalten.

## Erledigt

- **„bei großen Zoomstufen soll die Kurslinie auch 5- und 10km-Marken zeigen.
  und die grüne Linie zur Zielmarkierung muss vom Kontrast her ebenfalls
  optimiert werden, da das Türkisgrün auf dem Meerblau kaum zu erkennen ist"**
  (2026-08-24) Umgesetzt in 0.16.0: Leiter bis 10 km, Ziellinie magenta auf
  heller Unterlinie.

- **„bei der Peilungslinie eine andere Farbe nehmen, der Kontrast zw. dem
  derzeitigen Orange und dem Blau der Wasserflächen ist zu gering bei starker
  Sonneneinstrahlung … außerdem die Linie so verlängern, dass auch die
  1km-Marke noch dran angezeigt werden kann"** (2026-08-24)
  Umgesetzt in 0.15.0: schwarze Linie auf heller Unterlinie, dritte Marke bei
  1 km, Linie auf 1150 m verlängert.

- **„in der Zielkachel sollen die drei Werte sauber untereinander stehen"**
  (2026-08-24) Umgesetzt in 0.14.1: gemeinsame Labelspalte, gemeinsame rechte
  Kante, gleicher Zeilenabstand; der Aufklapppfeil ist aus dem Textfluss
  genommen.

- **„kannst du die Funktion der ersten beiden Buttons in einen Button
  zusammenführen, so wie es z.B. bei Google Maps ist … das erste Mal drauf
  tippen zu Position springen, jedes weitere Tippen wechselt zw. norweisender
  und fahrtweisender Ansicht"** (2026-08-24) Umgesetzt in 0.14.0; der
  Ausrichtungsknopf entfällt.

- **„die Karte ist nicht drehbar, wenn man sie mit den Fingern bewegt. kannst
  du das noch implementieren"** (2026-08-24) Umgesetzt in 0.13.0 als
  Zwei-Finger-Drehung mit Schwelle und Einrasten bei Norden.


- **„die ETA soll nur klein dargestellt werden, wenn die Zielkachel eingeklappt
  ist, ansonsten … in der selben Größe/Schriftart wie die Entfernung"**,
  **„die ETA soll immer nur auf volle Minuten gerundet werden"**,
  **„wenn die Anzeige minimiert ist, soll die Breite nicht ständig schwanken …
  und ‚ETA' muss dann nicht mit angezeigt werden"** (2026-08-24)
  Umgesetzt in 0.12.0.
- **„der Speed soll zw. kn und km/h wechseln, wenn man auf die Einheit tippt"**
  (2026-08-24) Umgesetzt in 0.12.0, Wahl bleibt gespeichert.
- **„das Symbol zum Umschalten … soll als zweiter Button gesetzt werden … und
  in das Symbol sollte noch ein ‚N' eingearbeitet werden … bei der dynamischen
  Ansicht eine kleine sich drehende Kompassnadel, die immer nach Norden
  zeigt"** (2026-08-24) Umgesetzt in 0.12.0; die Nadel hängt an derselben
  Variablen wie die Kartendrehung.

- **„warum wird mir im pwa-Modus keine Akku-Anzeige/Uhrzeit mehr gezeigt, bzw.
  wo ist die Statusleiste des Handys hin? bitte wieder sichtbar machen"**
  (2026-08-24) Ursache war `display: fullscreen` im Manifest; behoben in
  0.11.1 mit `standalone` und opaker iOS-Statusleiste.
- **„wenn die Zielkachel minimiert ist … schreibe bitte auch noch die ETA
  kleiner darunter und verkleinere das Feld"** (2026-08-24)
  Umgesetzt in 0.11.1.
- **„der +/- Button links sollte nach unten hin bündig mit dem letzten Button
  rechts sein"** (2026-08-24) Umgesetzt in 0.11.1 über eine gemeinsame
  Unterkante `--controls-bottom`.

- **„das Handy darf nicht ausgehen, wenn die App aktiv ist"** (2026-08-24)
  Umgesetzt in 0.11.0 als Screen-Wake-Lock mit Wiederholung nach der ersten
  Berührung.
- **„die Karte sollte immer mit der aktuellen Position mitwandern und die
  Zoomstufe nicht verändern, wenn auf den 'aktuelle Position'-Button geklickt
  würde, solange, bis die Karte manuell verschoben wurde"** (2026-08-24)
  Umgesetzt in 0.11.0 als Folgemodus; der Positionsknopf zentriert ohne
  Zoomwechsel, Ziehen beendet das Folgen.
- **„das Icon für die aktuelle Position sollte eine Art Boot, mit spitzem Bug
  und flachem Heck sein"** (2026-08-24)
  Umgesetzt in 0.11.0, in den Kurs gedreht.
- **„die Karte sollte einmal nordwärts und einmal dynamisch in Fahrtrichtung
  zeigen"** (2026-08-24)
  Umgesetzt in 0.11.0 über den Kompassknopf; die Drehung samt der nötigen
  Leaflet-Korrekturen steht in `js/rotate.js`.

- **„mach alles noch PWA-ready, mit Installationshinweis im Browser, und
  erstelle ein passendes Icon für die App"** (2026-08-24)
  Umgesetzt in 0.10.0: Manifest vervollständigt, Kompass-Icon in zwei
  Vorlagen (`any` und `maskable`) samt gerenderten PNGs, Installationshinweis
  als Karte mit eigenem iOS-Weg.
- **„der Zielmarker sollte sich auf der Karte nicht ändern, wenn er gesetzt
  ist und 1 Min nicht mehr angepasst wurde. danach sollte nur noch über die
  Ziel-löschen-Taste gelöscht werden"** (2026-08-24)
  Umgesetzt in 0.10.0 als Fixierung nach 60 s, mit sichtbarem Zustand am
  Marker, in der Zielkarte und als Rückmeldung bei ignorierten Taps.

- **„die Tiefenlinien im flacheren Wasser sind nicht zu sehen … es gibt immer
  noch keine Tiefenlinien"** (mehrfach, zuletzt 2026-08-24)
  Gemessen statt weiter vermutet: der Dienst antwortet an der fraglichen
  Stelle mit einer leeren Konturkachel, die Tiefeninformation liegt dort in
  den Tiefenzonen. Umgesetzt in 0.9.2 – Konturebene entfernt, Tiefenzonen
  durch gemessene Sättigungsanhebung unterscheidbar gemacht. Siehe B8 in
  `bugs.md`.
