ALTER TABLE "SocialAccount"
  ADD COLUMN "needsReauth" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reauthReason" TEXT;
