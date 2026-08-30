# Bugs

Bekannte Fehler und deren Lösung. Behobene Fehler bleiben mit ihrer Lösung
stehen, damit sie bei einem Rückfall wiederauffindbar sind.

Ältere Einträge verweisen auf die Wartungsseite `diagnose.html`. Die ist mit
0.19.1 entfallen: sie prüfte den Kartverket-WMTS, den die App seit 0.6.0 nicht
mehr verwendet. Ihre Nachfolgerin ist `compare.html`, der Prüfstand für
Kartendienste.

## Offen

_(derzeit keine offenen Fehler – die verbleibende Lücke im Flachwasser ist
kein Fehler, sondern die Datenlage des Dienstes – siehe B8 unten und O10
in `features.md`.)_

## Behoben

### B10 – Der Sprung zur AIS-Karte landete auf dem Standardausschnitt

**Symptom:** „Schiffe in der Nähe" öffnete VesselFinder nicht an der Stelle,
die SeaGlimpse zeigte, sondern dort, wo der Browser die Seite zuletzt verlassen
hatte – beim ersten Mal auf deren Standardansicht. Die Adresse in der
Adresszeile stimmte, der Ausschnitt nicht.

**Ursache.** `?lat=…&lon=…&zoom=…` ist die Parameterform der **Einbettungs**-
Karte von VesselFinder (`/aismap`), nicht der Website. Deren Website hält
ihren Ausschnitt überhaupt nicht in der Adresse – am Gerät nachgewiesen:
zoomt man dort, ändert sich die URL nicht. Die Parameter wurden also nicht
falsch verstanden, sondern gar nicht gelesen; die Position kam aus dem
lokalen Speicher des Browsers.

**Behoben in 0.22.1** durch den Wechsel des Ziels auf MarineTraffic. Deren
Adressform ist keine Vermutung, sondern die, die ihre Website selbst erzeugt,
während man auf ihr navigiert – Pfadsegmente statt Parameter, und `centerx`
ist die Länge:

```
https://www.marinetraffic.com/en/ais/home/centerx:<lon>/centery:<lat>/zoom:<z>
```

**Seit 0.23.1 ist das Ziel wieder VesselFinder**, jetzt aber die richtige
Adresse: `…/aismap?zoom=&lat=&lon=`, deren Einbettungs-Karte. Am Gerät
bestätigt – der Ausschnitt stimmt. Es war also nie der Anbieter, der nicht
passte, sondern die Adresse.

**Die Lehre, die über diesen Fall hinausgeht:** eine Adresse taugt nur dann
als Sprungziel, wenn die Zielseite sie selbst in ihrer Adresszeile führt. Eine
Form aus einer Einbettungs-Dokumentation ist kein Beleg dafür. Nachprüfen
lässt sich das in einem einzigen Handgriff, ohne eine Zeile Code: die Karte
der Zielseite verschieben und schauen, ob die Adresse mitwandert.

### B9 – Boot drehte sich spontan bei Geradeausfahrt

**Symptom:** Bei gleichmäßiger Geradeausfahrt drehte sich das Bootssymbol
gelegentlich sprunghaft, ohne dass sich am Kurs etwas geändert hatte.

**Ursache, nachgerechnet.** Der Kurs entstand aus der Peilung zwischen den
**letzten beiden** Fixes, verworfen wurde nur, was weniger als **1 m**
auseinanderlag – und der gemeldete Gerätekurs wurde völlig ungeglättet
übernommen, obwohl der Kommentar an der Variablen „smoothed" behauptete. Ein
GPS-Fix streut um einige Meter; bei 5 kn liegen zwei Fixes 2,5 m auseinander.
Damit ist der Fehler so groß wie die Strecke selbst.

Simulierte Geradeausfahrt (90°, 5 kn, σ = 3 m, 60 Fixes) durch den alten Code:
mittlere Kursabweichung **69,4°**, Maximum **178,2°**. Das Boot zeigte
zeitweise genau rückwärts.

**Behoben in 0.20.1** durch Mindestgeschwindigkeit, lange Basislinie und ein
zirkuläres gleitendes Mittel (dessen Faktor in 0.21.0 auf 0,45 nachgezogen
wurde, siehe dort) – die Begründung steht in `architecture.md`.
Dieselbe Fahrt danach: **9,4°** mittlere Abweichung, Maximum **25,5°**; bei
2 kn 12,3° und 52,7°. Erkauft mit Nachlauf: eine harte Wende um 90° ist nach
9 s auf ±10° eingeschwungen.

