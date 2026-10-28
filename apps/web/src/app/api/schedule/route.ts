import { NextResponse } from "next/server";
import { z } from "zod";
import {
    prisma,
    SocialPlatform,
} from "../../../../../../packages/database/index";
import {
    PUBLISH_SOCIAL_POST_JOB,
    socialPublishingQueue,
} from "@/lib/queues";
import type { CalendarScheduledPostItem } from "@/app/calendar/CalendarClient";

export const dynamic = "force-dynamic";

const schedulePostRequestSchema = z.object({
    segmentId: z.string().uuid(),
    socialAccountIds: z.array(z.string().min(1)).min(1),
    caption: z.string().trim().max(2200).default(""),
    scheduledFor: z
        .string()
        .refine((val) => !Number.isNaN(new Date(val).getTime()), {
            message: "scheduledFor must be a valid ISO date string.",
        }),
});

const DEMO_ACCOUNT_MAP: Record<
    string,
    {
        platform: SocialPlatform;
        accountName: string;
        platformUserId: string;
    }
> = {
    "demo-yt": {
        platform: SocialPlatform.YOUTUBE_SHORTS,
        accountName: "YouTube Shorts",
        platformUserId: "demo_youtube_shorts",
    },
    "demo-tt": {
        platform: SocialPlatform.TIKTOK,
        accountName: "TikTok Creator",
        platformUserId: "demo_tiktok_creator",
    },
    "demo-ig": {
        platform: SocialPlatform.INSTAGRAM_REELS,
        accountName: "Instagram Reels",
        platformUserId: "demo_instagram_reels",
    },
    "demo-fb": {
        platform: SocialPlatform.FACEBOOK_REELS,
        accountName: "Facebook Reels",
        platformUserId: "demo_facebook_reels",
    },
};

async function resolveOrCreateAccountId(
    rawAccountId: string,
    userId: string,
): Promise<string | null> {
    const demoConfig = DEMO_ACCOUNT_MAP[rawAccountId];
    if (demoConfig) {
        const upserted = await prisma.socialAccount.upsert({
            where: {
                userId_platform_platformAccountId: {
                    userId,
                    platform: demoConfig.platform,
                    platformAccountId: demoConfig.platformUserId,
                },
            },
            update: {},
            create: {
                userId,
                platform: demoConfig.platform,
                platformAccountId: demoConfig.platformUserId,
                accountName: demoConfig.accountName,
                accessToken: `mock_token_${demoConfig.platform.toLowerCase()}`,
            },
            select: { id: true },
        });
        return upserted.id;
    }

    const existing = await prisma.socialAccount.findUnique({
        where: { id: rawAccountId },
        select: { id: true },
    });

    return existing?.id ?? null;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        const scheduledPosts = await prisma.scheduledPost.findMany({
            where: {
                ...(startParam || endParam
                    ? {
                        scheduledFor: {
                            ...(startParam
                                ? { gte: new Date(startParam) }
                                : {}),
                            ...(endParam ? { lte: new Date(endParam) } : {}),
                        },
                    }
                    : {}),
            },
            include: {
                videoSegment: {
                    select: {
                        id: true,
                        title: true,
                        thumbnailText: true,
                    },
                },
                socialAccount: {
                    select: {
                        id: true,
                        platform: true,
                        accountName: true,
                    },
                },
            },
            orderBy: {
                scheduledFor: "asc",
            },
        });

        const formattedPosts: CalendarScheduledPostItem[] = scheduledPosts.map(
            (post) => ({
                id: post.id,
                videoSegmentId: post.videoSegmentId,
                segmentTitle: post.videoSegment.title,
                thumbnailText: post.videoSegment.thumbnailText ?? "",
                socialAccountId: post.socialAccountId,
                platform: post.socialAccount.platform,
                accountName: post.socialAccount.accountName,
                caption: post.caption,
                scheduledFor: post.scheduledFor.toISOString(),
                status: post.status,
                publishedUrl: post.publishedUrl ?? null,
            }),
        );

        return NextResponse.json({ posts: formattedPosts }, { status: 200 });
    } catch (error) {
        console.error("Failed to fetch scheduled posts.", error);
        return NextResponse.json(
            { error: "Unable to fetch scheduled posts." },
            { status: 500 },
        );
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

    const parsed = schedulePostRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid schedule payload.",
                issues: parsed.error.flatten(),
            },
            { status: 400 },
        );
    }

    const { segmentId, socialAccountIds, caption, scheduledFor } = parsed.data;
    const scheduledDate = new Date(scheduledFor);

    try {
        const segment = await prisma.videoSegment.findUnique({
            where: { id: segmentId },
            include: {
                video: {
                    select: {
                        userId: true,
                    },
                },
            },
        });

        if (!segment) {
            return NextResponse.json(
                { error: "Video segment was not found." },
                { status: 404 },
            );
        }

        const resolvedAccountIds: string[] = [];
        for (const rawId of socialAccountIds) {
            const resolvedId = await resolveOrCreateAccountId(
                rawId,
                segment.video.userId,
            );
            if (resolvedId && !resolvedAccountIds.includes(resolvedId)) {
                resolvedAccountIds.push(resolvedId);
            }
        }

        if (resolvedAccountIds.length === 0) {
            return NextResponse.json(
                { error: "No valid social accounts were found." },
                { status: 400 },
            );
        }

        const delayMs = Math.max(0, scheduledDate.getTime() - Date.now());
        const createdPosts: CalendarScheduledPostItem[] = [];

        for (const accountId of resolvedAccountIds) {
            const createdRecord = await prisma.scheduledPost.create({
                data: {
                    videoSegmentId: segment.id,
                    socialAccountId: accountId,
                    caption:
                        caption ||
                        segment.socialCaption ||
                        `${segment.title} #shorts`,
                    scheduledFor: scheduledDate,
                    status: "SCHEDULED",
                },
                include: {
                    videoSegment: {
                        select: {
                            id: true,
                            title: true,
                            thumbnailText: true,
                        },
                    },
                    socialAccount: {
                        select: {
                            id: true,
                            platform: true,
                            accountName: true,
                        },
                    },
                },
            });

            const job = await socialPublishingQueue.add(
                PUBLISH_SOCIAL_POST_JOB,
                {
                    scheduledPostId: createdRecord.id,
                },
                {
                    delay: delayMs,
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 10_000,
                    },
                    removeOnComplete: 100,
                },
            );

            if (job.id) {
                await prisma.scheduledPost.update({
                    where: { id: createdRecord.id },
                    data: {
                        bullMqJobId: String(job.id),
                    },
                });
            }

            createdPosts.push({
                id: createdRecord.id,
                videoSegmentId: createdRecord.videoSegmentId,
                segmentTitle: createdRecord.videoSegment.title,
                thumbnailText:
                    createdRecord.videoSegment.thumbnailText ?? "",
                socialAccountId: createdRecord.socialAccountId,
                platform: createdRecord.socialAccount.platform,
                accountName: createdRecord.socialAccount.accountName,
                caption: createdRecord.caption,
                scheduledFor: createdRecord.scheduledFor.toISOString(),
                status: createdRecord.status,
                publishedUrl: createdRecord.publishedUrl ?? null,
            });
        }

        return NextResponse.json({ posts: createdPosts }, { status: 201 });
    } catch (error) {
        console.error("Failed to schedule social posts.", error);
        return NextResponse.json(
            { error: "Unable to schedule social posts." },
            { status: 500 },
        );
    }
}