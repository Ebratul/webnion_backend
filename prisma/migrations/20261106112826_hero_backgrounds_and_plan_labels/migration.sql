-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "buttonLabel" JSONB,
ADD COLUMN     "note" JSONB,
ADD COLUMN     "priceLabel" JSONB;

-- CreateTable
CREATE TABLE "hero_backgrounds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_backgrounds_isActive_sortOrder_idx" ON "hero_backgrounds"("isActive", "sortOrder");
