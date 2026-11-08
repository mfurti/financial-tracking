CREATE TABLE "ContractSuggestionDecision" (
 "key" TEXT NOT NULL PRIMARY KEY CHECK ("key" ~ '^[a-f0-9]{64}$'),
 "state" TEXT NOT NULL CHECK ("state" IN ('DISMISSED', 'CONFIRMED')),
 "contractId" UUID UNIQUE REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ContractSuggestionDecision_state_contract_check" CHECK (("state" = 'CONFIRMED' AND "contractId" IS NOT NULL) OR ("state" = 'DISMISSED' AND "contractId" IS NULL))
);
