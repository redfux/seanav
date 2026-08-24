# Änderungswünsche

Eingangskorb für gewünschte, noch nicht umgesetzte Änderungen. Einträge werden
stichpunktartig notiert und nach Umsetzung nach „Erledigt" verschoben – im
Original-Wortlaut, ergänzt um Datum und eine kurze Umsetzungsnotiz. Gelöscht
wird hier nichts.

## Offen

_(derzeit keine offenen Punkte)_

## Erledigt

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
