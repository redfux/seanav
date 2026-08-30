# Lizenzen von Fremdkomponenten

Alle Fremdkomponenten sind lokal im Repository eingebettet; es wird zur
Laufzeit nichts von einem CDN nachgeladen.

## Leaflet 1.9.4

- **Dateien:** `vendor/leaflet.js`, `vendor/leaflet.css`,
  `vendor/images/marker-icon.png`, `vendor/images/marker-icon-2x.png`,
  `vendor/images/marker-shadow.png`
- **Copyright:** (c) 2010–2023 Vladimir Agafonkin, (c) 2010–2011 CloudMade
- **Lizenz:** BSD-2-Clause
- **Projektseite:** https://leafletjs.com

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

## Kartendaten – OpenStreetMap

- **Bezug:** zur Laufzeit als Kacheln von `tile.openstreetmap.org`, nicht im
  Repository enthalten
- **Rechteinhaber:** OpenStreetMap-Mitwirkende
- **Lizenz:** Open Database License (ODbL) 1.0. Die Namensnennung ist
  **verpflichtend** und erscheint als „© OpenStreetMap" mit Link auf
  https://www.openstreetmap.org/copyright im Kartennachweis der Fußleiste.
- **Nutzungsbedingungen:** https://operations.osmfoundation.org/policies/tiles/
  Bulk-Downloading ist untersagt; die App speichert ausschließlich Kacheln,
  die tatsächlich angezeigt wurden, und bietet keinen Vorab-Download.

## Kartendaten – Kartverket

- **Bezug:** zur Laufzeit als WMS-Bilder von `wms.geonorge.no`, nicht im
  Repository enthalten
- **Rechteinhaber:** Kartverket (norwegische Kartenbehörde)
- **Nutzung:** offener, kostenfreier Dienst ohne API-Key
- **Abdeckung:** norwegische Gewässer
- **Attribution:** wird als „© Kartverket" im Kartennachweis der Fußleiste
  angezeigt (Quellen-Registry in `js/sources.js`)

## Kartendaten – EMODnet Bathymetry

- **Bezug:** zur Laufzeit als WMS-Bilder von `ows.emodnet-bathymetry.eu`,
  Ebene `contours`; nicht im Repository enthalten
- **Rechteinhaber:** EMODnet Bathymetry Consortium (EU)
- **Lizenz:** CC-BY 4.0 – Namensnennung verpflichtend, erscheint als
  „© EMODnet Bathymetry (CC-BY 4.0)" mit Link im Kartennachweis
- **Nutzung:** offener Dienst ohne API-Key
- **Abdeckung:** europäische Gewässer einschließlich Kanaren und Mittelmeer

## Kartendaten – Instituto Hidrográfico de la Marina (IHM)

- **Bezug:** zur Laufzeit als WMS-Bilder von `ideihm.covam.es`, Ebene
  `grupo_2` der Kartenzwecke `cartaENCp3`–`p5`; nicht im Repository enthalten
- **Rechteinhaber:** Instituto Hidrográfico de la Marina (Spanien)
- **Nutzung:** frei einsehbarer Dienst ohne API-Key; kommerzielle Nutzung ist
  vertragspflichtig. Der Anbieter weist ausdrücklich darauf hin, dass die
  Darstellung **nicht zur Navigation** dient
- **Attribution:** „© Instituto Hidrográfico de la Marina" im Kartennachweis
- **Abdeckung:** spanische Gewässer einschließlich der Kanaren

## Kartendaten – OpenSeaMap

- **Bezug:** zur Laufzeit als Kacheln von `tiles.openseamap.org`
- **Lizenz:** CC-BY-SA, Namensnennung im Kartennachweis der Fußleiste

## Schriften und Icons

Keine eingebetteten Fremdschriften – die App nutzt ausschließlich
System-Schriftarten. Die Symbole der Oberfläche sind selbst gezeichnete
Inline-SVGs, einmal in `index.html` als `<defs>` abgelegt und per `<use>`
referenziert; es wird weder eine Icon-Bibliothek noch ein Icon-Font
eingebunden. Die früheren Unicode-Emoji sind seit 0.7.0 ersetzt.

## Verlinkte fremde Dienste

„Schiffe in der Nähe" öffnet die öffentliche AIS-Karte von VesselFinder in
einem neuen Tab. Das ist ein Hyperlink: es werden keine Daten von dort
geladen, nichts eingebettet und nichts gespeichert, weshalb daraus auch keine
Lizenzpflicht entsteht.
