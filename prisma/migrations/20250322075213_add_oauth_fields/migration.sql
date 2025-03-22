-- AlterTable
ALTER TABLE "User" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateIndex
CREATE INDEX "provider_providerId_index" ON "User"("provider", "providerId");
