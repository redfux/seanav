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

**Prüfen:**

```
https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml
```

Alternativ den Netzwerk-Tab des Browsers öffnen und den Statuscode der
Kachel-Requests ansehen.

**Lösung, falls nötig:** In `js/tilecache.js` an **zwei** Stellen anpassen –
`createSeaChartLayer()` (Template-String) und `downloadAreaForOffline()`
(URL-Aufbau im Worker). Beide müssen identisch bleiben, sonst weichen
Online-Anzeige und Offline-Download voneinander ab.

**Status:** offen, noch nicht am realen Dienst getestet.

## Behoben

Bisher keine.
