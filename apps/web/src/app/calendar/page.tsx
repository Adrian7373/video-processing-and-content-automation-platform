import Link from "next/link";
import { prisma } from "../../../../../packages/database/index";
import { getSignedDownloadUrl } from "@/lib/s3";
import CalendarClient, {
    type CalendarClipItem,
    type CalendarScheduledPostItem,
    type CalendarSocialAccountItem,
} from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
    const [segments, scheduledPosts, socialAccounts] = await Promise.all([
        prisma.videoSegment.findMany({
            where: {
                video: {
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
        <main className="min-h-screen bg-[#0F0F11] text-neutral-100">
            <header className="border-b border-neutral-800 bg-[#161618] px-6 py-4">
                <div className="mx-auto flex max-w-[1600px] items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/videos"
                            className="rounded-lg border border-neutral-700 bg-neutral-800/70 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
                        >
                            ← Back to Library
                        </Link>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                                Distribution Engine
                            </p>
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                Social Content Calendar
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Drag clips onto any day to schedule
                        </span>
                    </div>
                </div>
            </header>

            <CalendarClient
                initialClips={serializedClips}
                initialPosts={serializedPosts}
                initialAccounts={serializedAccounts}
            />
        </main>
    );
}