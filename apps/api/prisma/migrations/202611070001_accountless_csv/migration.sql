-- Preserve every existing account association; only new unassigned records use NULL.
ALTER TABLE "Transaction" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "StagedRow" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "TransactionIdentity" ADD COLUMN "scope" TEXT;
UPDATE "TransactionIdentity" SET "scope" = 'account:' || "accountId"::text;
ALTER TABLE "TransactionIdentity" ALTER COLUMN "scope" SET NOT NULL;
ALTER TABLE "TransactionIdentity" ADD CONSTRAINT "TransactionIdentity_scope_not_empty" CHECK (length(trim("scope")) > 0);
ALTER TABLE "TransactionIdentity" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "TransactionIdentity" ADD COLUMN "importRunId" UUID;
ALTER TABLE "TransactionIdentity" ADD CONSTRAINT "TransactionIdentity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "TransactionIdentity_scope_identityType_identityValue_key" ON "TransactionIdentity"("scope", "identityType", "identityValue");
CREATE INDEX "TransactionIdentity_accountId_idx" ON "TransactionIdentity"("accountId");
CREATE INDEX "TransactionIdentity_identityType_identityValue_idx" ON "TransactionIdentity"("identityType", "identityValue");
CREATE INDEX "Transaction_bookingDate_amountCents_idx" ON "Transaction"("bookingDate", "amountCents");
DROP INDEX "TransactionIdentity_accountId_identityType_identityValue_key";
ALTER TABLE "ImportIssue" ADD COLUMN "resolutionHash" TEXT;
CREATE TABLE "AssignmentReceipt" (
  "id" UUID NOT NULL PRIMARY KEY,
  "inputHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
