# Webnion Website: Project Plan

Rebuild of the webnion.com homepage as a Next.js frontend and a TypeScript/Express API on PostgreSQL.
Bilingual (English / বাংলা), light and dark themes, following the 13-section Updated Homepage Flow.

## 1. Repositories

| Folder | Repo | Stack |
| --- | --- | --- |
| `webnion_frontend/` | github.com/Ebratul/webnion_frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| `webnion_backend/` | github.com/Ebratul/webnion_backend | Express 5, TypeScript, Prisma 7, PostgreSQL, Zod |

**Git rule:** commits are authored by `Ebratul <ebratulshaharier@gmail.com>` with no `Co-Authored-By` trailer
and no generated-by footer, so Claude never appears as a GitHub contributor.

## 2. Brand system

| Token | Value | Source |
| --- | --- | --- |
| Brand purple | `#8224E3` | the Webnion logo, for all buttons and accents (see `DESIGN.md`) |
| Black canvas | `#010101` | sampled from the live hero |
| Planet rim blue | `#0E59AF` to `#3B82F6` | sampled from the live hero |
| WhatsApp green | `#25D366` | live floating button only |
| English font | Poppins | brief |
| Bangla font | Hind Siliguri | brief |

Section backgrounds follow the reference images, and buttons and accents use the brand purple. Fonts stay Poppins / Hind Siliguri,
the site opens in dark mode, and it shows at 110% from 768px up.

## 3. Homepage flow and layout reference

| # | Section | Layout reference | Data source |
| --- | --- | --- | --- |
| 01 | Hero + Primary CTA | Charcoal in dark mode, cream in light mode, one button (client's brief) | i18n |
| 02 | Client Trust & Logos | Two-row project mosaic, then client logos on white tiles moving right to left | API: projects, clients |
| 03 | Customer Problems | Split layout: heading left, frontend-only demo chatbot in one scrolling card right | i18n |
| 04 | Services & Solutions | Three image cards with one full-width button, border on hover only | API: services |
| 05 | Business Outcomes | Rounded card on the page edges, using the Expert Insights reference and its text | i18n |
| 06 | Featured Projects | Dark carousel of three equal project cards, one card every 2 seconds, with a counter and progress line. Case studies stay on `/case-studies` | API: projects |
| 07 | Video Testimonials | Rating strip and two rows of video / result cards | API: testimonials |
| 08 | Project Delivery Stories | Bold heading with CTA, numbered photo cards with scroll motion | API: delivery stories |
| 09 | 3-Step Working Process | Curved line with three numbered steps | i18n |
| 10 | Pricing & Project Investment | Joined plan columns, Starter plan highlighted | API: pricing |
| 11 | Team & Expertise | Removed from the homepage at the client's request. Team members are on `/team` | API: team |
| 12 | FAQs & Risk Reassurance | Booking card left, accordion right | API: FAQs |
| 13 | Final Project Inquiry | Centered heading, inquiry form, footer | i18n, POST to API |

## 4. Backend

Structure follows the supplied example: `src/app/{config,interfaces,lib,middleware,module,routes,templates,utils}`,
`src/app.ts`, `src/server.ts`. Each module has `*.router.ts`, `*.controller.ts`, `*.service.ts`, `*.interface.ts`,
`*.validation.ts`.

**Modules:** auth, user, service, project, testimonial, delivery-story, pricing, faq, team, client, inquiry, home.

**Content model:** translatable fields are JSON `{ "en": "...", "bn": "..." }`. Public endpoints take `?locale=` and
return flattened strings.

**API (`/api/v1`):**
- `GET /home?locale=` returns everything the homepage needs in one request
- `GET /<content>?locale=` lists active content (public)
- `GET /<content>/all`, `POST`, `PATCH /:id`, `DELETE /:id` manage content (admin JWT)
- `POST /inquiries` is public, validated, rate limited and has a honeypot; `GET`, `PATCH /:id` are admin
- `POST /auth/login`, `GET /auth/me`

**Security:** helmet, CORS allow-list, body size limit, rate limits on login and inquiry, bcrypt, JWT, Zod on all input,
HTML-escaped email template, no default admin password.

## 5. Frontend

- Routes: `/en` and `/bn`. `proxy.ts` redirects `/` using the saved cookie, then `Accept-Language`.
- i18n: typed dictionaries in `src/i18n/`; the language switch swaps both copy and font, with Bangla-specific
  line-height and letter-spacing and localized numerals.
- Theme: CSS variables on `html[data-theme]`, set by an inline script before paint to avoid a flash, saved in
  `localStorage`. Dark is the default because it matches the brand hero.
- Data: server components fetch `/home` with ISR (60 seconds). If the API is down at runtime the last good page is
  served; at build time static sections still render.
- Floating WhatsApp button, sticky header, mobile menu, skip link, reduced-motion support.

## 6. Execution steps

1. Clone repos, extract references, collect real content from webnion.com. **Done**
2. Write this plan and `CLAUDE.md` files. **Done**
3. Backend: scaffold, Docker Postgres, Prisma schema, migration, seed. **Done**
4. Backend: middleware, utilities, all modules, tests. **Done**
5. Frontend: scaffold, design tokens, fonts, i18n, theme. **Done**
6. Frontend: build sections 01 to 13. **Done**
7. Connect frontend and backend; test the inquiry form end to end. **Done**
8. Visual QA with Playwright: both themes, both languages, mobile and desktop, compared with each reference. **Done**
9. Critique pass against Web Interface Guidelines, then fix what it finds. **Done**
10. Commit in logical steps, push both repos, verify the contributors list. **Done**

## 7. Content decisions needing owner confirmation

All content comes from webnion.com or the supplied references. Where those disagree:

| Item | Conflict | Used for now |
| --- | --- | --- |
| Client count | The client's brief removes the count from the hero | Not shown |
| Client logos | GoDaddy, Hotjar, Tripadvisor and Google Fonts appear in the screenshot; the live site shows real client logos | Real client logos |
| Pricing | The client set four plans | Free $0, Starter $19, Production $199, Enterprise $1,999 |
| Process, FAQ answers, Bangla copy | Not on the live site | Newly written, needs review |

## 8. Website pages

Added after the homepage, matching the live webnion.com pages in Webnion's fonts and both themes.

| Path | Content |
| --- | --- |
| `/service`, `/services/:slug` | Service list and detail pages with questions and answers |
| `/project`, `/project/:slug` | Portfolio with 12 projects per page, and project details |
| `/products` | Product catalog with search, filters and sorting |
| `/case-studies`, `/case-studies/:slug` | 24 case studies, 6 per page, with a category filter |
| `/team` | Banner and a card for each team member, opened by the Teams menu link |
| `/admin` | Admin panel for all content, inquiries and users |

Bangla covers page text and titles. Article bodies from the live site are English until translated.

## 9. Media storage

The review videos are compressed copies on Vercel Blob. Admin uploads need Cloudinary, which switches on when its three keys
are set in the backend's Vercel environment. Until then uploads return a clear error, because Vercel keeps no files on disk.

## 10. Hosting

| Part | Where | Address |
| --- | --- | --- |
| Website | Vercel project `webnion-frontend`, region `sin1` | https://webnion-frontend-jade.vercel.app |
| API | Vercel project `webnion-backend`, region `sin1` | https://webnion-backend.vercel.app |
| Database | Neon project `webnion`, Singapore | Pooled address in Vercel, direct address for migrations |
| Review videos | Vercel Blob store `webnion-media` | Saved in `testimonials.videoUrl` |

The `webnion.com` domain still points to the old site. `webnion-frontend` is connected to GitHub, so a push to it deploys the site.
