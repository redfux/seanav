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
- Tiefenzonen, Lotungen, Grunde und Schären aus den Kartverket-Tiefendaten (nur norwegische Gewässer); Tiefenlinien dort, wo der Dienst sie führt
- Tiefenlinien für europäische Gewässer aus EMODnet Bathymetry – Kanaren und Mittelmeer eingeschlossen
- Offizielle spanische Seekarte (IHM) mit Lotungen, Felsen, Wracks und Hindernissen – für spanische Gewässer inklusive der Kanaren
- Seezeichen (Tonnen, Baken, Feuer) aus OpenSeaMap
- Einzelne Kartenebenen über 🗺️ ein- und ausschaltbar
- Eigene Position per Geräte-GPS (`navigator.geolocation`)
- Eigene Position als Bootssymbol, gedreht in den aktuellen Kurs
- Karte wahlweise nordwärts oder in Fahrtrichtung gedreht
- Karte folgt der Position, bis man sie verschiebt
- Bildschirm bleibt an, solange die App vorn ist
- Aktueller Kurs (COG) als Linie auf der Karte
- Geschwindigkeit wahlweise in Knoten oder km/h – Antippen schaltet um
- Ziel per Klick auf die Karte setzen, mit Distanz/Peilung/ETA; nach einer
  Minute ohne Änderung fixiert es sich gegen versehentliches Verschieben
- Marken von 200 m bis 10 km auf der Kurslinie, mit der jeweils benötigten Fahrzeit – je nach Zoomstufe die nahen oder die fernen
- Angesehene Kartenausschnitte bleiben ohne Empfang verfügbar
- Als App installierbar (PWA) – startet dann ohne Browserleiste

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
3. Der oberste Knopf trägt Position und Ausrichtung zugleich. Zeigt er ein
   **Fadenkreuz**, holt ein Tipp das Boot zurück in die Mitte – die Zoomstufe
   bleibt dabei, wie sie ist. Zeigt er einen **Kompass**, folgt die Karte
   bereits, und jeder weitere Tipp wechselt zwischen **Nordung** (Karte steht,
   Boot dreht) und **Fahrtrichtung** (Karte dreht, Boot zeigt nach oben). Die
   Nadel im Knopf zeigt immer nach Norden
4. Mit **zwei Fingern** lässt sich die Karte frei drehen; nahe Norden rastet
   sie ein, ein Tipp auf den Knopf stellt sie gerade und zentriert wieder
5. Ein Tipp auf die Geschwindigkeit schaltet zwischen Knoten und km/h
6. 📐 blendet die Distanzmarken auf der Kurslinie ein/aus

Der Bildschirm bleibt an, solange die App im Vordergrund ist. Lehnt der Browser
das ab, sagt die App es einmal – dann schaltet sich das Display wie gewohnt ab.

Das Ziel fixiert sich eine Minute nach der letzten Änderung: ab dann verschiebt
ein Tap auf die Karte es nicht mehr, der Marker bekommt einen leuchtenden Rand
und die Karte sagt es an. Aufgehoben wird die Fixierung nur über „Ziel
löschen" – auf einem schwankenden Boot ist ein versehentlich verschobenes Ziel
sonst leicht übersehen.

### Installation

Beim ersten Besuch bietet die App die Installation selbst an; der Hinweis lässt
sich mit „Nicht jetzt" dauerhaft wegklicken.

- **Android/Chrome, Edge, Desktop-Chrome:** „Installieren" im Hinweis oder im
  Browsermenü
- **iPhone/iPad (Safari):** Teilen-Symbol → „Zum Home-Bildschirm". Safari kennt
  keine automatische Installation, deshalb beschreibt der Hinweis dort nur den
  Weg

Installiert startet SeeNavi im Vollbild ohne Browserleiste, mit eigenem Icon
und – dank Service Worker – auch ohne Empfang.

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
| `localStorage` | welche Kartenebenen eingeschaltet sind, ob die Zielkarte eingeklappt ist, ob der Installationshinweis weggeklickt wurde | Einstellungen bleiben erhalten |
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
