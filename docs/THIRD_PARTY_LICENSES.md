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

## Kartendaten – Kartverket

- **Bezug:** zur Laufzeit als WMTS-Kacheln von `cache.kartverket.no`, nicht im
  Repository enthalten
- **Rechteinhaber:** Kartverket (norwegische Kartenbehörde)
- **Nutzung:** offener, kostenfreier Dienst ohne API-Key
- **Attribution:** wird als „© Kartverket" im Leaflet-Attribution-Control
  angezeigt (`createSeaChartLayer()` in `js/tilecache.js`)

## Schriften und Icons

Keine eingebetteten Fremdschriften – die App nutzt ausschließlich
System-Schriftarten. Die Toolbar-Symbole sind Unicode-Emoji, gerendert durch
die Emoji-Schrift des jeweiligen Systems; es wird keine Icon-Bibliothek
eingebunden.
