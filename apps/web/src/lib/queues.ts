import { Queue } from "bullmq";
import type { Job, JobsOptions } from "bullmq";
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
const QUEUE_COMMAND_TIMEOUT_MS = 10_000;

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
        connectTimeout: 5_000,
        commandTimeout: QUEUE_COMMAND_TIMEOUT_MS,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
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

export async function enqueueMediaProcessingJob(
    data: MediaProcessingJobData,
    options: JobsOptions,
): Promise<Job<MediaProcessingJobData | CreateThumbnailJobData>> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            mediaProcessingQueue.add(PROCESS_VIDEO_JOB, data, options),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(
                        new Error(
                            `Timed out connecting to the media-processing queue after ${QUEUE_COMMAND_TIMEOUT_MS}ms.`,
                        ),
                    );
                }, QUEUE_COMMAND_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

if (process.env.NODE_ENV !== "production") {
    globalForQueues.mediaProcessingQueue = mediaProcessingQueue;
    globalForQueues.socialPublishingQueue = socialPublishingQueue;
}