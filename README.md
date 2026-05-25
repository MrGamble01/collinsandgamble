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

## What to update before launch

- Replace `hello@collinsandgamble.com` with the real inbox.
- Confirm or update the LinkedIn URL (`/company/collinsandgamble`).
- If the production domain isn't `www.collinsandgamble.com`, update canonical
  URLs, sitemap, robots, and JSON-LD URLs accordingly.
- Wire the contact form to a real handler (Formspree, Resend, custom function,
  etc.) — the current submit handler shows a confirmation but does not send.
  Make sure the handler routes creator vs. brand submissions to the right
  inboxes.
- Add real creator/brand case studies, press, or roster examples as they land.
