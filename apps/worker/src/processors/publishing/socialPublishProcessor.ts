import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Job } from "bullmq";
import axios from "axios";
import { Readable } from "node:stream";
import { z } from "zod";
import {
    prisma,
    type SocialPlatform,
} from "../../../../../packages/database/index.js";
import { env } from "../../config/env.js";
import { jobNames } from "../../constants/queues.js";

const s3Bucket = env.S3_BUCKET_NAME;

const s3 = new S3Client({
    ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
    maxAttempts: 5,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 30_000,
        socketTimeout: 10 * 60 * 1000,
    }),
});

const socialPublishingJobSchema = z.object({
    scheduledPostId: z.string().uuid(),
});

export type SocialPublishingJobData = z.infer<typeof socialPublishingJobSchema>;

interface PlatformPublishContext {
    scheduledPostId: string;
    platform: SocialPlatform;
    accountName: string;
    userId: string;
    accessToken: string;
    s3Key: string;
    signedVideoUrl: string;
    title: string;
    caption: string;
}

interface PlatformPublishResult {
    publishedUrl: string;
    externalPostId: string;
    mode: "LIVE" | "DRY_RUN";
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDryRunAccount(accessToken: string): boolean {
    const envFlag = process.env.SOCIAL_PUBLISH_DRY_RUN;
    if (envFlag && envFlag.toLowerCase() === "true") {
        return true;
    }
    return (
        accessToken.startsWith("mock_token_") ||
        accessToken.startsWith("demo_") ||
        accessToken === "test"
    );
}

async function generatePresignedVideoUrl(s3Key: string): Promise<string> {
    if (!s3Bucket) {
        throw new Error("S3_BUCKET_NAME must be configured.");
    }

    const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
    });

    // Valid for 1 hour so TikTok/Instagram servers have plenty of time to pull the video
    return getSignedUrl(s3, command, { expiresIn: 3600 });
}

async function simulateDryRunPublish(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    console.log(
        `[Dry-Run Publisher] Simulating upload to ${ctx.platform} (${ctx.accountName})...`,
    );
    console.log(`[Dry-Run Publisher] S3 Clip Key: "${ctx.s3Key}"`);
    console.log(`[Dry-Run Publisher] Caption: "${ctx.caption}"`);

    await sleep(2500);

    const mockId = `${ctx.scheduledPostId.slice(0, 8)}_${Date.now()}`;
    const urlByPlatform: Record<SocialPlatform, string> = {
        YOUTUBE_SHORTS: `https://youtube.com/shorts/${mockId}`,
        TIKTOK: `https://www.tiktok.com/@${encodeURIComponent(ctx.accountName)}/video/${mockId}`,
        INSTAGRAM_REELS: `https://www.instagram.com/reel/${mockId}/`,
        FACEBOOK_REELS: `https://www.facebook.com/reel/${mockId}`,
    };

    return {
        publishedUrl: urlByPlatform[ctx.platform],
        externalPostId: mockId,
        mode: "DRY_RUN",
    };
}

/**
 * TikTok Content Posting API v2 (PULL_FROM_URL)
 */
async function publishToTikTok(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    const response = await axios.post<{
        data?: { publish_id?: string };
        error?: { code?: string; message?: string };
    }>(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        {
            post_info: {
                title: ctx.caption.slice(0, 2200),
                privacy_level: "SELF_ONLY", // Safe default for unaudited developer apps
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
            },
            source_info: {
                source: "PULL_FROM_URL",
                video_url: ctx.signedVideoUrl,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${ctx.accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
            },
            timeout: 60_000,
        },
    );

    const publishId = response.data?.data?.publish_id;
    if (!publishId) {
        const errMsg =
            response.data?.error?.message ??
            "TikTok API did not return a publish_id.";
        throw new Error(`TikTok publish failed: ${errMsg}`);
    }

    return {
        externalPostId: publishId,
        publishedUrl: `https://www.tiktok.com/@${encodeURIComponent(ctx.accountName)}`,
        mode: "LIVE",
    };
}

/**
 * Instagram Graph API Reels Publishing (Container -> Poll -> Publish)
 */
async function publishToInstagramReels(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    const graphBaseUrl = "https://graph.facebook.com/v21.0";

    // Step 1: Create Reels media container
    const containerRes = await axios.post<{ id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.userId)}/media`,
        null,
        {
            params: {
                media_type: "REELS",
                video_url: ctx.signedVideoUrl,
                caption: ctx.caption,
                access_token: ctx.accessToken,
            },
            timeout: 60_000,
        },
    );

    const creationId = containerRes.data?.id;
    if (!creationId) {
        throw new Error(
            "Instagram Graph API did not return a media container ID.",
        );
    }

    // Step 2: Poll container status until FINISHED (max ~2 minutes)
    let isReady = false;
    for (let attempt = 0; attempt < 24; attempt++) {
        await sleep(5000);
        const statusRes = await axios.get<{
            status_code?: string;
            status?: string;
        }>(`${graphBaseUrl}/${creationId}`, {
            params: {
                fields: "status_code,status",
                access_token: ctx.accessToken,
            },
            timeout: 30_000,
        });

        const statusCode = statusRes.data?.status_code;
        if (statusCode === "FINISHED") {
            isReady = true;
            break;
        }
        if (statusCode === "ERROR" || statusCode === "EXPIRED") {
            throw new Error(
                `Instagram media container failed with status: ${statusCode}`,
            );
        }
    }

    if (!isReady) {
        throw new Error(
            "Timed out waiting for Instagram Reels container processing.",
        );
    }

    // Step 3: Publish the processed container
    const publishRes = await axios.post<{ id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.userId)}/media_publish`,
        null,
        {
            params: {
                creation_id: creationId,
                access_token: ctx.accessToken,
            },
            timeout: 60_000,
        },
    );

    const mediaId = publishRes.data?.id ?? creationId;

    return {
        externalPostId: mediaId,
        publishedUrl: `https://www.instagram.com/reels/${mediaId}/`,
        mode: "LIVE",
    };
}

