import { NextResponse } from "next/server";
import { z } from "zod";
import {
    AspectRatio,
    CaptionStyle,
    CreditReason,
    prisma,
} from "../../../../../../../packages/database/index";
import {
    mediaProcessingQueue,
    PROCESS_VIDEO_JOB,
    type MediaProcessingJobData,
} from "@/lib/queues";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const videoProcessingJobSchema = z.object({
    s3Key: z.string().min(1),
    videoId: z.string().uuid(),
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
    let deductedUserId: string | null = null;

    try {
        const actor = await getOrCreateActor();

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

        // Atomic credit deduction + video status update
        const updatedCredits = await prisma.$transaction(async (tx) => {
            const deducted = await tx.user.updateMany({
                where: {
                    id: actor.userId,
                    credits: { gte: 1 },
                },
                data: {
                    credits: { decrement: 1 },
                },
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

            await tx.video.update({
                where: { id: video.id },
                data: {
                    status: "PROCESSING",
                    errorMessage: null,
                    userPrompt: jobData.userPrompt ?? null,
                    aspectRatio: jobData.aspectRatio,
                    captionStyle: jobData.captionStyle,
                },
            });

            const refreshedUser = await tx.user.findUnique({
                where: { id: actor.userId },
                select: { credits: true },
            });

            return refreshedUser?.credits ?? 0;
        });

        deductedUserId = actor.userId;

        const job = await mediaProcessingQueue.add(PROCESS_VIDEO_JOB, jobData, {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
        });

        return NextResponse.json(
            {
                jobId: job.id,
                queued: true,
                creditsRemaining: updatedCredits,
                isAnonymous: actor.isAnonymous,
            },
            { status: 202 },
        );
    } catch (error) {
        if (error instanceof InsufficientCreditsError) {
            const actor = await getOrCreateActor().catch(() => null);
            const isAnon = actor?.isAnonymous ?? true;
            return NextResponse.json(
                {
                    error: isAnon
                        ? "You have used all 3 free trial credits. Sign in or create an account to unlock 10 more credits."
                        : "You have 0 credits remaining.",
                    code: isAnon
                        ? "TRIAL_CREDITS_EXHAUSTED"
                        : "INSUFFICIENT_CREDITS",
                    requiresAuth: isAnon,
                    creditsRemaining: 0,
                },
                { status: 402 },
            );
        }

        console.error("Failed to enqueue media-processing job.", error);

        // Refund credit & mark video FAILED if queue submission failed after DB deduction
        if (deductedUserId) {
            const userIdToRefund = deductedUserId;
            await prisma
                .$transaction([
                    prisma.user.update({
                        where: { id: userIdToRefund },
                        data: { credits: { increment: 1 } },
                    }),
                    prisma.creditTransaction.create({
                        data: {
                            userId: userIdToRefund,
                            amount: 1,
                            reason: CreditReason.REFUND_FAILED_JOB,
                            videoId: requestData.videoId,
                        },
                    }),
                    prisma.video.update({
                        where: { id: requestData.videoId },
                        data: {
                            status: "FAILED",
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to queue video processing.",
                        },
                    }),
                ])
                .catch((refundError: unknown) => {
                    console.error(
                        "Failed to refund credit after queue failure.",
                        refundError,
                    );
                });
        }

        return NextResponse.json(
            { error: "Unable to queue video processing." },
            { status: 503 },
        );
    }
}