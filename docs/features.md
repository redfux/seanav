# Anforderungen

## Zweck

Orientierungshilfe für Bootsfahrten, nutzbar ohne Mobilfunkempfang. **Kein
Navigationssystem** und kein Ersatz für vorschriftsmäßige Seekarten und
Ausrüstung – der Name der App sagt das mit, seit sie SeaGlimpse heißt, und die
Fußzeile sagt es dauerhaft.

## Umgesetzt

| # | Anforderung | Seit |
| ~~F1~~ | ~~Seekarte als Kartenuntergrund (Kartverket „Sjøkart Raster")~~ – Rasterquelle entfernt in 0.6.0, ersetzt durch OSM als Grundkarte plus die Tiefen- und Seekartenebenen (F13, F32, F33) | – |
| F2 | Eigene Position per Geräte-GPS, Symbol auf der Karte (seit 0.11.0 ein Boot, siehe F27) | 0.1.0 |
| F3 | Kurs über Grund (COG) als Linie in Fahrtrichtung; über den Marken-Schalter samt Linie ein-/ausblendbar | 0.1.0 |
| F4 | Geschwindigkeit geglättet, in Knoten oder km/h (siehe F29) | 0.1.0 |
| F5 | Ziel per Klick/Tap setzen und wieder löschen | 0.1.0 |
| F6 | Distanz, Peilung und ETA zum Ziel | 0.1.0 |
| F7 | Distanzmarken auf der Kurslinie (200 m bis 10 km, je nach Zoom) mit der jeweils benötigten Fahrzeit | 0.9.0 |
| ~~F8~~ | ~~Kartenausschnitt vorab herunterladen~~ – entfernt in 0.6.0, siehe O8 | – |
| F9 | App startet ohne Netzverbindung (App-Shell im Service Worker) | 0.1.0 |
| F10 | Fehlende Kacheln als erkennbarer Platzhalter statt kaputtem Bild | 0.1.0 |
| F11 | Anzeige des belegten Kachelspeichers | 0.1.0 |
| F12 | Scharfe Kartendarstellung auf hochauflösenden Displays (High-DPI) | 0.3.0 |
| F13 | Tiefenzonen, Lotungen, Grunde, Schären und Tiefenlinien aus dem Kartverket-Tiefendaten-WMS | 0.4.0 |
| F14 | Seezeichen (Tonnen, Baken, Feuer) aus OpenSeaMap | 0.4.0 |
| F15 | Kartenebenen einzeln ein-/ausschaltbar, Auswahl bleibt erhalten | 0.4.0 |
| F16 | Kachelspeicher nach Ebene aufgeschlüsselt, manuell leerbar | 0.4.0 |
| F17 | Kachelspeicher füllt sich beim Betrachten; bereits gefahrene Strecken bleiben ohne Empfang verfügbar | 0.6.0 |
| F18 | Verwaiste Kacheln entfernter Ebenen werden beim Start automatisch geräumt | 0.6.0 |
| F19 | Oberfläche nach Material 3, kontraststark und mit großen Messwerten | 0.7.0 |
| F20 | Zielkarte einklappbar: ausgeklappt Distanz, ETA und Peilung in gleicher Größe, eingeklappt Distanz mit der ETA klein darunter; Zustand bleibt erhalten | 0.7.1 |
| F21 | Marken passen sich dynamisch an: nicht darstellbare Marken entfallen | 0.8.0 |
| F22 | Tiefenzonen farblich unterscheidbar – gemessene Sättigungsanhebung statt blasser Stufen | 0.9.2 |
| F23 | Als App installierbar: Manifest, eigene Icons, Installationshinweis im Browser (inkl. iOS-Weg über das Teilen-Menü) | 0.10.0 |
| F24 | Ziel fixiert sich eine Minute nach der letzten Änderung; lösbar nur über „Ziel löschen" | 0.10.0 |
| F25 | Bildschirm bleibt an, solange die App im Vordergrund ist | 0.11.0 |
| F26 | Karte folgt der Position, bis sie verschoben wird; der Kartenknopf schaltet das Folgen wieder ein, ohne die Zoomstufe zu ändern | 0.11.0 |
| F27 | Eigene Position als Bootssymbol mit spitzem Bug und flachem Heck, gedreht in den Kurs | 0.11.0 |
| F28 | Karte wahlweise nach Norden oder dynamisch in Fahrtrichtung ausgerichtet; die Kompassnadel im Schalter zeigt dabei immer nach Norden | 0.11.0 |
| F29 | Geschwindigkeit auf Tippen zwischen Knoten und km/h umschaltbar, Wahl bleibt erhalten | 0.12.0 |
| F30 | Karte mit zwei Fingern frei drehbar; nahe Norden rastet sie ein | 0.13.0 |
| F31 | Position und Kartenausrichtung auf einem Knopf: erstes Tippen zentriert, jedes weitere wechselt Nordung/Fahrtrichtung | 0.14.0 |
| F32 | Tiefenlinien für europäische Gewässer aus dem EMODnet-Bathymetry-WMS – deckt Kanaren und Mittelmeer mit ab | 0.17.0 |
| F33 | Offizielle spanische Seekarte (IHM) als Ebene: Lotungen, Felsen, Wracks, Hindernisse, Tiefenlinien; Kartenzweck folgt dem Zoom | 0.18.0 |
| F34 | Dauerhafter Hinweis in der Fußzeile, dass die App kein Navigationssystem ist | 0.19.0 |
| F35 | Vollbild auf Knopfdruck: blendet beide Systemleisten aus und gibt den ganzen Bildschirm der Karte | 0.20.0 |
| F36 | „Schiffe in der Nähe" im Ebenenmenü: öffnet den gezeigten Ausschnitt in der öffentlichen AIS-Karte von VesselFinder – Name, Typ, Kurs, Geschwindigkeit und Zielhafen je Schiff | 0.22.0 |
| --- | --- | --- |

## Nichtfunktionale Anforderungen

- **Offline-first:** zur Laufzeit wird außer Kartenkacheln nichts aus dem Web
  nachgeladen; keine CDN-Links
- **Datensparsam:** keine Server-Komponente, keine Analytics, keine
  Übertragung von Positionsdaten. Einzige Ausnahme ist der Sprung zur
  AIS-Karte (F36): er übergibt die Kartenmitte an den Fremdanbieter –
  ausschließlich beim ausdrücklichen Antippen, nie im Hintergrund
- **Buildfrei:** direkt auslieferbare statische Dateien, keine `package.json`
- **Mobile-first:** Bedienung einhändig am Telefon, Kontraste für Tageslicht
- **Zielumgebung:** aktuelle Evergreen-Browser (Chrome, Firefox, Edge, Safari)

## Offen / nicht umgesetzt

| # | Anforderung | Status |
| ~~O1~~ | ~~PWA-Icons und Installierbarkeit~~ – umgesetzt in 0.10.0 (F23) | – |
| O2 | Gezieltes Löschen einzelner Offline-Bereiche bzw. des gesamten Kachelcaches aus der App heraus | offen |
| O3 | Routen mit mehreren Wegpunkten statt nur einem Einzelziel | offen |
| ~~O4~~ | ~~Google Material Design als gestalterische Grundlage~~ – umgesetzt in 0.7.0 (F19) | – |
| O5 | Abfragbare Tiefenwerte (Antippen → Tiefe) – blockiert durch einen Serverfehler des Dienstes, siehe B4 in `bugs.md` | extern blockiert |
| O7 | Offizielle ENC-Vektorkarten (S-57) über einen PRIMAR-Distributor – die einzige Quelle mit zertifizierten Seekarten, deren Beschriftung sich zudem mitdrehen ließe (O11), aber lizenzpflichtig | Beschaffungsentscheidung |
| O8 | Vorab-Download ganzer Gebiete. Untersagt durch die Nutzungsbedingungen von `tile.openstreetmap.org`; möglich nur mit einem Anbieter, der Prefetching gestattet – die meisten verlangen dafür einen API-Schlüssel | zu entscheiden |
| ~~O9~~ | ~~Tiefendaten außerhalb Norwegens~~ – Tiefenlinien europaweit mit EMODnet (F32), Seekarte für spanische Gewässer mit IHM (F33), beide in 0.17.0/0.18.0 | – |
| O10 | Tiefenlinien im küstennahen Flachwasser. Nicht durch Code lösbar – der Dienst liefert dort nachweislich eine leere Konturkachel, siehe B8 in `bugs.md`. Die Tiefeninformation steckt küstennah in den Tiefenzonen | extern begrenzt |
| O11 | Beschriftungen der Kartendienste (Tiefenzahlen, Ortsnamen, Seezeichen) stehen bei gedrehter Karte schief. Nicht behebbar, solange die Ebenen Rasterkacheln sind – die Beschriftung ist ins Bild gezeichnet. Aufrecht nur mit einer vektorbasierten Renderschicht | technisch begrenzt |
| O12 | GRAFCAN-Topobathymetrie (Kanaren, 2,5 m): Capabilities in Ordnung, GetMap antwortet mit `ServiceExceptionReport`. Grund ist mit dem Prüfstand aus 0.17.0 auszulesen | offen |
| O13 | Untere Systemleiste von Android in der installierten App einfärben oder allein ausblenden. Chrome bestimmt die Farbe dort selbst; die Fullscreen-API nimmt beide Leisten oder keine. Alles Setzbare ist gesetzt (0.19.2), als Ausweg gibt es den Vollbildschalter (F35) | extern begrenzt |
| ~~O14~~ | ~~Andere Schiffe auf der Karte~~ – als Sprungknopf in eine öffentliche AIS-Karte umgesetzt in 0.22.0 (F36). Eine eigene Schiffsebene bleibt verworfen: weltweite Live-Quellen verlangen einen Schlüssel und damit eine Server-Komponente, siehe `architecture.md` | – |
| --- | --- | --- |
