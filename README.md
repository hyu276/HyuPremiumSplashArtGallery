# Gaming Splash Gallery

A static, GitHub Pages-ready digital gaming splash-art catalogue with an ArtStation-inspired dark gallery layout.

## Features

- Responsive masonry-style gallery built for large catalogues
- Fast name/letter/description/tag search with lightweight fuzzy matching
- Category filters and skin-rank filters (S/A/B/C)
- Rank-aware sorting
- Click any artwork to enlarge it **in place** instead of opening a modal
- Artwork descriptions appear in the expanded view
- Lazy-loaded images for long scrolling catalogues
- Owner dashboard at `admin.html`
- Dashboard CRUD for artwork records: name, description, category, rank, tags and image
- Direct JPG/PNG/WebP/GIF upload from the owner dashboard into `assets/artworks/`
- Repository-hosted image cleanup when an artwork is deleted or its uploaded image is replaced
- Owner verification against the authenticated GitHub account before publishing
- Direct save-back to GitHub using a fine-grained Personal Access Token
- No GitHub credential is stored in the repository or bundled into the public site

## Files

- `index.html` — public gallery
- `admin.html` — unlinked owner editor; GitHub owner verification is required to publish
- `data/artworks.json` — public catalogue data used by the static site
- `assets/artworks/` — repository-hosted artwork files uploaded through the dashboard
- `.nojekyll` — makes GitHub Pages serve the files directly

## Deploy with GitHub Pages

Open **Repository Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. Changes published from the dashboard create repository commits, so GitHub Pages redeploys automatically.

## Owner editing workflow

1. Open `/admin.html`.
2. Edit locally: add, update or delete artwork records.
3. For an image, either paste an external image URL or choose a local JPG/PNG/WebP/GIF file up to 10 MB. Uploaded files are written to `assets/artworks/` only when publishing.
4. Enter a fine-grained GitHub token limited to this repository with **Contents: Read and write** permission.
5. Click **Verify owner**. The dashboard confirms that the authenticated GitHub login is the repository owner and has write access.
6. Click **Publish changes**. New images are uploaded, `data/artworks.json` is updated, and replaced/deleted repository-hosted images are cleaned up.

The token is kept only in browser `sessionStorage` and is never written into the repository. Use the narrowest possible fine-grained token and revoke/rotate it if it is ever exposed.

## Static-site security limitation

`admin.html` is unlinked and marked `noindex`, but it is still a public static file. The security boundary is therefore GitHub authorization, not secrecy of the dashboard URL. A visitor without a valid repository-owner GitHub token cannot publish changes.

Anything displayed by a static GitHub Pages site must be delivered to the visitor's browser, so displayed images and the catalogue fields needed to render them cannot be truly secret. Likewise, commit history in a public repository is public. Private assets or a private changelog require a private backend or authenticated asset service.
