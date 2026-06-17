# Site Internet — learningtrip.fr

Site vitrine statique : 1 page d'accueil (globe 3D, simulateur de budget,
brochure gated) + 1 page par séjour. Aucune dépendance externe (pas de
framework, pas de build npm) — tout est généré par `build_site.py`.

> **Dossier autonome.** Tout le nécessaire (contenu, branding, images,
> migration Supabase) est inclus ici : ce dossier peut être copié tel quel
> dans un dépôt dédié et fonctionner sans le reste du projet Learning Trip.

## Démarrage rapide

```
python3 serve.py            # → http://127.0.0.1:8765 (ouvre le navigateur)
```

Pour regénérer le site après modification du contenu :

```
python3 -m pip install -r requirements.txt   # une fois (Pillow, pour les photos)
python3 build_site.py
```

## Structure

```
Site Internet/
  serve.py                 lance le site en local pour le visualiser
  requirements.txt         dépendances Python du BUILD (Pillow)
  data/destinations.json   ← SOURCE DE VÉRITÉ : tout le contenu éditable
  templates/               index.html · sejour.html · legal.html · brochure.html
  build_site.py            génère index, sejours/, destinations.js, sitemap, brochure
  fetch_photos.py          photos Wikimedia Commons (libres, crédits inclus)
  gen_landmask.py          points "continents" du globe (NASA Blue Marble)
  index.html  sejours/  mentions-legales.html  sitemap.xml  robots.txt   ← GÉNÉRÉS
  supabase/migrations/     0006_site_leads.sql ← schéma de la table des leads
  assets/
    css/site.css           design system (couleurs du logo : #053c64 / #c9f8fe)
    js/site.js             globe canvas · simulateur · formulaires leads
    js/config.js           URL + clé publique Supabase (clé publishable = OK côté client)
    js/destinations.js     GÉNÉRÉ depuis data/destinations.json
    js/land.js             GÉNÉRÉ (points continents)
    img/logo.png  favicon.png  og-image.png  apple-touch-icon.png   ← branding
    img/destinations/      photos + credits.json
    brochure/              brochure.html (GÉNÉRÉ) + Brochure-Learning-Trip.pdf
```

## Modifier le contenu

1. Éditer `data/destinations.json` (textes, expériences, moments, infos pratiques).
2. `python3 build_site.py`
3. Regénérer le PDF de la brochure si elle a changé :
   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
     --no-pdf-header-footer \
     --print-to-pdf="assets/brochure/Brochure-Learning-Trip.pdf" \
     "file://$PWD/assets/brochure/brochure.html"
   ```

⚠️ Ne jamais éditer `index.html`, `sejours/*.html`, `mentions-legales.html` à la
main : ils sont écrasés par le build. Éditer `templates/` + `data/`.

## Le simulateur ne révèle aucun prix

Le JS embarque seulement des **paliers arrondis** (1000 / 1100 / 1200 / 1350 /
1450 / 1550 €) distincts de la grille tarifaire réelle, avec une marge. Un
concurrent qui lit le code source n'obtient que des fourchettes, jamais un
prix. Aucun montant n'est affiché à l'écran : le simulateur répond uniquement
« destinations compatibles » + CTA conseiller.

## Leads (brochure / conseiller / programme)

Les formulaires écrivent dans la table Supabase `site_leads`
(projet EU `wnkakrzvtpbuovnswuel`, migration incluse :
`supabase/migrations/0006_site_leads.sql`) :

- **RLS insert-only** : le rôle `anon` peut insérer, jamais lire/modifier/supprimer.
- Consentement RGPD obligatoire (contrainte SQL + case à cocher).
- Contraintes de longueur/format sur tous les champs (anti-injection / anti-spam),
  champ honeypot côté client.
- Si Supabase est injoignable : repli automatique sur `mailto:`.

**À faire une fois** : appliquer la migration (SQL Editor du dashboard Supabase,
ou `supabase db push`). Lire les leads : dashboard → table `site_leads`
(colonne `traite` pour le suivi commercial).

## Déploiement

Site 100 % statique : uploader le contenu du dossier (sans `templates/`,
`data/`, `*.py`) sur n'importe quel hébergement. Penser à servir en HTTPS
(les formulaires appellent l'API Supabase en HTTPS).

## Photos

Wikimedia Commons / NASA, licences libres — crédits générés automatiquement
dans `mentions-legales.html` depuis `assets/img/destinations/credits.json`.
Pour changer une photo : modifier la requête dans `fetch_photos.py`, supprimer
le `.jpg` concerné, relancer le script, puis `python3 build_site.py`.

# Sitos
