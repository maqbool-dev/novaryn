# Novaryn

Marketing site for **Novaryn**, a digital studio building high-performance web platforms.

A static, single-page site built with vanilla HTML, CSS and JavaScript — no framework, no build step, no runtime dependencies. Everything ships exactly as it is written.

🔗 **Live:** [novaryn.art](https://novaryn.art/)

---

## Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Docker](#docker)
- [Continuous integration](#continuous-integration)
- [Accessibility & motion](#accessibility--motion)
- [Browser support](#browser-support)
- [Conventions](#conventions)

---

## Overview

One page, eight sections: hero, a scroll-driven transition scene, a value-proposition marquee, services, metrics, selected work, process, and a contact call-to-action.

The design system is monochrome — near-black ink on warm paper — with a single green accent borrowed from the logo's dot, which recurs throughout as the brand's signature motif. Type is set in Archivo (display), Instrument Sans (body) and Space Mono (labels).

Total source: roughly 2,100 lines across three files.

## Highlights

**Light & dark themes**
Full dark variant driven by CSS custom properties. The theme resolves in an inline `<head>` script so there is no flash of the wrong palette on load. It follows the visitor's OS preference by default; a manual choice made with the header toggle persists in `localStorage` and takes precedence over later OS changes.

The high-contrast bands (metrics, marquee, CTA, footer) use their own token set rather than inverting with the page — in dark mode they become *raised* surfaces, preserving the same visual hierarchy instead of flipping to white.

**Particle dissolve scene**
A pinned scrollytelling section where the hero portrait dissolves into several thousand Canvas2D particles and reforms as a second, profile-facing pose. Pixels are sampled from both images at a stride tuned to the viewport, paired 1:1, and interpolated with an outward scatter so it reads as a dissolve rather than a morph. Scroll-scrubbed and fully reversible.

**Cursor-reactive dot grid**
The contact section carries a faint dot grid that brightens into a soft halo trailing the cursor. The static grid is painted once to an offscreen canvas and blitted each frame, so per-frame work stays proportional to the glow radius rather than the whole section.

**Motion throughout**
Orchestrated load sequence, scroll-triggered reveals, animated counters, hero parallax, an infinite marquee, direction-aware hover states, and magnetic buttons — all vanilla, all `transform`/`opacity` only.

## Tech stack

| | |
|---|---|
| Markup | HTML5 |
| Styling | CSS custom properties, grid, flexbox |
| Scripting | Vanilla JavaScript (single IIFE), Canvas2D |
| Fonts | Archivo, Instrument Sans, Space Mono (Google Fonts) |
| Container | nginx:alpine |
| CI | GitHub Actions |

**Zero npm dependencies.** No bundler, no transpiler, no animation library — no `package.json` at all.

## Project structure

```
.
├── index.html                    # the entire page
├── css/
│   └── styles.css                # design tokens, components, dark theme, responsive
├── js/
│   └── main.js                   # all interaction, in one IIFE
├── assets/                       # logos, favicon, portrait cutouts
├── sitemap.xml
├── dockerfile                    # nginx:alpine static server
└── .github/workflows/
    └── test_docker_push.yml      # lint → build → publish
```

`js/main.js` is organised as small, clearly commented blocks — load sequence, theme toggle, header state, mobile menu, scroll reveals, counters, magnetic buttons, CTA dot grid, hero parallax, particle morph scene, service-row hover, active nav link.

## Running locally

No install and no build step — the site is served directly from source.

```bash
python3 -m http.server 8322
```

Then open <http://localhost:8322>.

Any static server works equally well (`npx serve`, `php -S localhost:8322`, a Live Server extension). Opening `index.html` via `file://` is **not** recommended: the canvas effects read image pixel data, which browsers block under the `file://` origin.

## Docker

The image is `nginx:alpine` with the site copied into the web root.

```bash
docker build -t novaryn .
docker run --rm -p 8080:80 novaryn
```

Then open <http://localhost:8080>.

Published images: `maqbool404/novaryn:latest` and `maqbool404/novaryn:sha-<short-sha>`.

## Continuous integration

`.github/workflows/test_docker_push.yml` runs on pushes to `test_CI` and pull requests targeting `main`.

**1 · Test** — lints every HTML file with `htmlhint` (unclosed tags, bad nesting, duplicate IDs, missing alt text) and parses every JavaScript file with `node --check`.

**2 · Build & push** — gated behind the test job via `needs: test`. Builds the Docker image with Buildx and GitHub Actions layer caching.

Pull requests build the image to prove the Dockerfile is valid but never publish, and skip the registry login entirely — fork PRs are not given access to repository secrets. Only real pushes tag `latest` and publish to Docker Hub.

Requires two repository secrets: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker Hub access token, not an account password).

## Accessibility & motion

- Every text/background pair meets **WCAG 2.1 AA** contrast in both themes.
- `prefers-reduced-motion: reduce` is honoured in a single dedicated block: the load curtain, particle scene, parallax and marquee are all skipped, and static fallbacks are shown in their place.
- Canvas effects are decorative and marked `aria-hidden`; the particle scene keeps a plain `<img>` behind it, so the section still renders if JavaScript fails.
- Cursor-driven effects are gated behind `(pointer: fine)` and are not initialised on touch devices.
- Visible keyboard focus styles, labelled landmarks, and `aria-pressed`/`aria-label` kept in sync on the theme toggle.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari.

Uses `color-mix()`, `backdrop-filter`, the independent `translate` property, `scroll-margin-top` and `100svh`. There are no polyfills — the layout degrades gracefully, but these features are assumed.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`).
- **Cache busting** — `styles.css` and `main.js` carry a `?v=N` query string. Bump it whenever either file changes, so returning visitors are not served a stale cache.
- **Colour** — never hardcode a hex value in a component. Add or reuse a token in `:root`, and give it a `[data-theme="dark"]` counterpart.
