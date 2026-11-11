# Webnion Backend

REST API for the Webnion website: Express 5, TypeScript (ESM), Prisma 7, MySQL 8, Zod.

## Commands

```bash
docker compose up -d     # MySQL on 127.0.0.1:3307
npm run dev              # API on :5000 with reload
npm test                 # Integration tests against the separate webnion_test database
npm run typecheck
npm run build && npm start
npm run db:migrate       # Create and apply a migration in development
npm run db:deploy        # Apply migrations in production
npm run db:seed          # Fills only empty tables, never overwrites edits
```

## Layout

```
src/app/config       Validated environment
src/app/interfaces   Shared types
src/app/lib          Prisma client, mailer
src/app/middleware   auth, validateRequest, rate limits, error handling
src/app/module/<x>   <x>.router/controller/service/interface/validation.ts
src/app/routes       Mounts every module under /api/v1
src/app/templates    Email templates
src/app/utils        catchAsync, sendResponse, content factories, validators
```

## Conventions

- Imports use the `.js` extension (NodeNext ESM). The Prisma client is generated to `src/generated/prisma` and is not committed.
- Translated fields are JSON `{ en, bn }`. Public reads take `?locale=` and return flat strings via `pickText`.
- Content modules (service, project, case-study, testimonial, delivery-story, outcome-card, pricing, faq, team, client) use the factories in
  `utils/content.ts`. A new content type needs its model, a localizer and a Zod schema.
- Throw `AppError` for expected failures. Zod and Prisma errors are mapped in `globalErrorHandler`.
- Input schemas use `z.strictObject`, so unknown fields are rejected rather than written to the database.
- Never put `.default()` in a schema that is also `.partial()`: it overwrites stored values on PATCH. Let the database supply defaults.
- Clear a nullable Json column with `nullableJson`. Prisma rejects a plain null there.
- MySQL: a plain `String` is VARCHAR(191). Give longer text `@db.Text` or `@db.VarChar(n)`, and URLs `@db.VarChar(2048)`. Text comparisons
  ignore case by default, so Prisma's `mode: 'insensitive'` does not exist here. The client connects through `@prisma/adapter-mariadb`.
- Connections (`lib/databaseConfig.ts`, `lib/prisma.ts`): Aiven's free plan allows 46 connections and Vercel freezes a function after it
  answers, so each function holds one connection, the pool drops idle ones after 5 seconds with `attachDatabasePool` keeping the
  function awake that long, and every session tells MySQL to drop it after 30 idle seconds. Do not raise these without a bigger plan:
  with the driver's defaults a burst of requests filled the server and the API could not connect for minutes.
- Site settings (`module/site-setting`) hold one JSON row per key: contact, images, brand, homepage, navigation, options and text.
  Anything never saved is left out and the website uses its built-in value. Links in navigation are checked to be `/page`, `#section`
  or `https://`. Inquiry emails go to `options.inquiryEmails`, or `INQUIRY_NOTIFY_TO` until set; they need the `SMTP_*` keys.
- Uploaded files go to `UPLOAD_DIR` and are served at `/uploads`. The file type comes from its first bytes, never the name.

## Media storage

Uploads go through `module/upload`. With all three `CLOUDINARY_*` keys set they are stored on Cloudinary (`lib/cloudinary.ts`), otherwise in `UPLOAD_DIR`. Setting only some keys stops the API at startup. `upload_large` returns a stream whose `error` event crashes the process if unhandled, so keep the listener.

## Deployment

Hosted on Vercel through `api/index.js` and `vercel.json`, with the database on Aiven MySQL 8.4 (Singapore), verified with `DATABASE_CA_CERT`. See the README. On Vercel the disk is read-only, so
`module/upload` receives files in the temporary folder and sends them to Vercel Blob without Cloudinary. Keep `.vercelignore` up to
date: the CLI does not read `.gitignore`, and an uploaded `.env` would be loaded in production.

## Git

Commit with the configured `Ebratul` identity. **Never add `Co-Authored-By` trailers or "Generated with" footers**: the
owner does not want Claude listed as a contributor. Write a summary line and a body explaining what and why.
