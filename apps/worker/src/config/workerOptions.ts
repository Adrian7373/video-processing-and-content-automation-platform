import type { WorkerOptions } from "bullmq";

import { redis } from "./redis.js";

/**
 * Shared low-polling settings for every BullMQ worker.
 *
 * Upstash's free tier caps Redis at 500k commands/month, and faster polling
 * has exhausted it in under 8 hours. Do not lower these values (see AGENTS.md §5B).
 */
export const lowPollingWorkerOptions = {
    connection: redis,
    concurrency: 1,
    drainDelay: 60,
    stalledInterval: 300000,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
} satisfies WorkerOptions;
