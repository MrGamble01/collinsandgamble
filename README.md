# Collins & Gamble — Agency Site

Static site for Collins & Gamble, an Amazon Influencer management agency
running the program end-to-end for both creators and brands. No build step —
open `index.html` or serve the folder with any static host (GitHub Pages,
Netlify, Vercel, Cloudflare Pages, S3+CF, etc.).

## Pages

- `index.html` — Home (dual-path: creators / brands)
- `services.html` — How it works (capabilities, FAQ, two-side breakdown)
- `about.html` — About & principles
- `contact.html` — One form, two paths
- `404.html` — Not-found page

## SEO baked in

- Unique `<title>` and `<meta name="description">` per page
- Canonical URLs and Open Graph + Twitter Card metadata
- JSON-LD structured data: `Organization`, `WebSite`, `Service`, `BreadcrumbList`,
  `FAQPage`, `AboutPage`, `ContactPage`
- `robots.txt` and `sitemap.xml`
- Semantic HTML5 landmarks, skip links, accessible nav
- System fonts fallback + preconnected Google Fonts (Fraunces + Inter)
- Mobile-first responsive layout
- Reduced-motion aware

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Forms and mail

`/contact`, `/apply`, and `/brands` post to `api/submit.js`, which sends mail
through Resend when `RESEND_API_KEY` is set in the host. Creator applications
go to `apply@collinsandgamble.com`. Everything else goes to
`hello@collinsandgamble.com`. If the key is missing, the page falls back to a
`mailto:` link. Do not remove `novalidate` on those forms — the script adds
`https://` to bare URLs and then calls `reportValidity()`.

## Pages

Home, services, about, contact, playbook, apply, brands, brief, check, math,
journal (and four essays), search, privacy, thanks, and 404. Canonicals,
sitemap, and robots use `https://www.collinsandgamble.com`.
