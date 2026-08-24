# Bugs

Bekannte Fehler und deren Lösung. Behobene Fehler bleiben mit ihrer Lösung
stehen, damit sie bei einem Rückfall wiederauffindbar sind.

## Offen

### B7 – Keine Tiefenlinien, weder im Flachen noch im Tiefen

**Symptom:** Der Tiefendaten-Layer zeichnet Lotungen, Grunde und Schären, aber
keine Tiefenkonturlinien. Anfangs sah es nach einem reinen Flachwasserproblem
aus; bei genauerem Hinsehen waren die vermeintlichen Konturen im Tiefwasser die
Umrisse von Grunden mit ihren Tiefenwerten.

**Vermutung:** Der Sublayer für Konturen ist im Gruppen-Request `Dybdedata2`
nicht enthalten. Die Layer-Liste des Dienstes führt neben der Gruppe unter
anderem `Dybdelag`, `Dybdekontur`, `Grunne`, `Skjær`, `Dybdepunkt` und
`Kystkontur`.

**Aktueller Versuch (0.7.0):** `Dybdekontur` wird als **eigene Ebene**
angefordert, nicht in denselben Request gemischt. Grund: ein WMS weist die
gesamte GetMap-Anfrage zurück, sobald ein Layer-Name unbekannt ist. Getrennt
kostet ein falscher Name nur diese eine Ebene, statt die Tiefendaten
komplett auszublenden.

**Falls die Ebene leer bleibt:** Der Name stimmt nicht oder der Layer ist an
dieser Stelle leer. Die tatsächlichen Namen listet `compare.html` live aus den
Capabilities – dort lassen sich die Sublayer auch einzeln durchschalten.

**Status:** offen, Prüfung durch den Nutzer ausstehend.

## Behoben

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
