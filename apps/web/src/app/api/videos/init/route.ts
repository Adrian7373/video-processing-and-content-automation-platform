import { NextResponse } from "next/server";
import { z } from "zod";
import {
    prisma,
    AspectRatio,
    CaptionStyle,
} from "../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const initializeVideoSchema = z.object({
    filename: z.string().trim().min(1),
    contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
    fileSize: z.number().finite().int().nonnegative(),
    userId: z.string().uuid().optional(),
    userPrompt: z.string().trim().max(1000).optional(),
    aspectRatio: z.nativeEnum(AspectRatio).default("VERTICAL_9_16"),
    captionStyle: z.nativeEnum(CaptionStyle).default("KARAOKE"),
});

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

    const parsedBody = initializeVideoSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            { error: "filename, contentType, and fileSize are required." },
            { status: 400 },
        );
    }

    const { filename, userPrompt, aspectRatio, captionStyle } = parsedBody.data;

    try {
        const actor = await getOrCreateActor();

        if (actor.credits < 1) {
            return NextResponse.json(
                {
                    error: actor.isAnonymous
                        ? "You have used all 3 free trial credits. Sign in or create an account to unlock 10 more credits."
                        : "You have 0 credits remaining.",
                    code: actor.isAnonymous
                        ? "TRIAL_CREDITS_EXHAUSTED"
                        : "INSUFFICIENT_CREDITS",
                    requiresAuth: actor.isAnonymous,
                    creditsRemaining: 0,
                },
                { status: 402 },
            );
        }

        const videoId = crypto.randomUUID();
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const s3Key = `raw-videos/${videoId}-${safeFilename}`;

        await prisma.video.create({
            data: {
                id: videoId,
                userId: actor.userId,
                title: filename,
                s3Key,
                status: "UPLOADING",
                userPrompt: userPrompt || null,
                aspectRatio,
                captionStyle,
            },
        });

        return NextResponse.json(
            {
                videoId,
                s3Key,
                userId: actor.userId,
                creditsRemaining: actor.credits,
                isAnonymous: actor.isAnonymous,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Failed to initialize video upload.", error);
        return NextResponse.json(
            { error: "Unable to initialize video upload." },
            { status: 503 },
        );
    }
}