# Bugs

Bekannte Fehler und deren Lösung. Behobene Fehler bleiben mit ihrer Lösung
stehen, damit sie bei einem Rückfall wiederauffindbar sind.

## Offen

### B3 – Karte bleibt zum Navigieren zu grob aufgelöst

**Symptom:** Auch nach dem High-DPI-Fix (B2) ist die Karte beim Hineinzoomen
grobklotzig: harte, perfekt quadratische Pixelblöcke mit reinen Farben.
Untiefen-Symbole sind sichtbar, tragen aber keine ablesbaren Tiefenangaben.

**Erste Eingrenzung:** Weder `style.css` noch `vendor/leaflet.css` setzen
`image-rendering: pixelated` (Leaflet nur für Safari). Browser interpolieren
beim Vergrößern normalerweise weich – die harten Blöcke müssen also aus den
gelieferten Kacheln selbst stammen. Der Dienst liefert zwar auf allen Stufen
bis z18 HTTP 200, oberhalb der nativen Auflösung des Kartenrasters aber
offenbar nur hochskalierte Kacheln.

**Konsequenz für B2:** Oberhalb dieser Grenze bringt `detectRetina` kein
zusätzliches Detail – die tiefere Stufe enthält dieselbe Information, nur
größer gerechnet – kostet aber die vierfache Kachelmenge. Unterhalb der Grenze
hilft es weiterhin.

**Nächster Schritt:** Abschnitt 6 von `diagnose.html` misst die Grenze und
liefert den Wert für `maxNativeZoom`. Abschnitt 7 prüft, ob ein WMS-Endpunkt
erreichbar ist, der nicht an eine feste Kachelpyramide gebunden ist.

**Status:** offen, Messung ausstehend.

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
