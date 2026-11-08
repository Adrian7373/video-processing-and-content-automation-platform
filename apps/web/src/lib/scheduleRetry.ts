import { prisma } from "../../../../packages/database/index";
import {
    PUBLISH_SOCIAL_POST_JOB,
    socialPublishingQueue,
    wakeWorker,
} from "@/lib/queues";

export const REAUTH_REQUIRED = "REAUTH_REQUIRED";

/**
 * Puts a FAILED scheduled post back on the publishing queue (same post, no duplicate).
 * Posts whose time has passed run immediately; future ones keep their delay.
 */
export async function requeueScheduledPost(post: {
    id: string;
    scheduledFor: Date;
    bullMqJobId: string | null;
    tiktokPublishType: "DIRECT" | "DRAFT" | null;
}): Promise<void> {
    if (post.bullMqJobId) {
        try {
            const previous = await socialPublishingQueue.getJob(post.bullMqJobId);
            await previous?.remove();
        } catch {
            // A finished/failed job can't always be removed; a fresh job id is used below anyway.
        }
    }

    const job = await socialPublishingQueue.add(
        PUBLISH_SOCIAL_POST_JOB,
        {
            scheduledPostId: post.id,
            tiktokPublishType: post.tiktokPublishType ?? undefined,
        },
        {
            delay: Math.max(0, post.scheduledFor.getTime() - Date.now()),
            attempts: 3,
            backoff: { type: "exponential", delay: 10_000 },
            removeOnComplete: 100,
        },
    );

    await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
            status: "SCHEDULED",
            errorMessage: null,
            failureCode: null,
            bullMqJobId: job.id ? String(job.id) : null,
        },
    });

    await wakeWorker();
}

/**
 * After a social account is reconnected, retries every post that failed only because the
 * old token was expired or revoked.
 */
export async function retryReauthFailedPosts(
    socialAccountId: string,
): Promise<number> {
    const failed = await prisma.scheduledPost.findMany({
        where: {
            socialAccountId,
            status: "FAILED",
            failureCode: REAUTH_REQUIRED,
        },
        select: {
            id: true,
            scheduledFor: true,
            bullMqJobId: true,
            tiktokPublishType: true,
        },
    });

    let retried = 0;
    for (const post of failed) {
        try {
            await requeueScheduledPost(post);
            retried += 1;
        } catch (error) {
            console.error(`Could not retry scheduled post ${post.id}.`, error);
        }
    }
    return retried;
}
