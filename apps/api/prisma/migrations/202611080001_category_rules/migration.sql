-- Additive annotation expansion. Existing assigned categories are user-owned;
-- legacy uncategorized rows stay NONE until an explicit backfill is requested.
ALTER TABLE "Transaction" ADD COLUMN "categoryOrigin" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Transaction" ADD COLUMN "categoryRuleId" UUID;
ALTER TABLE "Transaction" ADD COLUMN "categoryRuleName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "categoryRuleConflict" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Transaction" ADD COLUMN "classification" TEXT;
UPDATE "Transaction" SET "categoryOrigin" = 'MANUAL' WHERE "categoryId" IS NOT NULL;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryOrigin_check" CHECK ("categoryOrigin" IN ('NONE', 'MANUAL', 'RULE'));
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_classification_check" CHECK ("classification" IS NULL OR "classification" IN ('FIXED', 'VARIABLE'));
CREATE TABLE "CategoryRule" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "categoryId" UUID NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "matchType" TEXT NOT NULL CHECK ("matchType" IN ('COUNTERPARTY', 'DESCRIPTION')),
  "text" TEXT NOT NULL CHECK (length(trim("text")) > 0),
  "direction" TEXT NOT NULL DEFAULT 'ANY' CHECK ("direction" IN ('ANY', 'INCOME', 'EXPENSE')),
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX "CategoryRule_isActive_priority_idx" ON "CategoryRule"("isActive", "priority");
-- Rule identity/name on a transaction is a historical snapshot, intentionally
-- without a cascading FK: deleting a rule must not erase attribution history.
