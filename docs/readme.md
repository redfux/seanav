# SeeNavi Bergen

Client-seitige, offline-fähige See-Navigations-App für die Region um Bergen.
Läuft komplett im Browser, keine Server-Komponente, keine CDN-Abhängigkeiten.

## Funktionsumfang

- Seekarte (Kartverket "Sjøkart Raster") als Kartenuntergrund
- Eigene Position per Geräte-GPS (`navigator.geolocation`)
- Aktueller Kurs (COG) als Linie auf der Karte
- Ziel per Klick auf die Karte setzen, mit Distanz/Peilung/ETA
- Projektion "wie weit in 1 min" / "wie lange für 200 m / 500 m" bei aktuellem Tempo
- Kartenausschnitte vorab für Offline-Nutzung herunterladen

## Kartenquelle

Verwendet wird der WMTS-Cache-Dienst des Kartverket (norwegische Seekartenbehörde):

```
https://cache.kartverket.no/v1/service
Layer: sjokartraster
Tile-Matrix-Set: webmercator (EPSG:3857)
```

Der Dienst ist kostenlos und ohne API-Key nutzbar. Die genaue Parametrisierung
(`tilematrix`-Wertformat) sollte einmalig gegen die aktuelle
`GetCapabilities`-Antwort geprüft werden:

```
https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml
```

Falls Kacheln nicht laden: Netzwerk-Tab im Browser prüfen, ob der
`tilematrix`-Parameter ggf. als `webmercator:{z}` statt nur `{z}` erwartet
wird, und in `tilecache.js` (zwei Stellen: `createSeaChartLayer` und
`downloadAreaForOffline`) entsprechend anpassen.

## Offline-Konzept

Zwei getrennte Cache-Mechanismen, bewusst nicht vermischt:

1. **App-Shell** (HTML/CSS/JS/Leaflet): Service Worker (`sw.js`), Cache-API.
   Lädt die App selbst auch ganz ohne Netz.
2. **Kartenkacheln**: IndexedDB (`tilecache.js`), da hier viele Einzeldateien
   mit eigener Fortschrittsanzeige und Größenkontrolle verwaltet werden müssen,
   wofür die einfache Cache-API weniger geeignet ist.

Ablauf für Offline-Nutzung:

1. Gewünschten Kartenausschnitt einstellen (zoomen/verschieben)
2. Über den ⬇️-Button das Offline-Panel öffnen
3. Maximale Zoomstufe wählen (höhere Stufe = mehr Detail, aber deutlich mehr
   Kacheln und Speicherbedarf)
4. "Sichtbaren Bereich laden" antippen – lädt alle Zoomstufen vom aktuellen
   bis zum gewählten Maximum für den sichtbaren Ausschnitt herunter
5. Bereits vorhandene Kacheln werden automatisch übersprungen; die App kann
   also mehrfach für angrenzende/überlappende Bereiche genutzt werden, ohne
   doppelt zu laden

Wichtig: Der Download muss bei bestehendem Internetzugang (z. B. zuhause oder
im Hafen mit WLAN) einmalig durchgeführt werden. Auf See ohne Empfang können
keine neuen Kacheln nachgeladen werden – dann werden fehlende Kacheln als
schraffierte Platzhalter angezeigt statt als kaputtes Bild.

## Grenzen / offene Punkte

- Es handelt sich um Papierkarten-Raster (georeferenzierte Rasterbilder),
  **keine** offiziellen ENC-Vektordaten (S-57/S-63) mit Attributen wie
  Tiefenlinien-Abfrage per Klick. Für reine Streckenplanung/Orientierung
  ausreichend, ersetzt aber kein zertifiziertes Navigationssystem.
- Die App ist ein Hilfsmittel zur Orientierung, keine Ersatz für
  vorschriftsmäßige Seekarten/Ausrüstung an Bord.
- Speed/Kurs-Glättung ist ein einfacher gleitender Mittelwert; bei sehr
  langsamer Fahrt (Anlegemanöver) können Werte etwas nachlaufen.
- IndexedDB-Speicherlimits sind browser-/geräteabhängig; bei sehr großen
  Kartenausschnitten mit hoher Zoomstufe ggf. den freien Speicherplatz im
  Browser prüfen.

## Versionierung

SemVer, aktuell `0.1.0`. Version ist zentral in `app.js` als `APP_VERSION`
definiert und erscheint automatisch im Footer.
