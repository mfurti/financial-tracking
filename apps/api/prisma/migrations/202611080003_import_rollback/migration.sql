ALTER TABLE "Transaction" ADD COLUMN "createdByImportRunId" UUID REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Transaction_createdByImportRunId_idx" ON "Transaction"("createdByImportRunId");
-- Only direct, single-source legacy observations inside a completed run's
-- creation window establish ownership. Unknown or shared records remain null.
UPDATE "Transaction" t SET "createdByImportRunId" = evidence."runId"
FROM (
 SELECT i."transactionId", min(i."importRunId"::text)::uuid AS "runId"
 FROM "TransactionIdentity" i
 GROUP BY i."transactionId"
 HAVING count(*) FILTER (WHERE i."importRunId" IS NULL) = 0
 AND count(DISTINCT i."importRunId") = 1
 AND bool_or(i.scope NOT LIKE 'source:%')
) evidence, "ImportRun" r
WHERE t.id = evidence."transactionId" AND r.id = evidence."runId"
AND r.source = 'CSV' AND r.status IN ('COMPLETED', 'PARTIAL_SUCCESS')
AND t."createdAt" >= r."startedAt" AND t."createdAt" <= r."finishedAt";
