import { NextResponse } from "next/server";
import { z } from "zod";
import {
    AspectRatio,
    CaptionStyle,
    CreditReason,
    prisma,
} from "../../../../../../../packages/database/index";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "../../../../../../../packages/database/uploadLimits";
import {
    buildVideoProcessingJobId,
    failVideoAndRefund,
} from "../../../../../../../packages/database/videoLifecycle";
import {
    enqueueVideoProcessing,
    wakeWorker,
    type MediaProcessingJobData,
} from "@/lib/queues";
import { checkUploadedObject } from "@/lib/s3";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const videoProcessingJobSchema = z.object({
    s3Key: z.string().min(1),
    videoId: z.string().uuid(),
    // Accepted for backwards compatibility but never trusted: the actor is resolved server-side.
    userId: z.string().min(1).optional(),
    userPrompt: z.string().trim().max(1000).optional(),
    processingMode: z.enum(["CLIP", "CAPTION_ONLY"]).default("CLIP"),
    aspectRatio: z.nativeEnum(AspectRatio).optional(),
    captionStyle: z.nativeEnum(CaptionStyle).optional(),
});

class InsufficientCreditsError extends Error {
    constructor() {
        super("INSUFFICIENT_CREDITS");
        this.name = "InsufficientCreditsError";
    }
}

class VideoAlreadyQueuedError extends Error {
    constructor() {
        super("VIDEO_ALREADY_QUEUED");
        this.name = "VideoAlreadyQueuedError";
    }
}

function outOfCreditsResponse(isAnonymous: boolean) {
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

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    const parsedBody = videoProcessingJobSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            { error: "s3Key and videoId are required." },
            { status: 400 },
        );
    }

    const requestData = parsedBody.data;
    let isAnonymous = true;
    let queuedJobId: string | null = null;

    try {
        const actor = await getOrCreateActor();
        isAnonymous = actor.isAnonymous;

        const video = await prisma.video.findUnique({
            where: { id: requestData.videoId },
            select: {
                id: true,
                s3Key: true,
                userId: true,
                status: true,
                userPrompt: true,
                aspectRatio: true,
                captionStyle: true,
            },
        });

        if (
            !video ||
            video.s3Key !== requestData.s3Key ||
            video.userId !== actor.userId ||
            video.status !== "UPLOADING"
        ) {
            return NextResponse.json(
                { error: "Video upload session is invalid or already processed." },
                { status: 409 },
            );
        }

        // Never charge for, or queue, an upload that did not reach storage.
        const uploaded = await checkUploadedObject(video.s3Key, MAX_UPLOAD_FILE_SIZE_BYTES);
        if (!uploaded.ok) {
            const message =
                uploaded.reason === "missing"
                    ? "The upload did not finish. Please upload the video again."
                    : uploaded.reason === "empty"
                        ? "The uploaded video file is empty."
                        : "Video files must not exceed 300 MB.";
            return NextResponse.json(
                { error: message, code: `UPLOAD_${uploaded.reason.toUpperCase()}` },
                { status: uploaded.reason === "missing" ? 409 : 400 },
            );
        }

        const resolvedPrompt =
            requestData.processingMode === "CAPTION_ONLY"
                ? "[CAPTION_ONLY]"
                : (requestData.userPrompt ?? video.userPrompt ?? undefined);

        const jobData: MediaProcessingJobData = {
            videoId: video.id,
            s3Key: video.s3Key,
            userId: actor.userId,
            userPrompt: resolvedPrompt,
            processingMode: requestData.processingMode,
            aspectRatio: requestData.aspectRatio ?? video.aspectRatio,
            captionStyle: requestData.captionStyle ?? video.captionStyle,
        };
        const jobId = buildVideoProcessingJobId(video.id);

        // Atomic: claim UPLOADING -> QUEUED (blocks double-submits), deduct
        // the credit, and record the job ID before the job exists.
        const updatedCredits = await prisma.$transaction(async (tx) => {
            const claimed = await tx.video.updateMany({
                where: { id: video.id, userId: actor.userId, status: "UPLOADING" },
                data: {
                    status: "QUEUED",
                    errorMessage: null,
                    errorCode: null,
                    failedAt: null,
                    completedAt: null,
                    processingStartedAt: null,
                    processingAttempt: 0,
                    bullMqJobId: jobId,
                    lastHeartbeatAt: new Date(),
                    userPrompt: jobData.userPrompt ?? null,
                    aspectRatio: jobData.aspectRatio,
                    captionStyle: jobData.captionStyle,
                },
            });
            if (claimed.count === 0) {
                throw new VideoAlreadyQueuedError();
            }

            const deducted = await tx.user.updateMany({
                where: { id: actor.userId, credits: { gte: 1 } },
                data: { credits: { decrement: 1 } },
            });
            if (deducted.count === 0) {
                throw new InsufficientCreditsError();
            }

            await tx.creditTransaction.create({
                data: {
                    userId: actor.userId,
                    amount: -1,
                    reason: CreditReason.VIDEO_PROCESS,
                    videoId: video.id,
                },
            });

            const refreshedUser = await tx.user.findUnique({
                where: { id: actor.userId },
                select: { credits: true },
            });
            return refreshedUser?.credits ?? 0;
        });

        queuedJobId = jobId;
        await enqueueVideoProcessing(jobData, jobId);
        await wakeWorker();

        return NextResponse.json(
            {
                jobId,
                queued: true,
                creditsRemaining: updatedCredits,
                isAnonymous: actor.isAnonymous,
            },
            { status: 202 },
        );
    } catch (error) {
        if (error instanceof InsufficientCreditsError) {
            return outOfCreditsResponse(isAnonymous);
        }
        if (error instanceof VideoAlreadyQueuedError) {
            return NextResponse.json(
                { error: "This video is already being processed." },
                { status: 409 },
            );
        }

        console.error("Failed to enqueue media-processing job.", error);

        // The credit was charged but the job never reached Redis: refund it
        // (idempotent and scoped to this job ID).
        if (queuedJobId) {
            await failVideoAndRefund(prisma, {
                videoId: requestData.videoId,
                jobId: queuedJobId,
                error,
                errorCode: "QUEUE_SUBMISSION_FAILED",
            }).catch((refundError: unknown) => {
                console.error("Failed to refund credit after queue failure.", refundError);
            });
        }

        return NextResponse.json(
            { error: "Unable to queue video processing." },
            { status: 503 },
        );
    }
}
