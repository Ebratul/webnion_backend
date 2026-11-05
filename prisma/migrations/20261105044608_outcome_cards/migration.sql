-- CreateTable
CREATE TABLE "outcome_cards" (
    "id" TEXT NOT NULL,
    "eyebrow" JSONB,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "image" TEXT NOT NULL,
    "buttonLabel" JSONB,
    "buttonUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outcome_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outcome_cards_isActive_sortOrder_idx" ON "outcome_cards"("isActive", "sortOrder");
