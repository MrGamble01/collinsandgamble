# Collins & Gamble

Static site for Collins & Gamble, an Amazon Influencer management agency. Pages are hand-written HTML. There is no compile step and no client or creator names anywhere in the site, the metadata, or these docs.

The canonical host is `https://www.collinsgamble.com`.

## Setup

Use Node.js 22.

```bash
npm ci
npm test
npm run build
```

Preview with the same clean URLs and 404 page the host uses:

```bash
node tests/static-server.js
```

Open http://127.0.0.1:4173. Set `PORT` to use another port.

`python3 -m http.server` will open `index.html`, but it will not map `/services` to `services.html` or send unknown paths to `404.html`.

Browser tests need Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run lint` | HTML checks: one `h1`, landmarks, links, sitemap coverage |
| `npm test` | Lint plus forms, performance, privacy, SEO, and response headers |
| `npm run build` | Confirms named assets exist and `og.jpg` is a 1200×630 JPEG under 150 KB |
| `npm run test:browser` | Playwright against the static server on port 4173 |

CI runs lint, test, build, then Playwright with Chromium.

## Deploy

Production is [https://www.collinsgamble.com](https://www.collinsgamble.com) on Vercel.

`vercel.json` turns on clean URLs (`/services`, not `/services.html`) and turns off trailing slashes. The home canonical is `https://www.collinsgamble.com/`. Every other canonical has no trailing slash. Canonicals, the sitemap, and `robots.txt` use the `www` host. Do not introduce the apex URL `https://collinsgamble.com`.

There is nothing to compile. Pushing the branch connected to the Vercel project deploys the files as they are. `npm run build` is a check, not a bundler.

Set these in the Vercel project, not in the repo:

- `RESEND_API_KEY` — Resend API key for form mail
- `FORM_FROM_EMAIL` — a verified sender, for example `Forms <forms@collinsandgamble.com>`

`/contact`, `/apply`, and `/brands` post to `api/submit.js`. Creator applications go to `apply@collinsandgamble.com`. Other notes go to `hello@collinsandgamble.com`. If `RESEND_API_KEY` is missing, the API returns 503 and the page falls back to a `mailto:` link. Leave `novalidate` on those forms: the script adds `https://` to bare URLs, then calls `reportValidity()`.

## Structure

- `*.html` and `journal/` — one full document per page (header, main, footer). No template build.
- `assets/css/styles.css` — the only stylesheet. Fraunces and Inter are the self-hosted files in `assets/fonts/`.
- `assets/js/main.js` — nav, scroll reveal, and the shared form handler, on every page.
- `assets/js/palette.js` — the command palette, on every page.
- `assets/js/search-page.js`, `brief.js`, `check.js`, `estimator.js` — loaded only by the page that uses them.
- `assets/data/search-index.json` — the search corpus for the palette and `/search`.
- `assets/img/` — icons, the share JPEG, the hero, and the playbook diagrams.
- `api/submit.js`, `api/form-check.js` — form mail and the server-side field checks.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `vercel.json`.
- `tests/` — `node:test` checks, the preview server, and Playwright.

`/search`, `/thanks`, and `404.html` are `noindex` and are omitted from the sitemap. Journal essay dates are `lastmod` values in the sitemap.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how a request moves through the site, and [docs/seo.md](docs/seo.md) for canonicals, robots, the sitemap, and structured data.

## Privacy

Do not add a client, a creator, a personal profile, or a headshot to pages, metadata, structured data, alt text, fixtures, or docs. The agency in JSON-LD is an `Organization` or a `ProfessionalService`, never a person. `tests/privacy.test.js` fails the build when a denylisted marker or a creator image path shows up in a tracked file.
