import { prisma } from "../../../../../packages/database/index";
import { getSignedDownloadUrl } from "@/lib/s3";
import { getOrCreateActor } from "@/lib/auth";
import CalendarClient, {
    type CalendarClipItem,
    type CalendarScheduledPostItem,
    type CalendarSocialAccountItem,
} from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
    const actor = await getOrCreateActor();

    const [segments, scheduledPosts, socialAccounts] = await Promise.all([
        prisma.videoSegment.findMany({
            where: {
                video: {
                    userId: actor.userId,
                    status: "COMPLETED",
                },
            },
            include: {
                video: {
                    select: {
                        id: true,
                        title: true,
                        aspectRatio: true,
                        captionStyle: true,
                    },
                },
            },
            orderBy: {
                id: "desc",
            },
        }),
        prisma.scheduledPost.findMany({
            where: {
                socialAccount: {
                    userId: actor.userId,
                },
            },
            include: {
                videoSegment: {
                    select: {
                        id: true,
                        title: true,
                        thumbnailText: true,
                        videoId: true,
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
        }),
        prisma.socialAccount.findMany({
            where: {
                userId: actor.userId,
            },
            orderBy: {
                accountName: "asc",
            },
        }),
    ]);

    const serializedClips: CalendarClipItem[] = await Promise.all(
        segments.map(async (segment) => {
            const activeVideoKey = segment.captionedClipS3Key ?? segment.clipS3Key;
            let previewVideoUrl: string | null = null;
            let thumbnailUrl: string | null = null;

            try {
                if (activeVideoKey) {
                    previewVideoUrl = await getSignedDownloadUrl(activeVideoKey);
                }
                if (segment.thumbnailS3Key) {
                    thumbnailUrl = await getSignedDownloadUrl(segment.thumbnailS3Key);
                }
            } catch {
                // Ignore signing errors so the calendar still renders cleanly
            }

            const startNum = Number.parseFloat(String(segment.startTime)) || 0;
            const endNum = Number.parseFloat(String(segment.endTime)) || 0;

            return {
                id: segment.id,
                videoId: segment.videoId,
                title: segment.title,
                parentVideoTitle: segment.video.title,
                durationSeconds: Math.max(1, Math.round(endNum - startNum)),
                aspectRatio: segment.video.aspectRatio,
                hasBurnedCaptions: Boolean(segment.captionedClipS3Key),
                thumbnailText: segment.thumbnailText ?? "VIRAL CLIP",
                socialCaption: segment.socialCaption ?? "",
                previewVideoUrl,
                thumbnailUrl,
            };
        }),
    );

    const serializedPosts: CalendarScheduledPostItem[] = scheduledPosts.map((post) => ({
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
    }));

    const serializedAccounts: CalendarSocialAccountItem[] = socialAccounts.map((acc) => ({
        id: acc.id,
        platform: acc.platform,
        accountName: acc.accountName,
    }));

    return (
        <main className="bg-[#0A0D14] text-slate-100">
            <CalendarClient
                initialClips={serializedClips}
                initialPosts={serializedPosts}
                initialAccounts={serializedAccounts}
                isAnonymous={actor.isAnonymous}
            />
        </main>
    );
}