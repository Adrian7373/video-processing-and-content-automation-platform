import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";
import { requeueScheduledPost } from "@/lib/scheduleRetry";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ postId: string }> | { postId: string };
}

export async function POST(_request: Request, context: RouteContext) {
    const { postId } = await Promise.resolve(context.params);

    try {
        const actor = await getOrCreateActor();
        const post = await prisma.scheduledPost.findFirst({
            where: { id: postId, socialAccount: { userId: actor.userId } },
            include: {
                socialAccount: {
                    select: {
                        id: true,
                        platform: true,
                        accountName: true,
                        needsReauth: true,
                    },
                },
                videoSegment: {
                    select: { id: true, title: true, thumbnailText: true },
                },
            },
        });

        if (!post) {
            return NextResponse.json(
                { error: "Scheduled post was not found." },
                { status: 404 },
            );
        }

        if (post.status !== "FAILED") {
            return NextResponse.json(
                { error: "Only failed posts can be retried." },
                { status: 409 },
            );
        }

        if (post.socialAccount.needsReauth) {
            return NextResponse.json(
                {
                    error: `Reconnect ${post.socialAccount.accountName} in Social accounts first. The post will be retried automatically.`,
                },
                { status: 409 },
            );
        }

        await requeueScheduledPost(post);

        return NextResponse.json(
            {
                post: {
                    id: post.id,
                    videoSegmentId: post.videoSegmentId,
                    segmentTitle: post.videoSegment.title,
                    thumbnailText: post.videoSegment.thumbnailText ?? "",
                    socialAccountId: post.socialAccountId,
                    platform: post.socialAccount.platform,
                    accountName: post.socialAccount.accountName,
                    caption: post.caption,
                    scheduledFor: post.scheduledFor.toISOString(),
                    status: "SCHEDULED",
                    publishedUrl: null,
                    errorMessage: null,
                    failureCode: null,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error(`Failed to retry post ${postId}.`, error);
        return NextResponse.json(
            { error: "Unable to retry this post." },
            { status: 500 },
        );
    }
}
