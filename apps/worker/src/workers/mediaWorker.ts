import { Worker, type Job } from "bullmq";

import { lowPollingWorkerOptions } from "../config/workerOptions.js";
import { queueNames, jobNames } from "../constants/queues.js";
import {
    processVideo,
    type VideoProcessingJobData,
} from "../processors/media/videoProcessor.js";
import {
    processCaption,
    type CaptionProcessingJobData,
} from "../processors/media/captionProcessor.js";
import {
    processThumbnail,
    type ThumbnailProcessingJobData,
} from "../processors/media/thumbnailProcessor.js";

// 1. Create a union type for all possible job payloads in this queue
export type MediaQueueJobData =
    | VideoProcessingJobData
    | CaptionProcessingJobData
    | ThumbnailProcessingJobData;

let mediaJobLock = Promise.resolve();

// 2. Cast the job to the correct specific type based on job.name
const processMediaJob = async (job: Job<MediaQueueJobData>) => {
    let releaseLock!: () => void;
    const previousJob = mediaJobLock;
    mediaJobLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });

    await previousJob;
    try {
        switch (job.name) {
            case jobNames.processVideo:
                return await processVideo(job as Job<VideoProcessingJobData>);
            case jobNames.createCaption:
                return await processCaption(job as Job<CaptionProcessingJobData>);
            case jobNames.createThumbnail:
                return await processThumbnail(job as Job<ThumbnailProcessingJobData>);
            default:
                throw new Error(`Unsupported media job "${job.name}".`);
        }
    } finally {
        releaseLock();
    }
};

export const mediaWorker = new Worker<MediaQueueJobData, unknown>(
    queueNames.media,
    processMediaJob,
    lowPollingWorkerOptions,
);

export const legacyVideoWorker = new Worker<MediaQueueJobData, unknown>(
    queueNames.legacyVideo,
    processMediaJob,
    lowPollingWorkerOptions,
);

for (const worker of [mediaWorker, legacyVideoWorker]) {
    worker.on("completed", (job) => {
        console.log(`Media job ${job.id} (${job.name}) completed.`);
    });
    worker.on("failed", (job, error) => {
        console.error(
            `Media job ${job?.id ?? "unknown"} (${job?.name ?? "unknown"}) failed.`,
            error.stack ?? error.message,
        );
    });
}