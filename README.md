# SeeNavi Bergen

Offline-fähige See-Navigations-App für die Region um Bergen — rein
client-seitig, ohne Server-Komponente und ohne CDN-Abhängigkeiten
(Leaflet liegt lokal unter `vendor/`).

**Live:** https://redfux.github.io/seanav/

Vollständige Dokumentation (Funktionsumfang, Kartenquelle, Offline-Konzept,
Grenzen): [`docs/readme.md`](docs/readme.md)

## Lokal starten

Ein statischer Webserver genügt — `file://` funktioniert nicht, da Service
Worker und IndexedDB einen echten Origin brauchen:

```
python3 -m http.server 8000
```

Dann http://localhost:8000/ öffnen.

## Deployment

GitHub Pages, Quelle: Branch `main`, Ordner `/` (root). `.nojekyll` schaltet
die Jekyll-Verarbeitung ab, alle Pfade sind relativ und funktionieren daher
auch unter dem Unterpfad `/seanav/`.

---

thought up by human, created by ai · v0.1.0
