# SEO setup

The public site is static HTML. Search metadata lives in each page, in `robots.txt`, and in `sitemap.xml`. The canonical host is `https://www.collinsgamble.com`. Do not use the apex host `https://collinsgamble.com` in a canonical, a sitemap location, or a JSON-LD URL.

Nothing in this setup names a client, a creator, or a person. The agency is an organization.

## Titles and descriptions

Every HTML page has one `<title>` and one `<meta name="description">`. Titles are 10–60 characters. Descriptions are 70–160 characters. Both are unique across the site.

Open Graph and Twitter Card tags repeat the share title, description, and image. The share image is always `https://www.collinsgamble.com/assets/img/og.jpg` (1200×630). `twitter:card` is `summary_large_image`. On every page except the 404, `og:url` equals the canonical URL.

## Canonical URLs

Clean URLs, matching `vercel.json`: no `.html`, no query string, and no trailing slash except on the home page.

| Page | Canonical |
| --- | --- |
| `index.html` | `https://www.collinsgamble.com/` |
| `journal/index.html` | `https://www.collinsgamble.com/journal` |
| `services.html` | `https://www.collinsgamble.com/services` |

`404.html` has no canonical. It is `noindex`.

## robots.txt

```
User-agent: *
Allow: /
Disallow: /404.html

Sitemap: https://www.collinsgamble.com/sitemap.xml
```

`/search` and `/thanks` are `noindex` in the page, not disallowed here, so a crawler can see the `noindex` tag. They are omitted from the sitemap. The 404 is both disallowed and `noindex`, and it is not in the sitemap.

## Sitemap

`sitemap.xml` lists every indexable HTML route plus `/journal/feed.xml`. Locations use the www host. Journal essays carry `lastmod` from the `datePublished` value in that essay's JSON-LD. The journal index and the feed use the newest of those dates. Other URLs omit `lastmod` rather than inventing one.

## Structured data

JSON-LD uses `https://schema.org`. The homepage publishes:

- `Organization` — name, www URL, logo, and the public inquiry email
- `ProfessionalService` — the same agency, with no founder and no employees
- `WebSite` — a search action whose target is `https://www.collinsgamble.com/search?q={search_term_string}`

Essays and the playbook name the author as that organization, never a `Person`. Tool pages (`/brief`, `/math`, `/check`) are `WebApplication` nodes provided by the `ProfessionalService`. Any on-site URL inside JSON-LD starts with `https://www.collinsgamble.com`.

Profile links on the organization stay on company pages. Do not add a personal profile.

## What the tests cover

`npm test` runs `tests/seo.test.js` and the sitemap section of `tests/html.test.js`. Together they check titles, descriptions, share cards, canonical shape, `robots.txt`, sitemap membership, journal `lastmod`, heading order, generic image alt text, and that structured data does not describe a person.

`tests/privacy.test.js` fails the build if a denylisted marker or a creator image path appears in a tracked file, including this document.
