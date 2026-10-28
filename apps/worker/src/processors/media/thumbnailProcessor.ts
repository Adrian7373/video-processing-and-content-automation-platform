import type { Job } from "bullmq";
import { z } from "zod";

export const thumbnailAspectRatioSchema = z.enum([
    "VERTICAL_9_16",
    "SQUARE_1_1",
    "LANDSCAPE_16_9",
]);

export type ThumbnailAspectRatio = z.infer<typeof thumbnailAspectRatioSchema>;

export const thumbnailJobSchema = z.object({
    segmentId: z.string().uuid(),
    videoId: z.string().uuid(),
    userId: z.string().min(1),
    inputClipPath: z.string().min(1),
    outputThumbnailPath: z.string().min(1),
    clipDurationSeconds: z.number().positive(),
    thumbnailText: z.string().nullable().optional(),
    aspectRatio: thumbnailAspectRatioSchema.default("VERTICAL_9_16"),
    timestampSeconds: z.number().nonnegative().optional(),
});

// This is the exact export mediaWorker.ts is looking for
export type ThumbnailProcessingJobData = z.infer<typeof thumbnailJobSchema>;

export async function processThumbnail(job: Job<ThumbnailProcessingJobData>) {
    const payload = thumbnailJobSchema.parse(job.data);
    console.log(`Stub: Processing thumbnail for segment ${payload.segmentId}`);

    return {
        segmentId: payload.segmentId,
        thumbnailPath: payload.outputThumbnailPath,
    };
}

