-- CreateTable
CREATE TABLE "ItemState" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ItemState_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE INDEX "ItemState_itemId_idx" ON "ItemState"("itemId");

-- AddForeignKey
ALTER TABLE "ItemState" ADD CONSTRAINT "ItemState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemState" ADD CONSTRAINT "ItemState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
