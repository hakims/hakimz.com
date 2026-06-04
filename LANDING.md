# hakimz.com — personal landing page

Ali Hakimi's casual/funky personal face at the **root domain `hakimz.com`**.
Side projects, experiments, hobbies, a research refresher, and the things he's
currently into. **Public.** Not a CV (that's `alihakimi.com`), and it must never
link to the private dashboards (`alfred.hakimz.com`, `tcar.hakimz.com`).

Shares the dark/spacey DNA of the Alfred hub but has its own identity:
an Interstellar-inspired hero, warmer rose/peach accents, funkier typography.

## Structure

```
web/hakimz.com/
├── index.html          # hero scene + scroll sections (semantic HTML)
├── assets/
│   ├── styles.css       # design tokens, hero, sections, responsive, reduced-motion
│   └── main.js          # canvas starfield + stardust beam, typed tagline,
│                        #   scroll reveal, parallax, pointer-glow
└── README.md            # this file
```

Self-contained static site. **No build step, no frameworks, no dependencies.**
Only external resource is Google Fonts (Space Grotesk + Inter) loaded over CDN.

## The hero (Interstellar-inspired)

Recreated **in code**, not the copyrighted still:
- Near-black deep-indigo sky with a warm glow at the horizon (CSS gradients).
- Twinkling starfield + a vertical **column of rising stardust** (canvas, `main.js`)
  — densest/brightest at the base, dispersing upward, with cool cyan-white plus a
  rose/peach fraction mixed in, matching the film frame.
- A CSS **volumetric beam** + ground bloom that softly "breathe" in brightness.
- A faint **nebula** toward the top-right.
- A pure-black **horizon silhouette** (inline SVG): farmhouse, two figures holding
  hands under the beam, a pickup, a lone tree, fence posts, and a dirt road as the
  leading line to the figures.
- Wordmark **"Hakimz"** + a typed, cycling tagline + a scroll cue.

**Alternative:** if Ali prefers the real film frame, drop the still in
`assets/` and set it as the `.hero` `background-image` (place it *behind* the
canvas / above the gradient). The coded version is original, animatable, fast,
and fully tunable, so it's the recommended default for a public page.

## Local preview

Open `index.html` directly (`file://…`), or serve it:

```sh
cd web/hakimz.com
python3 -m http.server 8080
# → http://localhost:8080
```

## Deployment — Cloudflare Pages (GitHub-connected)

hakimz.com runs on **Cloudflare Pages via a GitHub repo Ali already has connected.**

Because this is a **static site with no compile step**, the Pages build settings are:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | *(leave blank)* |
| Build output directory | the folder that contains `index.html` |

To deploy, commit these three files (`index.html`, `assets/styles.css`,
`assets/main.js`) into the connected repo so that `index.html` sits at the
configured output directory. Two common layouts:

1. **Repo root = site root** — copy the contents of `web/hakimz.com/` to the
   repo root; set output dir to `/`.
2. **Subfolder** — keep them in a subfolder and point Pages' output dir at it.

Cloudflare serves the static files on push; no Node/build environment needed.

> **CONFIRM WITH ALI:** the exact **repo name / path** of the already-connected
> GitHub repo, and whether the root domain `hakimz.com` (apex) is already mapped
> to this Pages project (vs. only the `alfred`/`tcar` subdomains). We must verify
> before pushing so we commit to the right place and don't disturb the gated
> subdomains.

## Customizing

- **Colors/typography:** all tokens live in `:root` at the top of `styles.css`.
- **Tagline lines:** `lines` array near the top of the typed-tagline block in `main.js`.
- **Beam look:** `.beam` / `.beam-bloom` gradients in `styles.css`; particle count,
  speed, and warm-fraction in `buildDust`/`spawnDust` in `main.js`.
- **Cards & signals:** plain HTML in `index.html` — edit copy directly.

All motion is gated behind `prefers-reduced-motion: reduce` (static beam, no
typing, no parallax, instant section reveals).
