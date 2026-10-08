-- AlterTable
ALTER TABLE "Preference" ADD COLUMN     "digestSeenAt" TIMESTAMP(3),
ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'comfortable';
