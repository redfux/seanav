# Bugs

Bekannte Fehler und deren Lösung. Behobene Fehler bleiben mit ihrer Lösung
stehen, damit sie bei einem Rückfall wiederauffindbar sind.

## Offen

### B1 – `tilematrix`-Parameter noch nicht gegen GetCapabilities verifiziert

**Symptom (erwartet):** Es werden keine Kartenkacheln geladen, die Karte bleibt
leer bzw. zeigt nur schraffierte Platzhalter, obwohl eine Netzverbindung
besteht.

**Ursache:** Die Kachel-URL in `js/tilecache.js` übergibt `tilematrix={z}`, also
nur die reine Zoomstufe. Manche WMTS-Dienste erwarten den qualifizierten Wert
`webmercator:{z}`. Welche Variante `cache.kartverket.no` verlangt, wurde bisher
nicht gegen die Capabilities geprüft.

**Prüfen:** `diagnose.html` im Browser öffnen (unter GitHub Pages:
`https://redfux.github.io/seanav/diagnose.html`). Die Seite testet beide
Varianten nebeneinander, liest die Capabilities aus und zeigt die gelieferten
Kacheln als Bild an. Alternativ direkt:

```
https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml
```

**Lösung, falls nötig:** In `js/tilecache.js` an **zwei** Stellen anpassen –
`createSeaChartLayer()` (Template-String) und `downloadAreaForOffline()`
(URL-Aufbau im Worker). Beide müssen identisch bleiben, sonst weichen
Online-Anzeige und Offline-Download voneinander ab.

**Status:** offen. Aus der Entwicklungsumgebung ist `cache.kartverket.no`
nicht erreichbar (Netzwerk-Policy, 403 beim CONNECT), daher nur per
`diagnose.html` aus dem Browser des Nutzers prüfbar.

### B2 – Kartendarstellung zu grob, keine Tiefenwerte erkennbar

**Symptom:** Beim Reinzoomen bleibt nur unscharfer Pixelbrei; Untiefen und
Hindernisse sind nicht zu erkennen, Tiefenzahlen fehlen ganz.

**Analyse (Teil 1, erwartbar):** `sjokartraster` sind gerasterte Papierseekarten
mit fester Auflösung. Oberhalb der Kartenauflösung wird nur noch hochskaliert.
Der Layer ist auf `maxZoom: 17` gesetzt, ohne `maxNativeZoom` – man kann also
weit über die echte Detailstufe hinauszoomen. Ein `maxNativeZoom` würde Leaflet
sauber hochskalieren lassen, statt den Eindruck zu erwecken, es gäbe dort noch
Detail.

**Analyse (Teil 2, verdächtig):** Norwegische Papierseekarten tragen
flächendeckend Lotungen. Dass **gar keine** Tiefenzahlen erscheinen, spricht
dafür, dass möglicherweise nicht `sjokartraster` ausgeliefert wird – was
unmittelbar mit B1 zusammenhängt: liefert der Dienst bei falschem
`tilematrix`-Wert einen Default- oder Fallback-Layer, ergäbe sich genau dieses
Bild. Abschnitt 5 von `diagnose.html` stellt deshalb mehrere Layer nebeneinander;
sehen `sjokartraster` und `topo` dort identisch aus, ist der Layer-Name wirkungslos.

**Status:** offen, Ursachenklärung läuft über `diagnose.html`. Erst danach
sinnvoll zu fixen – ohne zu wissen, was der Dienst liefert, wäre jede Anpassung
geraten.

**Nicht durch Code lösbar:** Tiefenwerte *abfragbar* (Klick auf eine Stelle →
Tiefe) machen Rasterkarten grundsätzlich nicht – dafür bräuchte es Vektordaten
(ENC/S-57 oder ein Bathymetrie-Dataset). Siehe `architecture.md`.

## Behoben

Bisher keine.
