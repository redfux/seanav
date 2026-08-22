# SeeNavi Bergen

Client-seitige, offline-fähige See-Navigations-App für die Region um Bergen.
Läuft komplett im Browser, keine Server-Komponente, keine CDN-Abhängigkeiten,
kein Build-Schritt.

**Live:** https://redfux.github.io/seanav/

> **Hinweis:** Die App ist ein Hilfsmittel zur Orientierung und **kein Ersatz**
> für vorschriftsmäßige Seekarten und Ausrüstung an Bord. Kartengrundlage sind
> georeferenzierte Rasterkarten, keine zertifizierten ENC-Vektordaten.

## Funktionsumfang

- Seekarte (Kartverket „Sjøkart Raster") als Kartenuntergrund
- Eigene Position per Geräte-GPS (`navigator.geolocation`)
- Aktueller Kurs (COG) als Linie auf der Karte
- Ziel per Klick auf die Karte setzen, mit Distanz/Peilung/ETA
- Projektion „wie weit in 1 min" / „wie lange für 200 m / 500 m" bei aktuellem Tempo
- Kartenausschnitte vorab für Offline-Nutzung herunterladen

## Setup

Kein Build, keine Abhängigkeiten zu installieren. Ein statischer Webserver
genügt – `file://` funktioniert **nicht**, da Service Worker, IndexedDB und
Geolocation einen echten Origin (bzw. HTTPS oder `localhost`) voraussetzen:

```
python3 -m http.server 8000
```

Dann http://localhost:8000/ öffnen.

Deployment erfolgt über GitHub Pages (Quelle: Branch `main`, Ordner `/`).
`.nojekyll` schaltet die Jekyll-Verarbeitung ab; alle Pfade im Quelltext sind
relativ und funktionieren daher auch unter dem Unterpfad `/seanav/`.

## Nutzung

### Navigation

1. App öffnen und den Standortzugriff erlauben – die Statusleiste oben zeigt
   Kurs, Geschwindigkeit (in Knoten) und GPS-Status
2. Ziel per Klick/Tap auf die Karte setzen – das Navigationspanel zeigt
   Distanz, Peilung und ETA, „Ziel löschen" entfernt es wieder
3. 📍 springt zur eigenen Position, 📐 blendet die Kurs-Projektion ein/aus

### Kartenausschnitte offline speichern

Der Download muss bei bestehendem Internetzugang durchgeführt werden (z. B.
zuhause oder im Hafen mit WLAN). Auf See ohne Empfang können keine neuen
Kacheln nachgeladen werden – fehlende Kacheln erscheinen dann als schraffierte
Platzhalter statt als kaputtes Bild.

1. Gewünschten Kartenausschnitt einstellen (zoomen/verschieben)
2. Über den ⬇️-Button das Offline-Panel öffnen
3. Maximale Zoomstufe wählen (höhere Stufe = mehr Detail, aber deutlich mehr
   Kacheln und Speicherbedarf)
4. „Sichtbaren Bereich laden" antippen – lädt alle Zoomstufen vom aktuellen
   bis zum gewählten Maximum für den sichtbaren Ausschnitt herunter
5. Bereits vorhandene Kacheln werden übersprungen; die App kann also mehrfach
   für angrenzende/überlappende Bereiche genutzt werden, ohne doppelt zu laden

## Datenspeicherung

Alles bleibt lokal auf dem Gerät. Es gibt keine Server-Komponente, keine
Analytics- und keine Tracking-Skripte, und es werden keinerlei Positions- oder
Nutzungsdaten übertragen.

| Speicher | Inhalt | Zweck |
| --- | --- | --- |
| IndexedDB (`seenavi-tiles`) | Kartenkacheln als Blobs, Schlüssel `z/x/y` | Offline-Kartennutzung |
| Cache API (`seenavi-shell-v<version>`) | App-Shell: HTML/CSS/JS/Leaflet | App startet ohne Netz |

Die GPS-Position wird ausschließlich im Arbeitsspeicher gehalten und nicht
persistiert. Zurücksetzen lässt sich beides über „Websitedaten löschen" in den
Browser-Einstellungen.

Einzige ausgehende Verbindung ist der Kachelabruf von
`cache.kartverket.no`; die Content-Security-Policy in `index.html` unterbindet
alles darüber hinaus technisch.

## Weiterführende Dokumentation

| Datei | Inhalt |
| --- | --- |
| [`docs/releases.md`](docs/releases.md) | Änderungshistorie (Keep a Changelog, SemVer) |
| [`docs/features.md`](docs/features.md) | Anforderungen an das Programm |
| [`docs/architecture.md`](docs/architecture.md) | Technische Entscheidungen, Datenmodell |
| [`docs/bugs.md`](docs/bugs.md) | Bekannte Fehler und deren Lösung |
| [`docs/changes.md`](docs/changes.md) | Eingangskorb für gewünschte Änderungen |
| [`docs/THIRD_PARTY_LICENSES.md`](docs/THIRD_PARTY_LICENSES.md) | Lizenzen eingebetteter Fremdkomponenten |

## Lizenz

MIT, siehe [`LICENSE`](LICENSE).

---

thought up by human, coded by ai
