-- CreateTable
CREATE TABLE "OwnerProfile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "contactEmail" VARCHAR(254),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AccountGroup" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountGroupMember" (
    "groupId" UUID NOT NULL,
    "accountId" UUID NOT NULL,

    CONSTRAINT "AccountGroupMember_pkey" PRIMARY KEY ("groupId","accountId")
);

-- CreateTable
CREATE TABLE "NotificationAcknowledgement" (
    "userId" UUID NOT NULL,
    "sourceKey" VARCHAR(256) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAcknowledgement_pkey" PRIMARY KEY ("userId","sourceKey")
);

-- CreateIndex
CREATE INDEX "AccountGroupMember_accountId_idx" ON "AccountGroupMember"("accountId");

-- AddForeignKey
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountGroupMember" ADD CONSTRAINT "AccountGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccountGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountGroupMember" ADD CONSTRAINT "AccountGroupMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAcknowledgement" ADD CONSTRAINT "NotificationAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bound new workspace metadata without rewriting existing financial or authentication rows.
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_displayName_check"
  CHECK (char_length("displayName") BETWEEN 1 AND 80 AND "displayName" = btrim("displayName"));
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_contactEmail_check"
  CHECK ("contactEmail" IS NULL OR ("contactEmail" = btrim("contactEmail") AND "contactEmail" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
ALTER TABLE "AccountGroup" ADD CONSTRAINT "AccountGroup_name_check"
  CHECK (char_length("name") BETWEEN 1 AND 60 AND "name" = btrim("name"));
ALTER TABLE "AccountGroup" ADD CONSTRAINT "AccountGroup_sortOrder_check" CHECK ("sortOrder" >= 0);
CREATE UNIQUE INDEX "AccountGroup_name_lower_key" ON "AccountGroup" (lower("name"));
ALTER TABLE "NotificationAcknowledgement" ADD CONSTRAINT "NotificationAcknowledgement_sourceKey_check"
  CHECK (char_length("sourceKey") BETWEEN 1 AND 256 AND "sourceKey" = btrim("sourceKey"));
