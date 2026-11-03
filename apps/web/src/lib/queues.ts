import { Queue } from "bullmq";
import type {
    AspectRatio,
    CaptionStyle,
} from "../../../../packages/database/index";

export type ProcessingMode = "CLIP" | "CAPTION_ONLY";

export const MEDIA_PROCESSING_QUEUE_NAME = "media-processing";
export const SOCIAL_PUBLISHING_QUEUE_NAME = "social-publishing";

export const PROCESS_VIDEO_JOB = "process-video";
export const CREATE_THUMBNAIL_JOB = "create-thumbnail";
export const PUBLISH_SOCIAL_POST_JOB = "publish-social-post";

export interface MediaProcessingJobData {
    videoId: string;
    s3Key: string;
    userId: string;
    userPrompt?: string;
    processingMode?: ProcessingMode;
    aspectRatio: AspectRatio;
    captionStyle: CaptionStyle;
}

export interface CreateThumbnailJobData {
    segmentId: string;
    thumbnailText?: string;
}

export interface SocialPublishingJobData {
    scheduledPostId: string;
    tiktokPublishType?: "DIRECT" | "DRAFT";
}

function getRedisConnectionConfig() {
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    const parsed = new URL(redisUrl);

    return {
        host: parsed.hostname || "127.0.0.1",
        port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
        username: parsed.username
            ? decodeURIComponent(parsed.username)
            : undefined,
        password: parsed.password
            ? decodeURIComponent(parsed.password)
            : undefined,
        tls: parsed.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null,
    };
}

const globalForQueues = globalThis as unknown as {
    mediaProcessingQueue?: Queue<MediaProcessingJobData | CreateThumbnailJobData>;
    socialPublishingQueue?: Queue<SocialPublishingJobData>;
};

export const mediaProcessingQueue =
    globalForQueues.mediaProcessingQueue ??
    new Queue<MediaProcessingJobData | CreateThumbnailJobData>(
        MEDIA_PROCESSING_QUEUE_NAME,
        {
            connection: getRedisConnectionConfig(),
        },
    );

export const socialPublishingQueue =
    globalForQueues.socialPublishingQueue ??
    new Queue<SocialPublishingJobData>(SOCIAL_PUBLISHING_QUEUE_NAME, {
        connection: getRedisConnectionConfig(),
    });

if (process.env.NODE_ENV !== "production") {
    globalForQueues.mediaProcessingQueue = mediaProcessingQueue;
    globalForQueues.socialPublishingQueue = socialPublishingQueue;
}
/**
 * Shared enqueue options for video processing. Three attempts with backoff
 * absorb transient failures (S3/Groq/Gemini/network); the worker marks
 * deterministic failures as unrecoverable so they are not retried.
 */
export const VIDEO_PROCESSING_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
};

/**
 * Enqueues a video-processing job under a caller-chosen ID. The caller must
 * have stored that ID on the Video row *before* calling this, so the worker
 * can never start a job the database does not know about.
 */
export async function enqueueVideoProcessing(
    jobData: MediaProcessingJobData,
    jobId: string,
): Promise<string> {
    const job = await mediaProcessingQueue.add(PROCESS_VIDEO_JOB, jobData, {
        ...VIDEO_PROCESSING_JOB_OPTIONS,
        jobId,
    });
    return String(job.id ?? jobId);
}

/**
 * Pings the Render worker so a sleeping free instance starts booting. A
 * timeout is expected during a cold start; the inbound request alone wakes it.
 */
export async function wakeWorker(): Promise<void> {
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
        // Expected while Render cold-boots (~40s).
    }
}
