# SeeNavi Bergen

Client-seitige, offline-fähige See-Navigations-App für die Region um Bergen.
Läuft komplett im Browser, keine Server-Komponente, keine CDN-Abhängigkeiten,
kein Build-Schritt.

**Live:** https://redfux.github.io/seanav/

> **Hinweis:** Die App ist ein Hilfsmittel zur Orientierung und **kein Ersatz**
> für vorschriftsmäßige Seekarten und Ausrüstung an Bord. Kartengrundlage sind
> georeferenzierte Rasterkarten, keine zertifizierten ENC-Vektordaten.

## Funktionsumfang

- Weltweite Grundkarte (OpenStreetMap)
- Tiefenlinien, Lotungen, Grunde und Schären aus den Kartverket-Tiefendaten (nur norwegische Gewässer)
- Seezeichen (Tonnen, Baken, Feuer) aus OpenSeaMap
- Einzelne Kartenebenen über 🗺️ ein- und ausschaltbar
- Eigene Position per Geräte-GPS (`navigator.geolocation`)
- Aktueller Kurs (COG) als Linie auf der Karte
- Ziel per Klick auf die Karte setzen, mit Distanz/Peilung/ETA
- Projektion „wie weit in 1 min" / „wie lange für 200 m / 500 m" bei aktuellem Tempo
- Angesehene Kartenausschnitte bleiben ohne Empfang verfügbar

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

### Kartenspeicher

Kartenausschnitte, die du angesehen hast, werden automatisch gespeichert und
stehen ohne Empfang weiter zur Verfügung. Eine bereits abgefahrene Strecke
bleibt also verfügbar, ein unbekanntes Revier nicht.

Einen Vorab-Download ganzer Gebiete gibt es nicht: die Nutzungsbedingungen von
`tile.openstreetmap.org` untersagen das Herunterladen von Kacheln, die niemand
angesehen hat. Über 💾 lässt sich der Speicherstand einsehen und leeren.

## Datenspeicherung

Alles bleibt lokal auf dem Gerät. Es gibt keine Server-Komponente, keine
Analytics- und keine Tracking-Skripte, und es werden keinerlei Positions- oder
Nutzungsdaten übertragen.

| Speicher | Inhalt | Zweck |
| --- | --- | --- |
| IndexedDB (`seenavi-tiles`) | Kartenkacheln als Blobs, Schlüssel `quelle/z/x/y` | angesehene Ausschnitte ohne Empfang |
| `localStorage` | welche Kartenebenen eingeschaltet sind | Auswahl bleibt erhalten |
| Cache API (`seenavi-shell-v<version>`) | App-Shell: HTML/CSS/JS/Leaflet | App startet ohne Netz |

Die GPS-Position wird ausschließlich im Arbeitsspeicher gehalten und nicht
persistiert. Zurücksetzen lässt sich beides über „Websitedaten löschen" in den
Browser-Einstellungen.

Ausgehende Verbindungen bestehen ausschließlich zum Abruf von Kartenkacheln:
`tile.openstreetmap.org` (Grundkarte), `wms.geonorge.no` (Tiefendaten) und
`tiles.openseamap.org` (Seezeichen). Die Content-Security-Policy in
`index.html` unterbindet alles darüber hinaus technisch.

## Weiterführende Dokumentation

| Datei | Inhalt |
| --- | --- |
| [`docs/releases.md`](docs/releases.md) | Änderungshistorie (Keep a Changelog, SemVer) |
| [`docs/features.md`](docs/features.md) | Anforderungen an das Programm |
| [`docs/architecture.md`](docs/architecture.md) | Technische Entscheidungen, Datenmodell |
| [`docs/bugs.md`](docs/bugs.md) | Bekannte Fehler und deren Lösung |
| [`docs/changes.md`](docs/changes.md) | Eingangskorb für gewünschte Änderungen |
| [`docs/THIRD_PARTY_LICENSES.md`](docs/THIRD_PARTY_LICENSES.md) | Lizenzen eingebetteter Fremdkomponenten |

Zusätzlich gibt es `diagnose.html` – eine Wartungsseite, die prüft, was der
Kartverket-WMTS tatsächlich liefert (Layer, Zoomstufen, Parametrisierung).
Sie gehört nicht zur App und kann entfernt werden, sobald B1/B2 in
`docs/bugs.md` geklärt sind.

## Lizenz

MIT, siehe [`LICENSE`](LICENSE).

---

thought up by human, coded by ai
