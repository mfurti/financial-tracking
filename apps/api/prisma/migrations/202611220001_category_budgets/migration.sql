CREATE TABLE "CategoryBudget" (
    "id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "categoryId" UUID NOT NULL,
    "limitCents" BIGINT NOT NULL,

    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CategoryBudget_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND left("month", 4) <> '0000'),
    CONSTRAINT "CategoryBudget_limitCents_check" CHECK ("limitCents" > 0)
);

CREATE UNIQUE INDEX "CategoryBudget_month_categoryId_key" ON "CategoryBudget"("month", "categoryId");
CREATE INDEX "CategoryBudget_categoryId_idx" ON "CategoryBudget"("categoryId");

ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
