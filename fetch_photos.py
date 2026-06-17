#!/usr/bin/env python3
"""
Télécharge une photo libre de droits (Wikimedia Commons) pour chaque
destination du site vitrine. Approche BUILD-TIME, aucune clé API requise.

  python3 fetch_photos.py            # télécharge ce qui manque
  python3 fetch_photos.py --force    # re-télécharge tout

Les images vont dans assets/img/destinations/<slug>.jpg
Les crédits (licence Commons) dans assets/img/destinations/credits.json
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
OUT_DIR = ROOT / "assets" / "img" / "destinations"
CREDITS = OUT_DIR / "credits.json"
FORCE = "--force" in sys.argv

UA = "LearningTripSiteBuilder/1.0 (contact@learningtrip.fr)"

# slug -> requête Commons (modifiable : relancer avec --force pour ré-essayer)
QUERIES = {
    "dubai":       "Burj Khalifa night Dubai downtown",
    "montreal":    "Montreal skyline Mount Royal view",
    "tokyo":       "Shibuya crossing Tokyo",
    "seoul":       "Seoul Gyeongbokgung palace",
    "kuala-lumpur":"Petronas Towers Kuala Lumpur",
    "shanghai":    "Shanghai Pudong skyline",
    "taipei":      "Taipei 101 skyline",
    "ho-chi-minh": "Ho Chi Minh City Nguyen Hue night",
    "seville":     "Plaza de Espana Seville",
    "tanger":      "Tangier Morocco city view sea",
    "istanbul":    "Istanbul Hagia Sophia",
}


def api(params: dict) -> dict:
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def best_candidate(query: str) -> dict | None:
    """Cherche sur Commons, renvoie la meilleure image paysage >= 1600px."""
    data = api({
        "action": "query", "format": "json",
        "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": 6, "gsrlimit": 12,
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": 1800,
    })
    pages = (data.get("query") or {}).get("pages") or {}
    cands = []
    for p in pages.values():
        info = (p.get("imageinfo") or [{}])[0]
        w, h = info.get("width", 0), info.get("height", 0)
        if w < 1600 or h < 900 or w / max(h, 1) < 1.2:   # paysage uniquement
            continue
        if p.get("title", "").lower().endswith((".svg", ".gif", ".tif", ".tiff")):
            continue
        cands.append((p.get("index", 99), p, info))
    if not cands:
        return None
    cands.sort(key=lambda c: c[0])           # ordre de pertinence Commons
    _, page, info = cands[0]
    meta = info.get("extmetadata") or {}

    def field(k):
        v = (meta.get(k) or {}).get("value") or ""
        # strip html sommaire
        import re
        return re.sub(r"<[^>]+>", "", v).strip()

    return {
        "title": page.get("title"),
        "thumb": info.get("thumburl") or info.get("url"),
        "page": info.get("descriptionurl"),
        "author": field("Artist") or "Wikimedia Commons",
        "license": field("LicenseShortName") or "voir page Commons",
    }


def download(slug: str, query: str, credits: dict) -> None:
    out = OUT_DIR / f"{slug}.jpg"
    if out.exists() and not FORCE:
        print(f"  ✓ {slug:14s} (déjà téléchargé)")
        return
    cand = best_candidate(query)
    if not cand:
        print(f"  ✗ {slug:14s} aucun résultat pour « {query} »")
        return
    req = urllib.request.Request(cand["thumb"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        out.write_bytes(r.read())
    credits[slug] = {k: cand[k] for k in ("title", "page", "author", "license")}
    print(f"  ✓ {slug:14s} ← {cand['author'][:40]} ({cand['license']})")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits = json.loads(CREDITS.read_text()) if CREDITS.exists() else {}
    for slug, query in QUERIES.items():
        try:
            download(slug, query, credits)
        except Exception as e:
            print(f"  ✗ {slug:14s} {e}")
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2))
    print(f"\n✅ Images dans {OUT_DIR.relative_to(ROOT)}/ — crédits dans credits.json")


if __name__ == "__main__":
    main()
