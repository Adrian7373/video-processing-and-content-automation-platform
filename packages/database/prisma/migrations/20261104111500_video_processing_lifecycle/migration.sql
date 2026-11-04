ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'QUEUED';

ALTER TABLE "Video"
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN "processingAttempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bullMqJobId" TEXT;

CREATE INDEX "Video_status_lastHeartbeatAt_idx"
  ON "Video"("status", "lastHeartbeatAt");
