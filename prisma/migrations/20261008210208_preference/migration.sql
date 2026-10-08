-- CreateTable
CREATE TABLE "Preference" (
    "userId" TEXT NOT NULL,
    "refreshMinutes" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