/**
 * Facebook Graph API Page Reels Hosted Upload
 */
async function publishToFacebookReels(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    const graphBaseUrl = "https://graph.facebook.com/v21.0";

    // Step 1: Initialize upload session
    const initRes = await axios.post<{ video_id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.userId)}/video_reels`,
        {
            upload_phase: "start",
            access_token: ctx.accessToken,
        },
        { timeout: 60_000 },
    );

    const videoId = initRes.data?.video_id;
    if (!videoId) {
        throw new Error(
            "Facebook Graph API did not return a video_id during initialization.",
        );
    }

    // Step 2: Instruct Facebook to pull the video file directly from our S3 Presigned URL
    await axios.post(
        `https://rupload.facebook.com/video-upload/v21.0/${encodeURIComponent(videoId)}`,
        null,
        {
            headers: {
                Authorization: `OAuth ${ctx.accessToken}`,
                file_url: ctx.signedVideoUrl,
            },
            timeout: 5 * 60 * 1000,
        },
    );

    // Step 3: Finish and publish the Reel
    await axios.post(
        `${graphBaseUrl}/${encodeURIComponent(ctx.userId)}/video_reels`,
        {
            video_id: videoId,
            upload_phase: "finish",
            video_state: "PUBLISHED",
            description: ctx.caption,
            access_token: ctx.accessToken,
        },
        { timeout: 60_000 },
    );

    return {
        externalPostId: videoId,
        publishedUrl: `https://www.facebook.com/reel/${videoId}`,
        mode: "LIVE",
    };
}

/**
 * YouTube Data API v3 Resumable Video Upload for Shorts
 */
async function publishToYouTubeShorts(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    if (!s3Bucket) {
        throw new Error("S3_BUCKET_NAME must be configured.");
    }

    const s3Object = await s3.send(
        new GetObjectCommand({
            Bucket: s3Bucket,
            Key: ctx.s3Key,
        }),
    );

    if (!s3Object.Body) {
        throw new Error(
            `Unable to read S3 video stream for key "${ctx.s3Key}".`,
        );
    }

    const shortTitle = ctx.title.toLowerCase().includes("#shorts")
        ? ctx.title.slice(0, 100)
        : `${ctx.title.slice(0, 90)} #Shorts`;

    // Step 1: Initiate resumable upload session
    const initRes = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
            snippet: {
                title: shortTitle,
                description: ctx.caption,
                categoryId: "22", // People & Blogs
            },
            status: {
                privacyStatus: "public",
                selfDeclaredMadeForKids: false,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${ctx.accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                ...(s3Object.ContentLength
                    ? {
                        "X-Upload-Content-Length": String(
                            s3Object.ContentLength,
                        ),
                    }
                    : {}),
                "X-Upload-Content-Type": "video/mp4",
            },
            timeout: 60_000,
        },
    );

    const uploadUrl = initRes.headers["location"] as string | undefined;
    if (!uploadUrl) {
        throw new Error(
            "YouTube resumable upload did not return a Location header.",
        );
    }

    // Step 2: Stream the S3 video body to the resumable upload URL
    const videoStream = s3Object.Body as unknown as Readable;
    const uploadRes = await axios.put<{ id?: string }>(uploadUrl, videoStream, {
        headers: {
            "Content-Type": "video/mp4",
            ...(s3Object.ContentLength
                ? { "Content-Length": String(s3Object.ContentLength) }
                : {}),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 10 * 60 * 1000,
    });

    const youtubeVideoId = uploadRes.data?.id;
    if (!youtubeVideoId) {
        throw new Error("YouTube upload completed without a video ID.");
    }

    return {
        externalPostId: youtubeVideoId,
        publishedUrl: `https://youtube.com/shorts/${youtubeVideoId}`,
        mode: "LIVE",
    };
}

