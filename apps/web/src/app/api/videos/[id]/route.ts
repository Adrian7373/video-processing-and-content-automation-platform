import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
        return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }
    const { id } = parsedParams.data;

    try {
        const actor = await getOrCreateActor();
        // Scoped to the caller: video IDs alone must never grant access to
        // another user's clips or signed download URLs.
        const video = await prisma.video.findFirst({
            where: { id, userId: actor.userId },
            include: {
                segments: {
                    include: {
                        scheduledPosts: {
                            include: {
                                socialAccount: {
                                    select: {
                                        id: true,
                                        platform: true,
                                        accountName: true,
                                        platformAccountId: true,
                                    },
                                },
                            },
                            orderBy: { scheduledFor: "asc" },
                        },
                    },
                },
            },
        });

        if (!video) {
            return NextResponse.json({ error: "Video not found." }, { status: 404 });
        }

        // startTime is stored as a string, so sort numerically here
        // (a DB string sort puts "100.5" before "20").
        const orderedSegments = [...video.segments].sort(
            (a, b) => Number.parseFloat(a.startTime) - Number.parseFloat(b.startTime),
        );

        const segments = await Promise.all(
            orderedSegments.map(async (segment) => {
                const [clipUrl, captionedClipUrl, thumbnailUrl] = await Promise.all([
                    getSignedDownloadUrl(segment.clipS3Key),
                    getSignedDownloadUrl(segment.captionedClipS3Key),
                    getSignedDownloadUrl(segment.thumbnailS3Key),
                ]);
                return { ...segment, clipUrl, captionedClipUrl, thumbnailUrl };
            }),
        );

        return NextResponse.json({ ...video, segments });
    } catch (error) {
        console.error(`Failed to fetch video ${id}.`, error);
        return NextResponse.json(
            { error: "Unable to load video." },
            { status: 503 },
        );
    }
}
