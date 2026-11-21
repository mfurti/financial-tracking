ALTER TABLE "Contract"
  ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'EXPENSE',
  ADD CONSTRAINT "Contract_direction_check" CHECK ("direction" IN ('EXPENSE', 'INCOME'));