### B8 – Tiefenlinien im Flachwasser: gemessen, nicht mehr vermutet

**Symptom:** Küstennah zeigte die Konturebene nichts, obwohl Lotungen und
Seezeichen erschienen.

**Dreimal falsch diagnostiziert** – erst der `tilematrix`-Parameter, dann die
Maßstabs-Kompensation über `MAP_RESOLUTION`, dann die Datenlage als bloße
Vermutung. Die ersten beiden waren echte Fehler und sind behoben, erklären das
Symptom aber nicht.

**Messung.** `compare.html` holt inzwischen dieselbe Kachel, die die App holt,
und wertet sie pixelweise aus. Kachel z15/16836/9457 bei 60.31821, 4.97209:

| Sublayer | Antwort | Ergebnis |
| --- | --- | --- |
| `Dybdekontur` | HTTP 200, 1 kB | leer – der Dienst zeichnet hier nichts |
| `Dybdelag` | HTTP 200, 11 kB | 75,02 % gezeichnet, dunkelstes Pixel 127/255 |
| `Dybdedata2` | HTTP 200 | 76,97 % gezeichnet, dunkelstes Pixel 50/255 |
| `Dybdepunkt` | HTTP 200 | 0,13 % gezeichnet (Lotungen) |

Damit ist die Frage entschieden: Die Anfrage stimmt, der Layer-Name stimmt,
der Dienst antwortet – und liefert an dieser Stelle eine leere Konturkachel.
Keine Darstellungsänderung kann Linien herbeiführen, die nicht geliefert
werden.

**Was stattdessen da ist.** Die Tiefeninformation steckt küstennah in den
Flächen von `Dybdelag`, den Tiefenzonen. Die kamen bisher kaum zur Geltung:
blasses Blau, multipliziert mit dem blassen Blau des OSM-Wassers.

**Behoben in 0.9.2:**

- Die separate Konturebene entfällt. Sie fordert dieselben Daten ein zweites
  Mal an und hat genau dort nichts anzubieten, wo sie gebraucht wird – ein
  Schalter, der etwas verspricht, was der Dienst nicht halten kann.
- Die Tiefendatenebene bekommt zusätzlich zum Multiply eine gemessene
  Sättigungsanhebung, `saturate(3)`. Der RGB-Abstand benachbarter Tiefenzonen
  nach dem Blenden steigt damit von 30/41/57 auf 47/60/64. Die Tabelle mit den
  verworfenen Alternativen steht in `architecture.md`; `contrast()` war die
  naheliegende und die falsche Wahl.

**Verbleibend:** Tiefenlinien im küstennahen Flachwasser gibt es dort nicht, wo
Kartverket nicht vermessen hat. Das ist keine offene Aufgabe im Code, sondern
O10 in `features.md`.

### B7 – Keine Tiefenlinien: kein Fehler, sondern Datenlage

**Symptom:** Der Tiefendaten-Layer zeichnete Lotungen, Grunde und Schären, aber
keine Tiefenkonturlinien.

**Erste Annahme (0.7.0, in 0.9.2 zurückgenommen):** Der Sublayer
`Dybdekontur` sei im Gruppen-Request `Dybdedata2` nicht enthalten, deshalb
wurde er als eigene Ebene angefordert. Belegt war das nie. Die Messung in B8
zeigt, dass die Konturebene an der fraglichen Stelle leer antwortet – der
getrennte Request holte also dieselben Daten ein zweites Mal und ist wieder
entfernt.

**Verbleibende Lücke im Flachwasser: keine, die sich beheben ließe.** Kartverket
weist ausdrücklich darauf hin, dass die flachsten küstennahen Bereiche nur
begrenzt vermessen sind – aus technischen Gründen und wegen der Kosten. Die
Konturen fehlen dort, weil keine Vermessungsdaten vorliegen, nicht wegen der
Anfrage oder der Darstellung.

Praktisch heißt das: küstennah tragen die Lotungen (`Dybdepunkt`) die
Tiefeninformation, so wie auf der Papierseekarte auch. Wo Kartverket im
Programm „Marine grunnkart i kystsonen" neu vermisst, kommen Konturen mit der
Zeit dazu – ohne Zutun der App, da der WMS live abgefragt wird.

