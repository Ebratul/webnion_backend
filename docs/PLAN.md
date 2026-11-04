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
| Primary violet | `#7C3AED` | sampled from the live CTA |
| Black canvas | `#010101` | sampled from the live hero |
| Planet rim blue | `#0E59AF` to `#3B82F6` | sampled from the live hero |
| WhatsApp green | `#25D366` | live floating button only |
| English font | Poppins | brief |
| Bangla font | Hind Siliguri | brief |

The reference screenshots use orange, blue and serif type from other brands. Layouts are taken from them;
colour and type always stay Webnion violet with Poppins / Hind Siliguri.

## 3. Homepage flow and layout reference

| # | Section | Layout reference | Data source |
| --- | --- | --- | --- |
| 01 | Hero + Primary CTA | Charcoal background with warm corners, one button, logo row (client's brief) | i18n, API: clients |
| 02 | Client Work | Two-row project mosaic | API: projects |
| 03 | Customer Problems | Split layout: heading left, chat-style panel right (Chatify) | i18n |
| 04 | Services & Solutions | Three image cards with CTA and arrow | API: services |
| 05 | Business Outcomes | Editorial split with staggered images (Expert Insights) | i18n |
| 06 | Featured Projects & Case Studies | Dark carousel of project cards with pagination dots | API: projects |
| 07 | Video Testimonials | Rating strip and two rows of video / result cards | API: testimonials |
| 08 | Project Delivery Stories | Bold heading with CTA, photo strip with captions | API: delivery stories |
| 09 | 3-Step Working Process | Curved line with three numbered steps | i18n |
| 10 | Pricing & Project Investment | Joined plan columns, highlighted middle plan | API: pricing |
| 11 | Team & Expertise | Portrait grid (no reference supplied) | API: team |
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
| Pricing | Reference shows four tiers; the live site has three | The three live plans: $100, $400, $899 |
| Process, FAQ answers, Bangla copy | Not on the live site | Newly written, needs review |

## 8. Website pages

Added after the homepage, matching the live webnion.com pages in Webnion's fonts and both themes.

| Path | Content |
| --- | --- |
| `/service`, `/services/:slug` | Service list and detail pages with questions and answers |
| `/project`, `/project/:slug` | Portfolio with 12 projects per page, and project details |
| `/products` | Product catalog with search, filters and sorting |
| `/case-studies`, `/case-studies/:slug` | 24 case studies, 6 per page, with a category filter |
| `/admin` | Admin panel for all content, inquiries and users |

Bangla covers page text and titles. Article bodies from the live site are English until translated.

## 9. Media storage

The site runs on a VPS. Review videos and admin uploads live in the backend uploads folder, which is not in git. Cloudinary is
built in and switches on when its three keys are set in the backend `.env`.
