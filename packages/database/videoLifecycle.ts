import type { Prisma, PrismaClient, VideoStatus } from "@prisma/client";

type LifecycleClient = PrismaClient | Prisma.TransactionClient;

export const PROCESSING_TIMEOUT_MS = 45 * 60 * 1000;
export const QUEUED_TIMEOUT_MS = 15 * 60 * 1000;

export function lifecycleErrorCode(error: unknown): string {
    if (error instanceof Error && error.name) return error.name;
    return "PROCESSING_FAILED";
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

export async function reconcileStaleVideos(
    client: PrismaClient,
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
        select: { id: true, userId: true },
    });

    let reconciledCount = 0;
    for (const video of staleVideos) {
        await client.$transaction(async (transaction) => {
            const updated = await transaction.video.updateMany({
                where: {
                    id: video.id,
                    status: { in: ["QUEUED", "PROCESSING"] },
                },
                data: {
                    status: "FAILED",
                    errorCode: "PROCESSING_TIMEOUT",
                    errorMessage: "Video processing timed out. Please retry.",
                    failedAt: new Date(),
                    lastHeartbeatAt: null,
                },
            });
            if (updated.count === 0) return;

            await transaction.user.update({
                where: { id: video.userId },
                data: { credits: { increment: 1 } },
            });
            await transaction.creditTransaction.create({
                data: {
                    userId: video.userId,
                    amount: 1,
                    reason: "REFUND_FAILED_JOB",
                    videoId: video.id,
                },
            });
            reconciledCount += 1;
        });
    }

    return reconciledCount;
}

export async function markVideoProcessing(
    client: LifecycleClient,
    videoId: string,
    jobId: string,
): Promise<void> {
    await client.video.updateMany({
        where: {
            id: videoId,
            status: "QUEUED",
        },
        data: {
            status: "PROCESSING",
            processingStartedAt: new Date(),
            lastHeartbeatAt: new Date(),
            processingAttempt: { increment: 1 },
            bullMqJobId: jobId,
        },
    });
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
): Promise<void> {
    await client.video.updateMany({
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
            status: { in: ["QUEUED", "PROCESSING"] as VideoStatus[] },
        },
        data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorCode,
            failedAt: new Date(),
            lastHeartbeatAt: null,
        },
    });
}