async function dispatchPlatformPublish(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    if (isDryRunAccount(ctx.accessToken)) {
        return simulateDryRunPublish(ctx);
    }

    switch (ctx.platform) {
        case "TIKTOK":
            return publishToTikTok(ctx);
        case "INSTAGRAM_REELS":
            return publishToInstagramReels(ctx);
        case "FACEBOOK_REELS":
            return publishToFacebookReels(ctx);
        case "YOUTUBE_SHORTS":
            return publishToYouTubeShorts(ctx);
    }
}

export async function processSocialPublish(
    job: Job<SocialPublishingJobData>,
): Promise<{
    status: "published" | "skipped";
    publishedUrl?: string;
    mode?: "LIVE" | "DRY_RUN";
}> {
    if (job.name !== jobNames.publishSocialPost) {
        throw new Error(
            `Unsupported job "${job.name}" received by the social publishing worker.`,
        );
    }

    const { scheduledPostId } = socialPublishingJobSchema.parse(job.data);

    const scheduledPost = await prisma.scheduledPost.findUnique({
        where: { id: scheduledPostId },
        include: {
            videoSegment: {
                select: {
                    id: true,
                    title: true,
                    clipS3Key: true,
                    captionedClipS3Key: true,
                    socialCaption: true,
                },
            },
            socialAccount: {
                select: {
                    id: true,
                    platform: true,
                    accountName: true,
                    userId: true,
                    accessToken: true,
                    refreshToken: true,
                    tokenExpiresAt: true,
                },
            },
        },
    });

    if (!scheduledPost) {
        console.warn(
            `ScheduledPost "${scheduledPostId}" no longer exists. Skipping job.`,
        );
        return { status: "skipped" };
    }

    if (
        scheduledPost.status === "CANCELLED" ||
        scheduledPost.status === "PUBLISHED"
    ) {
        console.log(
            `ScheduledPost "${scheduledPostId}" has status ${scheduledPost.status}. Skipping execution.`,
        );
        return { status: "skipped" };
    }

    // Prefer the burned-in captioned clip if available
    const activeVideoS3Key =
        scheduledPost.videoSegment.captionedClipS3Key ??
        scheduledPost.videoSegment.clipS3Key;

    if (!activeVideoS3Key) {
        await prisma.scheduledPost.update({
            where: { id: scheduledPostId },
            data: {
                status: "FAILED",
                errorMessage:
                    "Video segment does not have a valid S3 video key.",
            },
        });
        throw new Error(
            `VideoSegment "${scheduledPost.videoSegment.id}" has no S3 clip key.`,
        );
    }

    try {
        await prisma.scheduledPost.update({
            where: { id: scheduledPostId },
            data: {
                status: "PUBLISHING",
                errorMessage: null,
            },
        });

        const signedVideoUrl =
            await generatePresignedVideoUrl(activeVideoS3Key);

        const result = await dispatchPlatformPublish({
            scheduledPostId: scheduledPost.id,
            platform: scheduledPost.socialAccount.platform,
            accountName: scheduledPost.socialAccount.accountName,
            userId: scheduledPost.socialAccount.userId,
            accessToken: scheduledPost.socialAccount.accessToken,
            s3Key: activeVideoS3Key,
            signedVideoUrl,
            title: scheduledPost.videoSegment.title,
            caption:
                scheduledPost.caption ||
                scheduledPost.videoSegment.socialCaption ||
                scheduledPost.videoSegment.title,
        });

        await prisma.scheduledPost.update({
            where: { id: scheduledPostId },
            data: {
                status: "PUBLISHED",
                publishedUrl: result.publishedUrl,
                publishedAt: new Date(),
                errorMessage: null,
            },
        });

        console.log(
            `Successfully published post ${scheduledPostId} (${result.mode}) -> ${result.publishedUrl}`,
        );

        return {
            status: "published",
            publishedUrl: result.publishedUrl,
            mode: result.mode,
        };
    } catch (error) {
        const maxAttempts = job.opts.attempts ?? 1;
        const attemptsExhausted = job.attemptsMade + 1 >= maxAttempts;
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        await prisma.scheduledPost
            .update({
                where: { id: scheduledPostId },
                data: {
                    status: attemptsExhausted ? "FAILED" : "SCHEDULED",
                    errorMessage,
                },
            })
            .catch((dbError: unknown) => {
                console.error(
                    `Failed to update error status for ScheduledPost ${scheduledPostId}:`,
                    dbError,
                );
            });

        throw error;
    }
}