### B5 – Tiefenlinien im Flachwasser fehlten

**Symptom:** Im tieferen Wasser wurden Tiefenobjekte gezeichnet, im flacheren
fehlten die Tiefenlinien. Lotungen erschienen weiterhin.

**Ursache:** Selbst eingebaut mit der Symbolvergrößerung in 0.5.0. MapServer
verwendet `MAP_RESOLUTION` zweifach: es skaliert Symbolgrößen, Linienstärken
und Beschriftungen – und geht in den Maßstabsnenner ein, den der Server für die
Anfrage berechnet. Die doppelte Pixelzahl halbiert diesen Nenner, die doppelte
Resolution verdoppelt ihn; beides hebt sich auf. Genau das ist das anerkannte
High-DPI-Rezept.

Mit `72 × 2 × 2 = 288` war die Kompensation gestört: der Server hielt den
Maßstab für doppelt so klein wie er war und blendete maßstabsabhängige Ebenen
aus. Grobe Tiefwasser-Objekte überlebten das, feines Flachwasser-Detail nicht.

**Lösung:** `MAP_RESOLUTION = 72 × DEPTH_OVERSAMPLE`, also exakt kompensiert.
Größere Symbole sind aus diesem Dienst damit nicht zu haben, ohne Detail zu
verlieren – und Detail hat Vorrang, gerade im Flachwasser. Nachgerechnet und
im Browser geprüft: Kompensationsfaktor exakt 1.

**Nachtrag – die Diagnose war unvollständig.** Die Kompensation ist für sich
richtig und bleibt. Sie war aber nicht die Ursache der fehlenden Konturen:
auch danach erschienen keine. Was im Tiefwasser wie Tiefenlinien aussah, waren
Umrisse von Grunden (`Grunne`) mit ihren Tiefenwerten. Fortgeführt als B7.

### B6 – Tiefendaten verdeckten die Grundkarte an Brücken

**Symptom:** Wo eine Brücke oder Straße über Wasser führt, war der
OSM-Inhalt verschwunden – im Vergleich mit abgeschalteter Tiefendatenebene
fehlte etwa die Straßennummernplakette.

**Ursache:** Der Dienst rendert eine vollständige Seekarte einschließlich
Wasserflächen und Küstenkontur. Diese Füllungen sind undurchsichtig und
überdecken alles darunter; `transparent=true` betrifft nur den Bildrand,
nicht die gezeichneten Flächen.

**Lösung:** `mix-blend-mode: multiply` auf dem Container der Tiefendatenebene.
Helle Füllungen lassen die Grundkarte unverändert durch, dunkle Farbe –
Tiefenlinien, Lotungen, Symbole – bleibt genauso dunkel wie zuvor. Das kommt
ohne Rätselraten über die internen Sublayer-Namen des Dienstes aus.

Mit synthetischen Kacheln im Browser belegt: ein deckend hellblaues Overlay
über einer Grundkarte mit schwarzen Balken lässt diese durchscheinen; ohne den
Blend-Modus sind sie vollständig verdeckt.

### B3 – Karte zum Navigieren zu grob aufgelöst

**Ursache:** Zwei unabhängige Gründe. Erstens endet die native Auflösung von
`sjokartraster` gemessen bei etwa z15; darüber liefert der Dienst nur
hochskalierte Kacheln. Zweitens – und das war der eigentliche Punkt – sind
Rasterkarten für diesen Anwendungsfall der falsche Datentyp: Tiefen sind
aufgedruckte Pixel, keine Objekte.

**Lösung (0.4.0):** Die navigationsrelevante Information kommt jetzt aus dem
Kartverket-Tiefendaten-WMS (`Dybdedata2`) und den OpenSeaMap-Seezeichen. Beide
werden serverseitig aus Vektordaten gerendert und haben damit keinen
Auflösungsdeckel. Die Rasterseekarte bleibt als Hintergrund für Küstenlinie
und Kartenkontext, gedeckelt auf `maxNativeZoom: 15`.

**Symbolgröße:** Die doppelte Pixelzahl allein hätte alles halb so groß
gezeichnet, weil MapServer Linien und Beschriftungen in festen Pixelmaßen
zeichnet. `MAP_RESOLUTION` skaliert die Symbolik mit – beides zusammen ergibt
scharf *und* in der vorgesehenen Größe.

### B4 – GetFeatureInfo der Tiefendaten antwortet mit Serverfehler

