import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { queueNames } from "../constants/queues.js";
import {
    processSocialPublish,
    type SocialPublishingJobData,
} from "../processors/publishing/socialPublishProcessor.js";

export const publishingWorker = new Worker<SocialPublishingJobData>(
    queueNames.socialPublishing,
    async (job) => {
        return processSocialPublish(job);
    },
    {
        connection: redis,
        concurrency: 3,
    },
);

publishingWorker.on("completed", (job) => {
    console.log(
        `Social publishing job ${job.id} (${job.name}) completed successfully.`,
    );
});

publishingWorker.on("failed", (job, error) => {
    console.error(
        `Social publishing job ${job?.id ?? "unknown"} (${job?.name ?? "unknown"}) failed:`,
        error,
    );
});