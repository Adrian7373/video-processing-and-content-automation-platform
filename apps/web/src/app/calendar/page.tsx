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
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800/90 bg-slate-900/70 px-6 py-4 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1600px] items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/videos"
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                            >
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Library
                        </Link>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-white">
                                Distribution Calendar
                            </h1>
                            <p className="text-xs text-slate-400">
                                Drag ready clips onto any date to queue automated publishing
                            </p>
                        </div>
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