# Änderungswünsche

Eingangskorb für gewünschte, noch nicht umgesetzte Änderungen. Einträge werden
stichpunktartig notiert und nach Umsetzung nach „Erledigt" verschoben – im
Original-Wortlaut, ergänzt um Datum und eine kurze Umsetzungsnotiz. Gelöscht
wird hier nichts.

## Offen

_(derzeit keine offenen Punkte)_

## Erledigt

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
