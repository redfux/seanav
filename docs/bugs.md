# Bugs

Bekannte Fehler und deren Lösung. Behobene Fehler bleiben mit ihrer Lösung
stehen, damit sie bei einem Rückfall wiederauffindbar sind.

## Offen

### B3 – Karte bleibt zum Navigieren zu grob aufgelöst

**Symptom:** Auch nach dem High-DPI-Fix (B2) ist die Karte beim Hineinzoomen
grobklotzig: harte, perfekt quadratische Pixelblöcke mit reinen Farben.
Untiefen-Symbole sind sichtbar, tragen aber keine ablesbaren Tiefenangaben.

**Messung (Abschnitt 6 von `diagnose.html`, am Live-Dienst):**

| Zoom | Farben | Abweichung ggü. verdoppelter Stufe darunter |
| --- | --- | --- |
| z13 | 4097 | 54,2 % (Ø 28,2) |
| z14 | 4097 | 22,3 % (Ø 5,6) |
| z15 | 2983 | 14,2 % (Ø 3,8) |
| z16 | 619 | 7,4 % (Ø 2,0) |
| z17 | 664 | 5,0 % (Ø 1,5) |
| z18 | 478 | 3,1 % (Ø 1,1) |

Die Abweichung fällt monoton, und die Farbanzahl bricht zwischen z15 und z16
von 2983 auf 619 ein. Wenige Farben bei minimaler mittlerer Differenz =
hartkantig hochskaliert. **Nutzbares Kartendetail endet praktisch bei etwa
z15.** Die ursprüngliche Schwelle von 2 % stufte das Resampling-Rauschen der
oberen Stufen fälschlich als „echtes Detail" ein und wurde korrigiert.

**Konsequenz für B2:** Oberhalb dieser Grenze bringt `detectRetina` am WMTS
kein zusätzliches Detail, kostet aber die vierfache Kachelmenge. Unterhalb
hilft es weiterhin.

**Aussichtsreicher Weg (Abschnitt 7):** `wms.geonorge.no/skwms1/wms.sjokartraster2`
antwortet mit HTTP 200 und bietet unter anderem die Layer `all`, `overseiling`,
`overview`, `300serien` sowie einzelne Kartenblätter (`kart300`, `kart549` …).
Die 300er-Serie sind die detaillierten Hafenkarten. Ein WMS rendert den
angefragten Ausschnitt in der angefragten Pixelgröße und ist damit **nicht an
eine Kachelpyramide gebunden**; auf hochauflösenden Displays fordert Leaflet
dort 512×512 statt 256×256 an, also echte doppelte Pixelzahl.

**Nächster Schritt:** `compare.html` stellt beide Quellen synchronisiert
nebeneinander, damit sich Layer-Wahl und tatsächlicher Detailgewinn am realen
Dienst entscheiden lassen, bevor etwas davon in die App wandert.

**Status:** offen, Ursache geklärt, Lösungsweg identifiziert.

## Behoben

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
