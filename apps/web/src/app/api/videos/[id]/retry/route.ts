import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";
import {
    mediaProcessingQueue,
    PROCESS_VIDEO_JOB,
    type MediaProcessingJobData,
} from "@/lib/queues";

export const dynamic = "force-dynamic";

export async function POST(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;

    try {
        const actor = await getOrCreateActor();
        const video = await prisma.video.findFirst({
            where: { id, userId: actor.userId },
        });
        if (!video) {
            return NextResponse.json({ error: "Video not found." }, { status: 404 });
        }
        if (video.status !== "FAILED") {
            return NextResponse.json({ error: "Only failed videos can be retried." }, { status: 409 });
        }

        const payload: MediaProcessingJobData = {
            videoId: video.id,
            s3Key: video.s3Key,
            userId: video.userId,
            userPrompt: video.userPrompt ?? undefined,
            aspectRatio: video.aspectRatio,
            captionStyle: video.captionStyle,
        };

        await prisma.video.update({
            where: { id },
            data: {
                status: "QUEUED",
                errorMessage: null,
                errorCode: null,
                failedAt: null,
                completedAt: null,
                processingStartedAt: null,
                bullMqJobId: null,
                lastHeartbeatAt: new Date(),
            },
        });
        const job = await mediaProcessingQueue.add(PROCESS_VIDEO_JOB, payload, {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
        });
        await prisma.video.updateMany({
            where: { id, status: "QUEUED" },
            data: { bullMqJobId: String(job.id), lastHeartbeatAt: new Date() },
        });

        const workerWakeUrl = (
            process.env.WORKER_PUBLIC_URL ||
            "https://scroll-maestro-worker.onrender.com"
        ).replace(/\/$/, "");

        try {
            await fetch(`${workerWakeUrl}/health`, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; ScrollMaestro-Wake/1.0)",
                    "Cache-Control": "no-cache",
                },
                signal: AbortSignal.timeout(3000),
            });
        } catch {
            // Expected to timeout if Render is cold-booting (~40s); the inbound HTTP request alone triggers Render to spin up the container.
        }

        return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
    } catch (error) {
        console.error(`Failed to retry video ${id}.`, error);
        await prisma.video.update({
            where: { id },
            data: {
                status: "FAILED",
                errorMessage: error instanceof Error ? error.message : String(error),
                errorCode: "RETRY_QUEUE_FAILED",
                failedAt: new Date(),
                lastHeartbeatAt: null,
            },
        }).catch((statusError: unknown) => console.error("Failed to persist retry error.", statusError));
        return NextResponse.json({ error: "Unable to retry video." }, { status: 503 });
    }
}
