# Collins & Gamble — Agency Site

Static site for Collins & Gamble, a talent management agency representing a
selective roster of creators. No build step — open `index.html` or serve the
folder with any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages,
S3+CF, etc.).

## Pages

- `index.html` — Home
- `services.html` — Practice (three disciplines + FAQ)
- `about.html` — About & principles
- `contact.html` — Introduction form
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
- Wire the introduction form to a real handler (Formspree, Resend, custom
  function, etc.) — the current submit handler shows a confirmation but does
  not send.
- Add roster bios, case work, or press once there's something worth showing.
