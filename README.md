# Gaming Splash Gallery

A static, GitHub Pages-ready digital gaming splash-art catalogue with an ArtStation-inspired dark gallery layout.

## Features

- Responsive masonry-style gallery built for large catalogues
- Fast name/letter/tag search with lightweight fuzzy matching
- Category filters and skin-rank filters (S/A/B/C)
- Rank-aware sorting
- Click any artwork to enlarge it **in place** instead of opening a modal
- Lazy-loaded images for long scrolling catalogues
- Owner dashboard at `admin.html`
- Dashboard CRUD for artwork records and direct save-back to GitHub using a fine-grained Personal Access Token
- No GitHub credential is stored in the repository or bundled into the public site

## Files

- `index.html` — public gallery
- `admin.html` — unlinked owner editor; requires GitHub write credentials to save
- `data/artworks.json` — public catalogue data used by the static site
- `.nojekyll` — makes GitHub Pages serve the files directly

## Deploy with GitHub Pages

After merging the feature branch, open **Repository Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

## Owner editing workflow

Open `/admin.html`, enter a fine-grained GitHub token with **Contents: Read and write** permission for this repository, load the catalogue, edit records, then click **Save to GitHub**. The token is kept only in the browser session and is never written into the repository.

For production use, create the narrowest possible fine-grained token and revoke/rotate it if it is ever exposed.

## Privacy limitation of a static site

Anything displayed by a static GitHub Pages site must be delivered to the visitor's browser, so displayed images and the catalogue fields needed to render them cannot be truly secret. Likewise, commit history in a public repository is public. This project therefore keeps credentials and admin-only controls out of the public data, but it does **not** claim to provide private asset storage or a private changelog. Those requirements need a private backend or authenticated asset service.
