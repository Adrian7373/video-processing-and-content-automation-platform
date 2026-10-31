import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";
import VideosLibrary, { type VideoCard } from "./VideosLibrary";

export const dynamic = "force-dynamic";

const s3Bucket = process.env.S3_BUCKET_NAME;
const s3 = new S3Client({
    ...(process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {}),
});

async function signS3Key(key: string | null | undefined): Promise<string | null> {
    if (!key || !s3Bucket) return null;
    try {
        return await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
            { expiresIn: 3600 },
        );
    } catch {
        return null;
    }
}

// 11 Videos + 1 Upload Card = 12 total tiles (perfect for 2, 3, and 4 column layouts)
const PAGE_SIZE = 11;

export default async function VideosPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const actor = await getOrCreateActor();

    // Await and parse the page parameter (default to page 1)
    const resolvedParams = await searchParams;
    const currentPage = Math.max(1, parseInt(resolvedParams.page || "1", 10));

    // Get total video count for pagination math
    const totalVideos = await prisma.video.count({
        where: { userId: actor.userId },
    });

    const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));
    const validPage = Math.min(currentPage, totalPages);

    // Fetch only the specific page of videos
    const rawVideos = await prisma.video.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
        skip: (validPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
            _count: { select: { segments: true } },
            segments: {
                take: 1,
                orderBy: { startTime: "asc" },
                select: {
                    thumbnailS3Key: true,
                },
            },
        },
    });

    const initialVideos: VideoCard[] = await Promise.all(
        rawVideos.map(async (video) => {
            const firstThumbKey = video.segments[0]?.thumbnailS3Key ?? null;
            const thumbnailUrl = await signS3Key(firstThumbKey);

            return {
                id: video.id,
                title: video.title,
                status: video.status,
                userPrompt: video.userPrompt,
                aspectRatio: video.aspectRatio,
                captionStyle: video.captionStyle,
                errorMessage: video.errorMessage,
                createdAt: video.createdAt,
                thumbnailUrl,
                _count: { segments: video._count.segments },
            };
        }),
    );

    return (
        <VideosLibrary
            initialVideos={initialVideos}
            currentPage={validPage}
            totalPages={totalPages}
        />
    );
}