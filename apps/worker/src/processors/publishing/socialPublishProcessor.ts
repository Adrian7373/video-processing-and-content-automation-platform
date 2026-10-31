import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Job } from "bullmq";
import axios, { isAxiosError } from "axios";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { z } from "zod";
import {
    prisma,
    type SocialPlatform,
} from "../../../../../packages/database/index.js";
import { env } from "../../config/env.js";
import { jobNames } from "../../constants/queues.js";

const s3Bucket = env.S3_BUCKET_NAME;
const LOCAL_TMP_DIR = join(process.cwd(), ".tmp");

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

interface SocialAccountRecord {
    id: string;
    platform: SocialPlatform;
    accountName: string;
    platformAccountId: string;
    userId: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
}

interface PlatformPublishContext {
    scheduledPostId: string;
    socialAccountId: string;
    platform: SocialPlatform;
    accountName: string;
    platformAccountId: string;
    userId: string;
    accessToken: string;
    refreshToken: string | null;
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

interface GoogleRefreshTokenResponse {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type: string;
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

function formatPublishError(error: unknown): string {
    if (isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data as
            | {
                error?:
                | string
                | {
                    message?: string;
                    errors?: Array<{ message?: string; reason?: string }>;
                };
                error_description?: string;
            }
            | undefined;

        if (typeof data?.error === "object" && data.error?.message) {
            return `API Error (${status ?? "unknown"}): ${data.error.message}`;
        }
        if (typeof data?.error_description === "string") {
            return `OAuth Error (${status ?? "unknown"}): ${data.error_description}`;
        }
        if (typeof data?.error === "string") {
            return `API Error (${status ?? "unknown"}): ${data.error}`;
        }
        return `HTTP ${status ?? "Error"}: ${error.message}`;
    }

    return error instanceof Error ? error.message : String(error);
}

/**
 * Refreshes a Google/YouTube OAuth 2.0 access token using the stored refreshToken
 * and updates the SocialAccount row in Prisma.
 */
async function refreshYouTubeAccessToken(
    account: Pick<SocialAccountRecord, "id" | "refreshToken">,
): Promise<string> {
    if (!account.refreshToken) {
        throw new Error(
            "YouTube access token has expired and no refreshToken is stored. Please reconnect your YouTube channel in /channels.",
        );
    }

    const clientId =
        process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
        process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in the worker environment to refresh YouTube OAuth tokens.",
        );
    }

    console.log(
        `[OAuth Refresh] Refreshing YouTube access token for SocialAccount ${account.id}...`,
    );

    const response = await axios.post<GoogleRefreshTokenResponse>(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: account.refreshToken,
            grant_type: "refresh_token",
        }).toString(),
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30_000,
        },
    );

    const newAccessToken = response.data.access_token;
    const expiresInSeconds = Math.max(60, response.data.expires_in ?? 3600);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
            accessToken: newAccessToken,
            tokenExpiresAt,
        },
    });

    return newAccessToken;
}

/**
 * Checks whether the SocialAccount's accessToken is expired (or expiring within 5 minutes)
 * and refreshes it before starting the upload.
 */
async function ensureValidAccessToken(
    account: SocialAccountRecord,
): Promise<string> {
    if (isDryRunAccount(account.accessToken)) {
        return account.accessToken;
    }

    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    const isExpiredOrExpiringSoon =
        account.tokenExpiresAt !== null &&
        account.tokenExpiresAt.getTime() <= fiveMinutesFromNow;

    if (account.platform === "YOUTUBE_SHORTS" && isExpiredOrExpiringSoon) {
        return refreshYouTubeAccessToken(account);
    }

    return account.accessToken;
}

async function generatePresignedVideoUrl(s3Key: string): Promise<string> {
    if (!s3Bucket) {
        throw new Error("S3_BUCKET_NAME must be configured.");
    }

    const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
    });

    return getSignedUrl(s3, command, { expiresIn: 3600 });
}

