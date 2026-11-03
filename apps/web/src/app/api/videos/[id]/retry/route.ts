import { NextResponse } from "next/server";
import { z } from "zod";
import {
    CreditReason,
    prisma,
} from "../../../../../../../../packages/database/index";
import {
    buildVideoProcessingJobId,
    failVideoAndRefund,
} from "../../../../../../../../packages/database/videoLifecycle";
import { getOrCreateActor } from "@/lib/auth";
import {
    enqueueVideoProcessing,
    wakeWorker,
    type MediaProcessingJobData,
} from "@/lib/queues";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

class InsufficientCreditsError extends Error {
    constructor() {
        super("INSUFFICIENT_CREDITS");
        this.name = "InsufficientCreditsError";
    }
}

class NotRetryableError extends Error {
    constructor() {
        super("NOT_RETRYABLE");
        this.name = "NotRetryableError";
    }
}

/**
 * Retrying costs one credit, like the first run. Every failed run is refunded,
 * so a retry that fails again is free. A free retry plus a refund on failure
 * would let each failing retry mint a credit.
 */
export async function POST(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
        return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }
    const { id } = parsedParams.data;
    let isAnonymous = true;
    let queuedJobId: string | null = null;

    try {
        const actor = await getOrCreateActor();
        isAnonymous = actor.isAnonymous;

        const video = await prisma.video.findFirst({
            where: { id, userId: actor.userId },
        });
        if (!video) {
            return NextResponse.json({ error: "Video not found." }, { status: 404 });
        }
        if (video.status !== "FAILED") {
            return NextResponse.json({ error: "Only failed videos can be retried." }, { status: 409 });
        }

        const isCaptionOnly = video.userPrompt?.trim() === "[CAPTION_ONLY]";
        const payload: MediaProcessingJobData = {
            videoId: video.id,
            s3Key: video.s3Key,
            userId: video.userId,
            userPrompt: video.userPrompt ?? undefined,
            processingMode: isCaptionOnly ? "CAPTION_ONLY" : "CLIP",
            aspectRatio: video.aspectRatio,
            captionStyle: video.captionStyle,
        };
        const jobId = buildVideoProcessingJobId(video.id);

        const creditsRemaining = await prisma.$transaction(async (tx) => {
            // Conditional flip blocks double-clicks from queueing two jobs.
            const claimed = await tx.video.updateMany({
                where: { id, userId: actor.userId, status: "FAILED" },
                data: {
                    status: "QUEUED",
                    errorMessage: null,
                    errorCode: null,
                    failedAt: null,
                    completedAt: null,
                    processingStartedAt: null,
                    bullMqJobId: jobId,
                    lastHeartbeatAt: new Date(),
                },
            });
            if (claimed.count === 0) throw new NotRetryableError();

            const deducted = await tx.user.updateMany({
                where: { id: actor.userId, credits: { gte: 1 } },
                data: { credits: { decrement: 1 } },
            });
            if (deducted.count === 0) throw new InsufficientCreditsError();

            await tx.creditTransaction.create({
                data: {
                    userId: actor.userId,
                    amount: -1,
                    reason: CreditReason.VIDEO_PROCESS,
                    videoId: video.id,
                },
            });

            const user = await tx.user.findUnique({
                where: { id: actor.userId },
                select: { credits: true },
            });
            return user?.credits ?? 0;
        });

        queuedJobId = jobId;
        await enqueueVideoProcessing(payload, jobId);
        await wakeWorker();

        return NextResponse.json(
            { queued: true, jobId, creditsRemaining },
            { status: 202 },
        );
    } catch (error) {
        if (error instanceof InsufficientCreditsError) {
            return NextResponse.json(
                {
                    error: isAnonymous
                        ? "You have used all 3 free trial credits. Sign in or create an account to unlock 10 more credits."
                        : "You have 0 credits remaining.",
                    code: isAnonymous ? "TRIAL_CREDITS_EXHAUSTED" : "INSUFFICIENT_CREDITS",
                    requiresAuth: isAnonymous,
                    creditsRemaining: 0,
                },
                { status: 402 },
            );
        }
        if (error instanceof NotRetryableError) {
            return NextResponse.json({ error: "Only failed videos can be retried." }, { status: 409 });
        }

        console.error(`Failed to retry video ${id}.`, error);
        if (queuedJobId) {
            await failVideoAndRefund(prisma, {
                videoId: id,
                jobId: queuedJobId,
                error,
                errorCode: "RETRY_QUEUE_FAILED",
            }).catch((statusError: unknown) =>
                console.error("Failed to persist retry error.", statusError),
            );
        }
        return NextResponse.json({ error: "Unable to retry video." }, { status: 503 });
    }
}
