# Änderungswünsche

Eingangskorb für gewünschte, noch nicht umgesetzte Änderungen. Einträge werden
stichpunktartig notiert und nach Umsetzung nach „Erledigt" verschoben – im
Original-Wortlaut, ergänzt um Datum und eine kurze Umsetzungsnotiz. Gelöscht
wird hier nichts.

## Offen

- **„ist es möglich, auch andere Schiffe als optionalen Layer auf der Karte
  darzustellen? wenn man auf die Schiffe tippt, sollten sich weitere Infos
  dazu öffnen bzw. entsprechende Websites, wo dann öffentliche Informationen
  zu den Schiffen, wie aktueller Kurs, Geschwindigkeit und Zielhafen,
  abrufbar sind. alle Quellen sollen natürlich frei zugänglich sein. Nur
  recherchieren und planen, aber noch nicht umsetzen."** (2026-08-30)
  Recherchiert, nicht gebaut – wie gewünscht. Ergebnis: die Daten sind frei,
  der Zugang ist es nicht. Weltweite Live-Quellen verlangen einen Schlüssel
  und damit einen eigenen Server, die schlüsselfreie Quelle (Digitraffic)
  deckt nur finnische Gewässer ab. Quellenvergleich, drei mögliche Wege und
  der Entwurf der Ebene stehen in `architecture.md`, als O14 in
  `features.md` festgehalten.

- **„in der PWA unter Android ist die unterste Systemleiste noch weiß. kannst
  du es so anpassen, dass sie in derselben Farbe dargestellt wird wie der
  Hintergrund der Fußleiste"** (2026-08-25)
  Von der Seite aus nicht steuerbar: die untere Systemleiste färbt Chrome in
  einer installierten App selbst. In 0.19.2 sind alle Angaben gesetzt, die
  greifen können; bleibt sie hell, liegt es an Chromes Design-Einstellung.
  Siehe O13 in `features.md`.
- **„und nur den unteren Streifen ausblenden geht nicht?"** (2026-08-25)
  Nein – die Fullscreen-API nimmt beide Leisten oder keine. Als Ausweg ein
  Vollbildschalter in der Fußleiste, umgesetzt in 0.20.0.

- **„wenn sich die Karte dreht, drehen sich nicht die Seezeichen und
  Tiefenangaben, die stehen dann schief/auf dem Kopf. ist das anpassbar?"**
  (2026-08-24) Nicht mit Rasterkacheln – die Beschriftung ist ins Bild
  gezeichnet. Bliebe nur eine vektorbasierte Renderschicht; als O11 in
  `features.md` festgehalten.

## Erledigt

- **„ich brauche definitiv eine weltweite Anbindung, nicht nur ein Land.
  Variante A scheint mir für meinen Fall ausreichend. es geht nur darum,
  dass meine Kinder gerne wissen wollen, was für Schiffe so in der Nähe
  sind, auch wenn wir an Land sind. kleine Sportboote sind da egal. wenn es
  einen Button gibt, mit dem man auf seiner aktuellen Position in eine
  AIS-Karte ‚springen' kann, würde das schon erstmal reichen. auf welche
  Seite würde man denn hier z. B. problemlos springen können? Noch nicht
  umsetzen!"** (2026-08-30)
  Umgesetzt in 0.22.0 mit VesselFinder
  (`?lat=…&lon=…&zoom=…`, Karte und Schiffsdetails ohne Anmeldung,
  leichteste der Seiten); MarineTraffic bleibt vorerst weg. Ein
  Hyperlink braucht weder Schlüssel noch CSP-Eintrag; der Eintrag sitzt im
  Ebenenmenü, nicht auf einem fünften Knopf. Siehe `architecture.md`, O14 in
  `features.md`.

- **„setze HEADING_SMOOTHING so, dass eine harte Wende von 90° auf 180° nach
  4 Sekunden auf ±10° eingeschwungen ist … und kannst du es so einstellen,
  dass die Kurslinie nur angezeigt wird, wenn der unterste rechte Button aktiv
  ist"** (2026-08-26) Umgesetzt in 0.21.0: α = 0,45 (3 s mit Gerätekurs), und
  der Schalter blendet die ganze Linie aus.

- **„es kommt manchmal vor, dass sich das Boot trotz gleichmäßiger
  Geradeausfahrt spontan dreht … evtl. hilft es, wenn man die Reaktionszeit
  beim Kurswechsel etwas sanfter gestaltet"** (2026-08-26)
  Nachgemessen und behoben in 0.20.1: mittlere Kursabweichung von 69° auf 9°,
  siehe B9 in `bugs.md`.

- **„jetzt prüfe bitte nochmal alle Doku auf Aktualität und passe bei Bedarf
  an"** (2026-08-25) Durchgang über readme und alle Dateien in `docs/`;
  Korrekturen in 0.19.1, veraltete Wartungsseite entfernt.

- **„brauchen wir langsam einen neuen Namen für die App … nimm ‚SeaGlimpse'
  als neuen Namen … es muss unbedingt im Footer noch der Hinweis dauerhaft
  erscheinen, dass die App nicht zum Navigieren genutzt werden darf"**
  (2026-08-25) Umgesetzt in 0.19.0. Der Repository-Pfad bleibt `seanav`; einen
  vom Pfad getrennten Anzeigenamen kennt GitHub nicht, dort lässt sich nur die
  Beschreibung setzen.

- **„ja, bau die IHM-Seekarte als weitere Ebene ein"** (2026-08-25)
  Umgesetzt in 0.18.0: Sublayer `grupo_2`, Kartenzweck folgt dem Zoom.

- **„gibt es für die Kanaren auch irgendwo Tiefen- und Seekarten zur freien
  Verfügung, wie hier in Norwegen?"** + **„Die EMODNET contours reichen mir,
  die multicolor Version ist mir zu unübersichtlich und für meinen Fall
  völlig oversized"** (2026-08-25)
  Recherchiert, am Revier gemessen, eingebaut in 0.17.0: EMODnet `contours`
  als europaweite Tiefenlinien-Ebene.

- **„fang mit Schritt 1 an"** (2026-08-25) `compare.html` prüft die drei
  Kandidatendienste, umgesetzt in 0.16.2.

- **„sobald es über 1h geht, bitte im Format ‚1,x h' die Zeiten angeben, wobei
  immer auf eine Viertelstunde gerundet werden soll. also z.B. 1,25h oder
  1,5h, aber nie 1,17h"** (2026-08-24) Umgesetzt in 0.16.1 für ETA und
  Markenbeschriftung.

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