**Symptom:** Eine Abfrage liefert HTTP 200, im Rumpf aber
`msShapefileOpen(): Unable to access file. No (NULL) filename provided.`

**Ursache:** Fehlkonfiguration auf Seiten des Dienstes (MapServer findet die
hinterlegte Shapefile-Quelle nicht). Kein Fehler in dieser App.

**Konsequenz:** Die Tipp-auf-die-Karte-Abfrage wurde nicht in die App
übernommen. Die Tiefenwerte sind in der gerenderten Karte lesbar, der
Mehrwert einer Abfrage wäre gering – eine Funktion, die zuverlässig eine
Serverfehlermeldung zeigt, wäre schlechter als keine.

**Status:** extern, nicht durch uns behebbar. Falls Kartverket das repariert,
lässt sich die Abfrage nachrüsten; der Code dafür steht in `compare.html`.

### B2 – Kartendarstellung zu grob, keine Tiefenwerte erkennbar

**Symptom:** Beim Reinzoomen blieb nur unscharfer Pixelbrei; Untiefen und
Hindernisse waren nicht zu erkennen, Tiefenzahlen fehlten scheinbar ganz.

**Ursache:** `devicePixelRatio` von Mobilgeräten. Auf dem betroffenen Gerät
2,6 – die App zeichnete 256-px-Kacheln über 256 CSS-Pixel, jeder Kartenpixel
wurde also über rund 2,6 Gerätepixel gestreckt. Die auf der Rasterkarte
aufgedruckten Lotungen waren vorhanden, aber zu einem unlesbaren Brei
verschmiert.

Zwei zunächst naheliegende Verdachtsmomente waren **nicht** die Ursache und
wurden per `diagnose.html` ausgeschlossen: der Layer-Name war korrekt (der
Dienst weist unbekannte Layer ab, liefert also keinen stillen Default), und
Kacheln kamen auf allen Zoomstufen bis z18 mit HTTP 200.

**Lösung:** `detectRetina: true` am Tile-Layer. Leaflet fordert damit auf
hochauflösenden Displays eine Zoomstufe tiefer an und zeichnet sie auf halber
Fläche, was die Pixelzuordnung wieder auf etwa 1:1 bringt.

Der Offline-Downloader musste mitgezogen werden: er speichert jetzt die
Service-Zoomstufen, die der Layer tatsächlich anfordert (`ZOOM_OFFSET`), sonst
hätte er den Cache mit Kacheln gefüllt, die nie abgerufen werden. Verifiziert:
Anzeige und Download nutzen bei identischem Ausschnitt exakt dieselben
Cache-Schlüssel.

**Nebenwirkung:** rund viermal so viele Kacheln pro Fläche, entsprechend mehr
Speicherbedarf. Der Hinweis im Offline-Panel weist darauf hin.

**Nicht dadurch gelöst:** *abfragbare* Tiefen (Tippen auf eine Stelle → Tiefe
in Metern) sind mit Rasterkarten grundsätzlich nicht möglich, siehe
`architecture.md`.

### B1 – `tilematrix`-Parameter: war kein Fehler

**Ursprüngliche Vermutung:** Der Dienst könnte statt `tilematrix={z}` den
qualifizierten Wert `webmercator:{z}` erwarten.

**Befund:** Genau umgekehrt. Gegen den Live-Dienst geprüft (`diagnose.html`):

- `tilematrix={z}` → HTTP 200, gültige PNG-Kachel, auf allen Stufen z10–z18
- `tilematrix=webmercator:{z}` → HTTP 500, `internal error`

Der ursprüngliche Code war also korrekt; die Warnung war ein Fehlalarm.

**Dabei gefunden – echter latenter Fehler:** Die Capabilities deklarieren die
TileMatrix-Identifier zweistellig null-aufgefüllt (`"00"` … `"18"`). Bei
zweistelligen Zoomstufen fällt das nicht auf, unterhalb von z10 hätte der Code
aber `"4"` statt `"04"` gesendet. Da `minZoom` bei 4 liegt, war das erreichbar.
`seaTileUrl()` füllt jetzt auf zwei Stellen auf.

**Außerdem beseitigt:** Die URL wurde an zwei Stellen zusammengebaut
(Anzeige-Layer und Downloader), die auseinanderlaufen konnten. Beide nutzen
jetzt `seaTileUrl()`.
