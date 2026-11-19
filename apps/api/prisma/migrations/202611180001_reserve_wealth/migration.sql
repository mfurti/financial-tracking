-- CreateTable
CREATE TABLE "AccountPresentation" (
    "accountId" UUID NOT NULL,
    "reserveEligible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccountPresentation_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "ReserveGoal" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "targetCents" BIGINT NOT NULL DEFAULT 300000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReserveGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WealthRecord" (
    "id" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCents" BIGINT NOT NULL,
    "coverage" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,

    CONSTRAINT "WealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WealthRecordComponent" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "accountId" UUID,
    "sourceLabel" VARCHAR(120) NOT NULL,
    "amountCents" BIGINT,
    "observedAt" TIMESTAMP(3),
    "sourceType" VARCHAR(64) NOT NULL,

    CONSTRAINT "WealthRecordComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WealthRecord_idempotencyKey_key" ON "WealthRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WealthRecord_recordedAt_id_idx" ON "WealthRecord"("recordedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "WealthRecordComponent_recordId_idx" ON "WealthRecordComponent"("recordId");

-- CreateIndex
CREATE INDEX "WealthRecordComponent_accountId_idx" ON "WealthRecordComponent"("accountId");

-- AddForeignKey
ALTER TABLE "AccountPresentation" ADD CONSTRAINT "AccountPresentation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WealthRecordComponent" ADD CONSTRAINT "WealthRecordComponent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "WealthRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WealthRecordComponent" ADD CONSTRAINT "WealthRecordComponent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bound only the new metadata. Existing bank/source fields are deliberately unchanged.
ALTER TABLE "ReserveGoal" ADD CONSTRAINT "ReserveGoal_singleton_check" CHECK ("id" = 1);
ALTER TABLE "ReserveGoal" ADD CONSTRAINT "ReserveGoal_positive_target_check" CHECK ("targetCents" > 0);
ALTER TABLE "WealthRecord" ADD CONSTRAINT "WealthRecord_coverage_check" CHECK ("coverage" IN ('COMPLETE', 'PARTIAL'));
ALTER TABLE "WealthRecord" ADD CONSTRAINT "WealthRecord_key_not_blank_check" CHECK (length(btrim("idempotencyKey")) > 0);
ALTER TABLE "WealthRecordComponent" ADD CONSTRAINT "WealthRecordComponent_label_not_blank_check" CHECK (length(btrim("sourceLabel")) > 0);
ALTER TABLE "WealthRecordComponent" ADD CONSTRAINT "WealthRecordComponent_type_not_blank_check" CHECK (length(btrim("sourceType")) > 0);

-- Configure the approved default goal without fabricating account balances or historical wealth.
INSERT INTO "ReserveGoal" ("id", "targetCents", "updatedAt") VALUES (1, 300000, CURRENT_TIMESTAMP);
