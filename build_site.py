#!/usr/bin/env python3
"""
Génère le site vitrine Learning Trip à partir de data/destinations.json :

  - sejours/<slug>.html            (une page par séjour, depuis templates/sejour.html)
  - assets/js/destinations.js     (données cartes + simulateur, côté client)
  - mentions-legales.html         (depuis templates/legal.html + crédits photos)
  - sitemap.xml

Usage :  python3 build_site.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "data" / "destinations.json").read_text())
SITE = DATA["site"]
DESTS = DATA["destinations"]
CREDITS_FILE = ROOT / "assets" / "img" / "destinations" / "credits.json"


def render(template: str, mapping: dict) -> str:
    out = template
    for key, value in mapping.items():
        out = out.replace("{{" + key + "}}", str(value))
    return out


def dest_card(d: dict, prefix: str = "") -> str:
    return (
        f'      <a class="dest-card reveal" href="{prefix}sejours/{d["slug"]}.html" '
        f'data-themes="{" ".join(d["themes"])}">\n'
        f'        <img class="bg" src="{prefix}assets/img/destinations/{d["slug"]}.jpg" '
        f'alt="{d["ville"]}, {d["pays"]}" loading="lazy">\n'
        f'        <span class="go">→</span>\n'
        f'        <div class="body"><span class="pays">{d["pays"]}</span>'
        f'<h3>{d["ville"]}</h3><span class="baseline">{d["baseline"]}</span></div>\n'
        f"      </a>"
    )


def referent_block(d: dict) -> str:
    """Carte « référent sur place ». Photo si le fichier existe, sinon monogramme."""
    r = d.get("referent")
    if not r:
        return ""
    photo = r.get("photo", "")
    photo_path = ROOT / "assets" / "img" / "referents" / photo if photo else None
    if photo_path and photo_path.exists():
        avatar = (
            f'<img class="ref-avatar" src="../assets/img/referents/{photo}" '
            f'alt="{r["nom"]}, référent Learning Trip" loading="lazy">'
        )
    else:
        initials = "".join(w[0] for w in r["nom"].split()[:2]).upper() or "LT"
        avatar = f'<span class="ref-avatar ref-avatar--mono" aria-hidden="true">{initials}</span>'
    return (
        '<section class="section" id="referent">\n'
        '  <div class="container">\n'
        '    <div class="referent reveal">\n'
        f'      {avatar}\n'
        '      <div class="ref-body">\n'
        '        <span class="sticker">Votre référent sur place</span>\n'
        f'        <h2>{r["nom"]}</h2>\n'
        f'        <p class="ref-role">{r["role"]}</p>\n'
        f'        <p class="ref-bio">{r.get("bio", "")}</p>\n'
        '      </div>\n'
        '    </div>\n'
        '  </div>\n'
        '</section>'
    )


def gallery_block(d: dict) -> str:
    """Galerie photos « vécu » du séjour. Rendu seulement si des photos existent."""
    g = d.get("gallery")
    if not g:
        return ""
    base = f'../assets/img/sejours/{d["slug"]}/'
    hero = g["hero"]
    hero_html = (
        '    <figure class="gallery-hero reveal">\n'
        f'      <img src="{base}{hero["img"]}" alt="{hero["alt"]}" loading="lazy">\n'
        '      <figcaption>'
        f'<b>{hero.get("kicker", "")}</b><span>{hero["caption"]}</span>'
        '</figcaption>\n'
        '    </figure>'
    )
    items = "\n".join(
        '      <figure class="gallery-item reveal">'
        f'<img src="{base}{p["img"]}" alt="{p["alt"]}" loading="lazy">'
        f'<figcaption>{p["caption"]}</figcaption></figure>'
        for p in g["photos"]
    )
    return (
        '<section class="section" id="galerie">\n'
        '  <div class="container">\n'
        '    <div class="section-head reveal">\n'
        '      <span class="sticker">En images</span>\n'
        f'      <h2>{g["titre"]}</h2>\n'
        f'      <p>{g.get("intro", "")}</p>\n'
        '    </div>\n'
        f'{hero_html}\n'
        '    <div class="gallery-grid">\n'
        f'{items}\n'
        '    </div>\n'
        '  </div>\n'
        '</section>'
    )


def build_sejours() -> None:
    template = (ROOT / "templates" / "sejour.html").read_text()
    out_dir = ROOT / "sejours"
    out_dir.mkdir(exist_ok=True)

    for i, d in enumerate(DESTS):
        experiences = "\n".join(
            f'      <article class="exp reveal reveal-d{n % 4}">'
            f'<span class="pilier">{e["pilier"]}</span>'
            f'<h3>{e["titre"]}</h3><p>{e["texte"]}</p></article>'
            for n, e in enumerate(d["experiences"])
        )
        moments = "\n".join(
            f'      <div class="moment reveal"><span class="n">0{n + 1}</span>'
            f'<p>{m}</p></div>'
            for n, m in enumerate(d["moments"])
        )
        # 3 suggestions : les destinations suivantes dans le catalogue
        others = [DESTS[(i + k) % len(DESTS)] for k in (1, 2, 3)]
        others_html = "\n".join(dest_card(o, "../") for o in others)
        # les cartes "autres séjours" pointent vers le même dossier
        others_html = others_html.replace('href="../sejours/', 'href="')

        html = render(template, {
            "SLUG": d["slug"],
            "VILLE": d["ville"],
            "PAYS": d["pays"],
            "CONTINENT": d["continent"],
            "BASELINE": d["baseline"],
            "PITCH": d["pitch"],
            "VOL": d["vol"],
            "DECALAGE": d["decalage"],
            "LANGUES": d["langues"],
            "PERIODE": d["periode"],
            "META_DESCRIPTION": d["meta_description"],
            "EXPERIENCES_HTML": experiences,
            "MOMENTS_HTML": moments,
            "GALLERY_HTML": gallery_block(d),
            "REFERENT_HTML": referent_block(d),
            "OTHERS_HTML": others_html,
            "SITE_URL": SITE["url"],
            "EMAIL": SITE["email"],
            "TEL": SITE["telephone"],
            "TEL_INTL": SITE["telephone_intl"],
        })
        (out_dir / f"{d['slug']}.html").write_text(html)
    print(f"✅ {len(DESTS)} pages séjour → sejours/")


def build_destinations_js() -> None:
    payload = [
        {
            "slug": d["slug"], "ville": d["ville"], "pays": d["pays"],
            "baseline": d["baseline"], "themes": d["themes"], "tier": d["tier"],
            "lat": d["lat"], "lng": d["lng"],
            "img": f"assets/img/destinations/{d['slug']}.jpg",
            "url": f"sejours/{d['slug']}.html",
        }
        for d in DESTS
    ]
    out = ROOT / "assets" / "js" / "destinations.js"
    out.write_text(
        "window.LT_DESTINATIONS=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    print(f"✅ {out.relative_to(ROOT)}")


def build_index() -> None:
    template = (ROOT / "templates" / "index.html").read_text()
    cards = "\n".join(dest_card(d) for d in DESTS)
    html = render(template, {
        "DEST_CARDS": cards,
        "SITE_URL": SITE["url"],
        "EMAIL": SITE["email"],
        "TEL": SITE["telephone"],
        "TEL_INTL": SITE["telephone_intl"],
    })
    (ROOT / "index.html").write_text(html)
    print("✅ index.html")


def build_legal() -> None:
    template_path = ROOT / "templates" / "legal.html"
    if not template_path.exists():
        print("ℹ️  templates/legal.html absent — page légale non régénérée")
        return
    credits = json.loads(CREDITS_FILE.read_text()) if CREDITS_FILE.exists() else {}
    by_slug = {d["slug"]: d["ville"] for d in DESTS}
    items = "\n".join(
        f'      <li>{by_slug.get(slug, slug)} : <a href="{c["page"]}" rel="noopener" target="_blank">'
        f'{c["author"]}</a> — licence {c["license"]} (Wikimedia Commons)</li>'
        for slug, c in sorted(credits.items())
    )
    html = render(template_path.read_text(), {
        "CREDITS_HTML": items,
        "SITE_URL": SITE["url"],
        "EMAIL": SITE["email"],
        "TEL": SITE["telephone"],
        "TEL_INTL": SITE["telephone_intl"],
    })
    (ROOT / "mentions-legales.html").write_text(html)
    print("✅ mentions-legales.html")


def build_brochure() -> None:
    template_path = ROOT / "templates" / "brochure.html"
    if not template_path.exists():
        return
    out_dir = ROOT / "assets" / "brochure"
    out_dir.mkdir(exist_ok=True)

    # photos compressées pour garder un PDF léger
    ph_dir = out_dir / "ph"
    ph_dir.mkdir(exist_ok=True)
    try:
        from PIL import Image
        for d in DESTS:
            src = ROOT / "assets" / "img" / "destinations" / f"{d['slug']}.jpg"
            dst = ph_dir / f"{d['slug']}.jpg"
            if src.exists() and not dst.exists():
                img = Image.open(src).convert("RGB")
                img.thumbnail((640, 640))
                img.save(dst, quality=68, optimize=True)
    except ImportError:
        ph_dir = ROOT / "assets" / "img" / "destinations"

    pages = []
    chunk = 6                      # 6 destinations par page A4
    for start in range(0, len(DESTS), chunk):
        cards = "\n".join(
            f'    <div class="dest">'
            f'<div class="ph" style="background-image:url(\'ph/{d["slug"]}.jpg\')"></div>'
            f'<div class="tx"><span class="pays">{d["pays"]}</span><h3>{d["ville"]}</h3>'
            f'<p>{d["baseline"]}.</p></div></div>'
            for d in DESTS[start:start + chunk]
        )
        pages.append(
            '<div class="page">\n'
            '  <div class="head"><span class="kicker">Nos destinations</span>'
            '<img src="../img/logo.png" alt=""></div>\n'
            '  <h2 class="title">11 destinations qui donnent envie de partir</h2>\n'
            '  <p class="lead">Chaque séjour dure une semaine et décline nos quatre piliers. '
            'Les programmes détaillés sont présentés lors d\'un échange avec un conseiller.</p>\n'
            f'  <div class="dest-grid">\n{cards}\n  </div>\n'
            '</div>'
        )

    html = render(template_path.read_text(), {
        "DEST_PAGES": "\n\n".join(pages),
        "EMAIL": SITE["email"],
        "TEL": SITE["telephone"],
    })
    (out_dir / "brochure.html").write_text(html)
    print("✅ assets/brochure/brochure.html  (PDF : voir README)")


def build_sitemap() -> None:
    urls = [f"{SITE['url']}/"] + [f"{SITE['url']}/sejours/{d['slug']}.html" for d in DESTS]
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n</urlset>\n"
    )
    print("✅ sitemap.xml")


if __name__ == "__main__":
    build_index()
    build_sejours()
    build_destinations_js()
    build_legal()
    build_brochure()
    build_sitemap()
