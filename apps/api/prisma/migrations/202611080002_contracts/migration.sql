-- Additive contracts: forecasts are never stored as bank transactions.
ALTER TABLE "Transaction" ADD COLUMN "contractAutoBlocked" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE "Contract" (
 "id" UUID NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "provider" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('SUBSCRIPTION','RENT','INSURANCE','ENERGY','TELECOM','OTHER')),
 "accountId" UUID REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "categoryId" UUID REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "startDate" DATE NOT NULL, "endDate" DATE, "cancellationDate" DATE,
 CONSTRAINT "Contract_date_order" CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
);
CREATE TABLE "ContractRevision" (
 "id" UUID NOT NULL PRIMARY KEY, "contractId" UUID NOT NULL REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "effectiveDate" DATE NOT NULL, "amountCents" BIGINT NOT NULL CHECK ("amountCents" > 0),
 "intervalMonths" INTEGER NOT NULL CHECK ("intervalMonths" IN (1,3,6,12))
);
CREATE UNIQUE INDEX "ContractRevision_contractId_effectiveDate_key" ON "ContractRevision"("contractId", "effectiveDate");
CREATE TABLE "ContractPayment" (
 "id" UUID NOT NULL PRIMARY KEY, "contractId" UUID NOT NULL REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "revisionId" UUID NOT NULL REFERENCES "ContractRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "dueDate" DATE NOT NULL,
 "transactionId" UUID NOT NULL REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "source" TEXT NOT NULL CHECK ("source" IN ('AUTO','MANUAL')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ContractPayment_transactionId_key" ON "ContractPayment"("transactionId");
CREATE UNIQUE INDEX "ContractPayment_contractId_dueDate_key" ON "ContractPayment"("contractId", "dueDate");
