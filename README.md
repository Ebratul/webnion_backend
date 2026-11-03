# Webnion Backend

REST API powering the [Webnion](https://webnion.com) website, built with Express 5, TypeScript, Prisma and PostgreSQL.

## Getting Started

Requires Node.js 22+ and Docker.

```bash
npm install
cp .env.example .env          # Then set JWT_SECRET and ADMIN_PASSWORD
docker compose up -d
npm run db:deploy
npm run db:seed
npm run dev                   # http://localhost:5000
```

## API

Base path: `/api/v1`. Public reads accept `?locale=en|bn`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/home` | Public | All homepage content in one response |
| POST | `/inquiries` | Public, rate limited | Submit a project inquiry |
| GET, PATCH | `/inquiries`, `/inquiries/:id` | Staff | Read and update inquiries |
| POST | `/auth/login` | Public, rate limited | Get a JWT |
| GET | `/auth/me` | Staff | Current user |
| GET, POST, PATCH, DELETE | `/users` | Admin | Manage staff accounts |

Content resources: `/services`, `/projects`, `/testimonials`, `/delivery-stories`, `/pricing-plans`, `/faqs`, `/team`, `/clients`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/<resource>` | Public: active items, localized |
| GET | `/<resource>/all` | Staff: every item with both languages |
| POST | `/<resource>` | Staff |
| PATCH, DELETE | `/<resource>/:id` | Staff |

Staff requests send `Authorization: Bearer <token>`.

## Testing

```bash
npm test
```

Tests run against a separate `webnion_test` database, which is created automatically.

## Inquiry Emails

Inquiries are always saved to the database. To also receive them by email, set `SMTP_HOST` and the related variables in `.env`.
