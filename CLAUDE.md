# Webnion Backend

REST API for the Webnion website: Express 5, TypeScript (ESM), Prisma 7, PostgreSQL, Zod.

## Commands

```bash
docker compose up -d     # Postgres on 127.0.0.1:5440
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
- Content modules (service, project, case-study, testimonial, delivery-story, pricing, faq, team, client) use the factories in
  `utils/content.ts`. A new content type needs its model, a localizer and a Zod schema.
- Throw `AppError` for expected failures. Zod and Prisma errors are mapped in `globalErrorHandler`.
- Input schemas use `z.strictObject`, so unknown fields are rejected rather than written to the database.
- Never put `.default()` in a schema that is also `.partial()`: it overwrites stored values on PATCH. Let the database supply defaults.
- Clear a nullable Json column with `nullableJson`. Prisma rejects a plain null there.
- Uploaded files go to `UPLOAD_DIR` and are served at `/uploads`. The file type comes from its first bytes, never the name.

## Media storage

Uploads go through `module/upload`. With all three `CLOUDINARY_*` keys set they are stored on Cloudinary (`lib/cloudinary.ts`), otherwise in `UPLOAD_DIR`. Setting only some keys stops the API at startup. `upload_large` returns a stream whose `error` event crashes the process if unhandled, so keep the listener.

## Deployment

Hosted on Vercel through `api/index.js` and `vercel.json`, with the database on Neon. See the README. On Vercel the disk is read-only, so
`module/upload` receives files in the temporary folder and refuses to store them without Cloudinary. Keep `.vercelignore` up to
date: the CLI does not read `.gitignore`, and an uploaded `.env` would be loaded in production.

## Git

Commit with the configured `Ebratul` identity. **Never add `Co-Authored-By` trailers or "Generated with" footers**: the
owner does not want Claude listed as a contributor. Write a summary line and a body explaining what and why.
