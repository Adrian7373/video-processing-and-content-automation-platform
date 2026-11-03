import type { Prisma, PrismaClient, VideoStatus } from "@prisma/client";

type LifecycleClient = PrismaClient | Prisma.TransactionClient;

export const PROCESSING_TIMEOUT_MS = 45 * 60 * 1000;
export const QUEUED_TIMEOUT_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES: VideoStatus[] = ["QUEUED", "PROCESSING"];

export function lifecycleErrorCode(error: unknown): string {
    if (error instanceof Error && error.name && error.name !== "Error") {
        return error.name;
    }
    return "PROCESSING_FAILED";
}

export function lifecycleErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    // Keep stored messages bounded; FFmpeg stderr can be very long.
    return message.length > 2000 ? `${message.slice(0, 2000)}…` : message;
}

/**
 * Builds a BullMQ job ID for a processing run. Writing it to the DB *before*
 * enqueueing removes the race where the worker starts before `bullMqJobId`
 * is stored. BullMQ custom IDs must not contain ":".
 */
export function buildVideoProcessingJobId(videoId: string): string {
    return `video-${videoId}-${Date.now()}`;
}

export async function markVideoQueued(
    client: LifecycleClient,
    videoId: string,
    jobId: string,
): Promise<void> {
    await client.video.updateMany({
        where: { id: videoId, status: "QUEUED" },
        data: {
            status: "QUEUED",
            bullMqJobId: jobId,
            errorMessage: null,
            errorCode: null,
            processingStartedAt: null,
            completedAt: null,
            failedAt: null,
            lastHeartbeatAt: new Date(),
        },
    });
}

/**
 * Marks a video FAILED and refunds its credit exactly once. It only acts while
 * the video is still QUEUED/PROCESSING (and, when given, owned by `jobId`), so
 * calling it from several places (processor, worker `failed` event, reconciler)
 * can never double-refund.
 */
export async function failVideoAndRefund(
    client: PrismaClient,
    params: {
        videoId: string;
        jobId: string | null;
        error: unknown;
        errorCode?: string;
    },
): Promise<boolean> {
    return client.$transaction(async (transaction) => {
        const video = await transaction.video.findUnique({
            where: { id: params.videoId },
            select: { userId: true },
        });
        if (!video) return false;

        const updated = await transaction.video.updateMany({
            where: {
                id: params.videoId,
                status: { in: ACTIVE_STATUSES },
                ...(params.jobId ? { bullMqJobId: params.jobId } : {}),
            },
            data: {
                status: "FAILED",
                errorCode: params.errorCode ?? lifecycleErrorCode(params.error),
                errorMessage: lifecycleErrorMessage(params.error),
                failedAt: new Date(),
                lastHeartbeatAt: null,
            },
        });
        if (updated.count === 0) return false;

        await transaction.user.update({
            where: { id: video.userId },
            data: { credits: { increment: 1 } },
        });
        await transaction.creditTransaction.create({
            data: {
                userId: video.userId,
                amount: 1,
                reason: "REFUND_FAILED_JOB",
                videoId: params.videoId,
            },
        });
        return true;
    });
}

export interface ReconcileOptions {
    /**
     * Returns true while the BullMQ job is still waiting, delayed or active.
     * QUEUED videos whose job is still alive are not timed out: they are
     * simply waiting behind other jobs (the media worker runs one at a time).
     */
    isJobAlive?: (jobId: string) => Promise<boolean>;
}

export async function reconcileStaleVideos(
    client: PrismaClient,
    options: ReconcileOptions = {},
): Promise<number> {
    const now = Date.now();
    const staleQueuedBefore = new Date(now - QUEUED_TIMEOUT_MS);
    const staleProcessingBefore = new Date(now - PROCESSING_TIMEOUT_MS);
    const staleVideos = await client.video.findMany({
        where: {
            OR: [
                {
                    status: "QUEUED",
                    OR: [
                        { lastHeartbeatAt: { lt: staleQueuedBefore } },
                        { lastHeartbeatAt: null, updatedAt: { lt: staleQueuedBefore } },
                    ],
                },
                {
                    status: "PROCESSING",
                    OR: [
                        { lastHeartbeatAt: { lt: staleProcessingBefore } },
                        { lastHeartbeatAt: null, updatedAt: { lt: staleProcessingBefore } },
                    ],
                },
            ],
        },
        select: { id: true, status: true, bullMqJobId: true },
    });

    let reconciledCount = 0;
    for (const video of staleVideos) {
        if (video.status === "QUEUED" && video.bullMqJobId && options.isJobAlive) {
            const alive = await options.isJobAlive(video.bullMqJobId).catch(() => true);
            if (alive) continue;
        }

        const failed = await failVideoAndRefund(client, {
            videoId: video.id,
            jobId: null,
            error: new Error("Video processing timed out. Please retry."),
            errorCode: "PROCESSING_TIMEOUT",
        });
        if (failed) reconciledCount += 1;
    }

    return reconciledCount;
}

/**
 * Claims a video for processing. Returns false when the video can no longer be
 * processed by this job (deleted, completed, failed/refunded, or owned by a
 * different job), so the worker can skip work whose result would be discarded.
 * A PROCESSING video owned by the same job ID may be reclaimed: that is a
 * BullMQ retry or a stalled-job restart after a worker crash.
 */
export async function markVideoProcessing(
    client: LifecycleClient,
    videoId: string,
    jobId: string,
): Promise<boolean> {
    const updated = await client.video.updateMany({
        where: {
            id: videoId,
            OR: [
                { status: "QUEUED", OR: [{ bullMqJobId: jobId }, { bullMqJobId: null }] },
                { status: "PROCESSING", bullMqJobId: jobId },
            ],
        },
        data: {
            status: "PROCESSING",
            processingStartedAt: new Date(),
            lastHeartbeatAt: new Date(),
            processingAttempt: { increment: 1 },
            bullMqJobId: jobId,
        },
    });
    return updated.count > 0;
}

export async function heartbeatVideo(
    client: LifecycleClient,
    videoId: string,
    jobId: string,
): Promise<void> {
    await client.video.updateMany({
        where: {
            id: videoId,
            bullMqJobId: jobId,
            status: "PROCESSING",
        },
        data: { lastHeartbeatAt: new Date() },
    });
}

export async function markVideoCompleted(
    client: LifecycleClient,
    videoId: string,
    jobId: string,
): Promise<boolean> {
    const updated = await client.video.updateMany({
        where: {
            id: videoId,
            bullMqJobId: jobId,
            status: "PROCESSING",
        },
        data: {
            status: "COMPLETED",
            completedAt: new Date(),
            lastHeartbeatAt: null,
            errorMessage: null,
            errorCode: null,
        },
    });
    return updated.count > 0;
}

export async function markVideoFailed(
    client: LifecycleClient,
    videoId: string,
    jobId: string | null,
    error: unknown,
    errorCode = lifecycleErrorCode(error),
): Promise<void> {
    await client.video.updateMany({
        where: {
            id: videoId,
            ...(jobId ? { bullMqJobId: jobId } : {}),
            status: { in: ACTIVE_STATUSES },
        },
        data: {
            status: "FAILED",
            errorMessage: lifecycleErrorMessage(error),
            errorCode,
            failedAt: new Date(),
            lastHeartbeatAt: null,
        },
    });
}
