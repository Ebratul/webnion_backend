-- AlterTable
ALTER TABLE "projects"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "client" TEXT,
    ADD COLUMN "budget" JSONB,
    ADD COLUMN "location" JSONB,
    ADD COLUMN "sector" JSONB,
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "content" JSONB;

-- Existing rows keep the slug from their old webnion.com link. Rows without one fall back to their id.
UPDATE "projects" SET "slug" = substring("url" from '/project/([^/?#]+)') WHERE "url" LIKE '%webnion.com/project/%';
UPDATE "projects" SET "slug" = "id" WHERE "slug" IS NULL;

-- Project pages now live on this site, so the old links are dropped. url is kept for a client's own website.
UPDATE "projects" SET "url" = NULL WHERE "url" LIKE '%webnion.com/project/%';

ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateTable
CREATE TABLE "case_studies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "category" JSONB NOT NULL,
    "image" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_slug_key" ON "case_studies"("slug");

-- CreateIndex
CREATE INDEX "case_studies_isActive_sortOrder_idx" ON "case_studies"("isActive", "sortOrder");
