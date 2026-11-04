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

Content resources: `/services`, `/projects`, `/products`, `/case-studies`, `/testimonials`, `/delivery-stories`, `/pricing-plans`, `/faqs`, `/team`, `/clients`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/<resource>` | Public: active items, localized |
| GET | `/<resource>/all` | Staff: every item with both languages |
| POST | `/<resource>` | Staff |
| PATCH, DELETE | `/<resource>/:id` | Staff |

`/services/:slug`, `/projects/:slug` and `/case-studies/:slug` return one item with its full content. `/products` also accepts `q`, `type`, `category`, `pricing` and `sort`.

Staff can upload images and videos with `POST /uploads`.

Staff requests send `Authorization: Bearer <token>`.

## Testing

```bash
npm test
```

Tests run against a separate `webnion_test` database, which is created automatically.

## Inquiry Emails

Inquiries are always saved to the database. To also receive them by email, set `SMTP_HOST` and the related variables in `.env`.

## Cloudinary

Images and videos uploaded from the admin panel are stored in the uploads folder until Cloudinary keys are set. No code
changes are needed to switch.

1. In the [Cloudinary console](https://console.cloudinary.com), open **Settings > API Keys** and copy the cloud name, API key and API secret.
2. Add all three to `.env` on the server, and keep them out of git:

   ```bash
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

3. Restart the API. The startup log says where uploads are stored. New uploads now go to Cloudinary.
4. Optionally move files the site already uses, such as the review videos:

   ```bash
   npm run media:migrate -- --dry-run   # List what would move
   npm run media:migrate                # Move them and update the database
   ```

The move keeps local files as a backup. A file that fails stays local and keeps working, and running the command again
retries it. Check your plan's size limit first: a file over the limit is refused. Files in the frontend's
`public/images` folder are not moved.

## Uploads on a VPS

Review videos and files uploaded from the admin panel live in the uploads folder. It is not in git, so it has to be copied
to the server and backed up separately.

1. Keep it outside the app folder so a redeploy cannot delete it, by setting an absolute path in `.env`:

   ```bash
   UPLOAD_DIR=/var/www/webnion/uploads
   ```

2. Copy the existing files to the server once, including `reviews/` with the four review videos:

   ```bash
   rsync -avz uploads/ user@your-server:/var/www/webnion/uploads/
   ```

3. Allow large uploads through Nginx, matching the API's 300 MB limit:

   ```nginx
   client_max_body_size 300m;
   ```

4. Back up the uploads folder and the database together, because the database only stores paths to these files:

   ```bash
   rsync -avz user@your-server:/var/www/webnion/uploads/ ./backup/uploads/
   ssh user@your-server 'pg_dump "$DATABASE_URL"' > ./backup/webnion.sql
   ```

## Deploying on Vercel

The API runs as one function, `api/index.js`, which loads the compiled `dist/app.js`. Everything else is in `vercel.json`.

```bash
vercel deploy --prod
```

- Set `DATABASE_URL` (pooled Neon address), `JWT_SECRET`, `CORS_ORIGINS` and `TRUST_PROXY_HOPS=1` in the project. Do not set
  `NODE_ENV`: Vercel sets it at runtime, and setting it at build time would skip the build tools.
- Run migrations and the seed from your machine with the direct, non-pooled address:
  `DATABASE_URL=<direct> npm run db:deploy`, then `npm run db:seed`. Set `REVIEW_VIDEO_BASE` to seed videos hosted elsewhere.
- `.vercelignore` keeps `.env` and `uploads/` out of the upload. The Vercel CLI does not read `.gitignore`, so keep it up to date.
- Vercel keeps no files on disk, so admin uploads return 503 until the three `CLOUDINARY_*` keys are set.
- Vercel limits each request to 4.5MB, so larger uploads fail even with Cloudinary on.
