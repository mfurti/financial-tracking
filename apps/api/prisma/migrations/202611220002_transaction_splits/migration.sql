CREATE TABLE "TransactionSplit" (
    "transactionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "categoryId" UUID,
    "amountCents" BIGINT NOT NULL,
    CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("transactionId", "position"),
    CONSTRAINT "TransactionSplit_amountCents_check" CHECK ("amountCents" > 0)
);

CREATE INDEX "TransactionSplit_categoryId_idx" ON "TransactionSplit"("categoryId");

ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
