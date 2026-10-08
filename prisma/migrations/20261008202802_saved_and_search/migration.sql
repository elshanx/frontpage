-- AlterTable
ALTER TABLE "Item" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("excerpt", '')), 'B')
) STORED;

-- AlterTable
ALTER TABLE "ItemState" ADD COLUMN     "savedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Item_search_idx" ON "Item" USING GIN ("search");

-- CreateIndex
CREATE INDEX "ItemState_userId_savedAt_idx" ON "ItemState"("userId", "savedAt");
