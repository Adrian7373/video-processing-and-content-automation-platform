ALTER TABLE "ScheduledPost" ADD COLUMN "failureCode" TEXT;

-- Posts that already failed because the platform token was expired or revoked.
UPDATE "ScheduledPost"
SET "failureCode" = 'REAUTH_REQUIRED'
WHERE "status" = 'FAILED'
  AND "errorMessage" ILIKE '%expired or revoked%';
