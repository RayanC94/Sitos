#!/usr/bin/env python3
"""
Génère assets/js/land.js : un échantillon de points [lat, lng] situés sur
les terres émergées, pour que le globe du hero dessine de vrais continents.

Source : NASA Blue Marble (domaine public), classification océan/terre par
dominance de bleu. À ne relancer que si l'on veut changer la densité.
"""

import json
import math
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent
OUT = ROOT / "assets" / "js" / "land.js"
SRC = "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg"
N_SAMPLES = 9000          # points testés sur la sphère (Fibonacci)

print("Téléchargement Blue Marble…")
req = urllib.request.Request(SRC, headers={"User-Agent": "LearningTripSiteBuilder/1.0"})
img = Image.open(BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
W, H = img.size
px = img.load()

def is_land(lat: float, lng: float) -> bool:
    x = int((lng + 180) / 360 * (W - 1))
    y = int((90 - lat) / 180 * (H - 1))
    r, g, b = px[x, y]
    return not (b > r + 12 and b > g + 4)     # océan = bleu dominant

points = []
golden = math.pi * (3 - math.sqrt(5))
for i in range(N_SAMPLES):
    yy = 1 - (i / (N_SAMPLES - 1)) * 2
    lat = math.degrees(math.asin(yy))
    lng = math.degrees((golden * i) % (2 * math.pi)) - 180
    if abs(lat) > 78:                          # coupe les pôles (bruit visuel)
        continue
    if is_land(lat, lng):
        points.append([round(lat, 1), round(lng, 1)])

OUT.write_text("window.LT_LAND=" + json.dumps(points, separators=(",", ":")) + ";\n")
print(f"✅ {len(points)} points de terre → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} Ko)")
