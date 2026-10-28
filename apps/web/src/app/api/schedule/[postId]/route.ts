import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../../packages/database/index";
import {
    PUBLISH_SOCIAL_POST_JOB,
    socialPublishingQueue,
} from "@/lib/queues";

export const dynamic = "force-dynamic";

const reschedulePostSchema = z.object({
    scheduledFor: z
        .string()
        .refine((val) => !Number.isNaN(new Date(val).getTime()), {
            message: "scheduledFor must be a valid ISO date string.",
        })
        .optional(),
    caption: z.string().trim().max(2200).optional(),
});

interface RouteContext {
    params: Promise<{ postId: string }> | { postId: string };
}

async function removeExistingBullMqJob(bullMqJobId: string | null): Promise<void> {
    if (!bullMqJobId) return;
    try {
        const existingJob = await socialPublishingQueue.getJob(bullMqJobId);
        if (existingJob) {
            await existingJob.remove();
        }
    } catch (error) {
        console.warn(
            `Could not remove previous BullMQ job ${bullMqJobId}:`,
            error,
        );
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    const { postId } = await Promise.resolve(context.params);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    const parsed = reschedulePostSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid reschedule payload.",
                issues: parsed.error.flatten(),
            },
            { status: 400 },
        );
    }

    const { scheduledFor, caption } = parsed.data;

    try {
        const existingPost = await prisma.scheduledPost.findUnique({
            where: { id: postId },
        });

        if (!existingPost) {
            return NextResponse.json(
                { error: "Scheduled post was not found." },
                { status: 404 },
            );
        }

        if (
            existingPost.status === "PUBLISHED" ||
            existingPost.status === "PUBLISHING"
        ) {
            return NextResponse.json(
                {
                    error: `Cannot reschedule a post with status ${existingPost.status}.`,
                },
                { status: 409 },
            );
        }

        let newBullMqJobId = existingPost.bullMqJobId;
        const nextScheduledDate = scheduledFor
            ? new Date(scheduledFor)
            : existingPost.scheduledFor;

        if (scheduledFor) {
            await removeExistingBullMqJob(existingPost.bullMqJobId);

            const delayMs = Math.max(
                0,
                nextScheduledDate.getTime() - Date.now(),
            );
            const newJob = await socialPublishingQueue.add(
                PUBLISH_SOCIAL_POST_JOB,
                {
                    scheduledPostId: existingPost.id,
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

            newBullMqJobId = newJob.id ? String(newJob.id) : null;
        }

        const updatedPost = await prisma.scheduledPost.update({
            where: { id: existingPost.id },
            data: {
                scheduledFor: nextScheduledDate,
                ...(caption !== undefined ? { caption } : {}),
                bullMqJobId: newBullMqJobId,
                status: "SCHEDULED",
                errorMessage: null,
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

        return NextResponse.json(
            {
                post: {
                    id: updatedPost.id,
                    videoSegmentId: updatedPost.videoSegmentId,
                    segmentTitle: updatedPost.videoSegment.title,
                    thumbnailText:
                        updatedPost.videoSegment.thumbnailText ?? "",
                    socialAccountId: updatedPost.socialAccountId,
                    platform: updatedPost.socialAccount.platform,
                    accountName: updatedPost.socialAccount.accountName,
                    caption: updatedPost.caption,
                    scheduledFor: updatedPost.scheduledFor.toISOString(),
                    status: updatedPost.status,
                    publishedUrl: updatedPost.publishedUrl ?? null,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error(`Failed to reschedule post ${postId}.`, error);
        return NextResponse.json(
            { error: "Unable to reschedule social post." },
            { status: 500 },
        );
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    const { postId } = await Promise.resolve(context.params);

    try {
        const existingPost = await prisma.scheduledPost.findUnique({
            where: { id: postId },
            select: {
                id: true,
                bullMqJobId: true,
                status: true,
            },
        });

        if (!existingPost) {
            return NextResponse.json(
                { error: "Scheduled post was not found." },
                { status: 404 },
            );
        }

        await removeExistingBullMqJob(existingPost.bullMqJobId);

        await prisma.scheduledPost.update({
            where: { id: existingPost.id },
            data: {
                status: "CANCELLED",
                bullMqJobId: null,
            },
        });

        return NextResponse.json({ cancelled: true }, { status: 200 });
    } catch (error) {
        console.error(`Failed to cancel scheduled post ${postId}.`, error);
        return NextResponse.json(
            { error: "Unable to cancel scheduled post." },
            { status: 500 },
        );
    }
}