async function downloadS3ClipToTemp(
    s3Key: string,
    localPath: string,
): Promise<number> {
    if (!s3Bucket) {
        throw new Error("S3_BUCKET_NAME must be configured.");
    }

    await mkdir(LOCAL_TMP_DIR, { recursive: true });

    const response = await s3.send(
        new GetObjectCommand({
            Bucket: s3Bucket,
            Key: s3Key,
        }),
    );

    if (!response.Body) {
        throw new Error(`S3 object "${s3Key}" did not contain a body.`);
    }

    const bodyStream = Readable.fromWeb(
        response.Body.transformToWebStream() as unknown as NodeReadableStream<Uint8Array>,
    );

    await pipeline(bodyStream, createWriteStream(localPath));
    const fileStats = await stat(localPath);
    return fileStats.size;
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
                privacy_level: "SELF_ONLY",
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

    const containerRes = await axios.post<{ id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.platformAccountId)}/media`,
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

    const publishRes = await axios.post<{ id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.platformAccountId)}/media_publish`,
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

    const initRes = await axios.post<{ video_id?: string }>(
        `${graphBaseUrl}/${encodeURIComponent(ctx.platformAccountId)}/video_reels`,
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

    await axios.post(
        `${graphBaseUrl}/${encodeURIComponent(ctx.platformAccountId)}/video_reels`,
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
 * Executes a single YouTube Data API v3 resumable upload attempt using a local file
 */
async function executeYouTubeResumableUpload(
    localVideoPath: string,
    fileSizeBytes: number,
    accessToken: string,
    shortTitle: string,
    description: string,
): Promise<string> {
    // Step 1: Initiate resumable upload session
    const initRes = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
            snippet: {
                title: shortTitle,
                description,
                categoryId: "22", // People & Blogs
            },
            status: {
                privacyStatus: "public",
                selfDeclaredMadeForKids: false,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": String(fileSizeBytes),
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

    // Step 2: Stream the local MP4 file with exact Content-Length
    const uploadRes = await axios.put<{ id?: string }>(
        uploadUrl,
        createReadStream(localVideoPath),
        {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Length": String(fileSizeBytes),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 10 * 60 * 1000,
        },
    );

    const youtubeVideoId = uploadRes.data?.id;
    if (!youtubeVideoId) {
        throw new Error("YouTube upload completed without a video ID.");
    }

    return youtubeVideoId;
}

/**
 * YouTube Data API v3 Resumable Video Upload for Shorts with 401 token-refresh retry
 */
async function publishToYouTubeShorts(
    ctx: PlatformPublishContext,
): Promise<PlatformPublishResult> {
    const tempFilePath = join(
        LOCAL_TMP_DIR,
        `yt-publish-${ctx.scheduledPostId}-${Date.now()}.mp4`,
    ).replace(/\\/g, "/");

    try {
        console.log(
            `[YouTube Publisher] Downloading S3 clip "${ctx.s3Key}" to temporary file...`,
        );
        const fileSizeBytes = await downloadS3ClipToTemp(
            ctx.s3Key,
            tempFilePath,
        );

        const cleanTitle = ctx.title.trim() || "Short Clip";
        const shortTitle = cleanTitle.toLowerCase().includes("#shorts")
            ? cleanTitle.slice(0, 100)
            : `${cleanTitle.slice(0, 90)} #Shorts`;

        const description = ctx.caption.toLowerCase().includes("#shorts")
            ? ctx.caption
            : `${ctx.caption}\n\n#Shorts`;

        let activeAccessToken = ctx.accessToken;
        let youtubeVideoId: string;

        try {
            youtubeVideoId = await executeYouTubeResumableUpload(
                tempFilePath,
                fileSizeBytes,
                activeAccessToken,
                shortTitle,
                description,
            );
        } catch (uploadError) {
            // If Google returns 401 Unauthorized and we have a refresh token, refresh and retry once
            if (
                isAxiosError(uploadError) &&
                uploadError.response?.status === 401 &&
                ctx.refreshToken
            ) {
                console.warn(
                    `[YouTube Publisher] Received 401 Unauthorized. Refreshing token and retrying...`,
                );
                activeAccessToken = await refreshYouTubeAccessToken({
                    id: ctx.socialAccountId,
                    refreshToken: ctx.refreshToken,
                });

                youtubeVideoId = await executeYouTubeResumableUpload(
                    tempFilePath,
                    fileSizeBytes,
                    activeAccessToken,
                    shortTitle,
                    description,
                );
            } else {
                throw uploadError;
            }
        }

        return {
            externalPostId: youtubeVideoId,
            publishedUrl: `https://youtube.com/shorts/${youtubeVideoId}`,
            mode: "LIVE",
        };
    } finally {
        await rm(tempFilePath, { force: true }).catch(() => undefined);
    }
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
                    platformAccountId: true,
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

        // Proactively refresh the OAuth token if it is expired or expiring within 5 minutes
        const validAccessToken = await ensureValidAccessToken(
            scheduledPost.socialAccount,
        );

        const signedVideoUrl =
            await generatePresignedVideoUrl(activeVideoS3Key);

        const result = await dispatchPlatformPublish({
            scheduledPostId: scheduledPost.id,
            socialAccountId: scheduledPost.socialAccount.id,
            platform: scheduledPost.socialAccount.platform,
            accountName: scheduledPost.socialAccount.accountName,
            platformAccountId: scheduledPost.socialAccount.platformAccountId,
            userId: scheduledPost.socialAccount.userId,
            accessToken: validAccessToken,
            refreshToken: scheduledPost.socialAccount.refreshToken,
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
        const errorMessage = formatPublishError(error);

        console.error(
            `[Social Publisher] Failed attempt ${job.attemptsMade + 1}/${maxAttempts} for ScheduledPost ${scheduledPostId}: ${errorMessage}`,
        );

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