# Architecture

Collins & Gamble is a static site plus one form endpoint. Pages do not share a layout engine. Each HTML file repeats the header and footer so the site can be opened without a build.

## Request path

Vercel serves the repository with clean URLs and no trailing slash. `/playbook` resolves to `playbook.html`. `/journal` resolves to `journal/index.html`. An unknown path returns `404.html` with status 404.

`tests/static-server.js` copies that mapping for local preview and browser tests, and it copies the site-wide response headers from `vercel.json`.

`api/submit.js` is the only server function. It accepts POST JSON from the three public forms, checks the body with `api/form-check.js`, and sends mail through Resend when `RESEND_API_KEY` is set. A filled honeypot gets a silent success and is not mailed.

## Pages

| Path | File | Extra script |
| --- | --- | --- |
| `/` | `index.html` | — |
| `/services` | `services.html` | — |
| `/about` | `about.html` | — |
| `/contact` | `contact.html` | — |
| `/playbook` | `playbook.html` | — |
| `/apply` | `apply.html` | — |
| `/brands` | `brands.html` | — |
| `/brief` | `brief.html` | `brief.js` |
| `/check` | `check.html` | `check.js` |
| `/math` | `math.html` | `estimator.js` |
| `/journal` | `journal/index.html` | — |
| `/journal/…` | four essays | — |
| `/search` | `search.html` | `search-page.js` |
| `/privacy` | `privacy.html` | — |
| `/thanks` | `thanks.html` | — |
| (unknown) | `404.html` | — |

Every page also loads `assets/css/styles.css`, `assets/js/main.js`, and `assets/js/palette.js`.

`main.js` marks the document as `js`, moves focus for the skip link, redirects `/?q=` to `/search`, opens the phone nav, reveals sections on scroll, and submits forms. `palette.js` builds the command palette from `assets/data/search-index.json`. The search page uses the same index with its own renderer.

## Forms

`/contact`, `/apply`, and `/brands` share the handler in `main.js`. The form's `data-inbox`, `data-form`, and `data-subject` attributes tell the client where the note goes. The browser trims required fields, prefixes a scheme on bare URLs, then posts to `/api/submit`.

The API trusts `api/form-check.js`, not the browser. Known forms, required fields, lengths, and URL schemes are listed there. A 400 or 502 stays on the page. A missing API key or a dropped connection falls back to `mailto:`.

## Search and assets

The search index is a static JSON file of titles, URLs, and terms. It is not generated. Adding a page means adding an entry, or search will not offer it.

Images are SVG or the one JPEG share card, `assets/img/og.jpg` (1200×630). Icons for the tab and the manifest are `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, and `icon-512.png`. Fonts are the Latin subsets of Fraunces and Inter in `assets/fonts/`, under the SIL Open Font License (`OFL.txt`).

## SEO

Each indexable page has its own title (60 characters or fewer) and meta description (70–160 characters), a canonical on `https://www.collinsgamble.com`, and matching Open Graph and Twitter card tags. The share image is always `/assets/img/og.jpg`.

Structured data names the agency only:

- Home: `Organization`, `ProfessionalService`, and `WebSite` (with a search action).
- Services: `Service` plus `BreadcrumbList`. The service list matches the capability headings.
- Journal: `Blog` and `BlogPosting`. The author is the organization.
- Playbook: `Article`, same author rule.
- Brief, math, and the fit check: `WebApplication`, provided by the `ProfessionalService`.
- About, contact, apply, and privacy: page types whose publisher is the organization.

`/search`, `/thanks`, and `404.html` are `noindex`. `robots.txt` allows the site, disallows `404.html`, and points at `sitemap.xml`. The sitemap lists indexable pages, the journal feed, and `lastmod` on the journal URLs from each essay's `datePublished`.

## What not to add

Do not add a person, a client, a creator, a handle, or a photo of either to HTML, JSON-LD, alt text, the search index, tests, or docs. New public copy has to stay inside the privacy denylist enforced by `tests/privacy.test.js`.
