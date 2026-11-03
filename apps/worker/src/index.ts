import http from "http";
import { Queue } from "bullmq";

import { queueNames } from "./constants/queues.js";

let isShuttingDown = false;
let reconcileInterval: NodeJS.Timeout | undefined;
let closeWorkers: (() => Promise<void>) | undefined;
let disconnectServices: (() => Promise<void>) | undefined;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}; shutting down workers.`);

    if (closeWorkers) await closeWorkers();
    if (reconcileInterval) clearInterval(reconcileInterval);
    if (disconnectServices) await disconnectServices();
};

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

const PORT = Number(process.env.PORT) || 8080;

const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Worker is alive and listening!");
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Health check server listening on 0.0.0.0:${PORT}`);
    void startWorkers();
});

server.on("error", (error) => {
    console.error("Worker health server failed to start.", error);
    process.exitCode = 1;
});

async function startWorkers(): Promise<void> {
    try {
        const [{ redis }, media, publishing, { prisma }, lifecycle] =
            await Promise.all([
                import("./config/redis.js"),
                import("./workers/mediaWorker.js"),
                import("./workers/publishingWorker.js"),
                import("../../../packages/database/index.js"),
                import("../../../packages/database/videoLifecycle.js"),
            ]);
        const activityQueues = [
            new Queue(queueNames.media, { connection: redis }),
            new Queue(queueNames.legacyVideo, { connection: redis }),
            new Queue(queueNames.publishing, { connection: redis }),
        ];

        closeWorkers = async () => {
            await Promise.all([
                media.mediaWorker.close(),
                media.legacyVideoWorker.close(),
                publishing.publishingWorker.close(),
            ]);
        };
        disconnectServices = async () => {
            await Promise.all(activityQueues.map((queue) => queue.close()));
            await prisma.$disconnect();
            await redis.quit();
        };

        const workerPublicUrl = (
            process.env.WORKER_PUBLIC_URL ||
            "https://scroll-maestro-worker.onrender.com"
        ).replace(/\/$/, "");

        // Only consulted for QUEUED videos past the queue timeout, so this adds
        // at most a couple of Redis calls per stale video every 4 minutes.
        const isJobAlive = async (jobId: string): Promise<boolean> => {
            for (const queue of activityQueues.slice(0, 2)) {
                const job = await queue.getJob(jobId);
                if (!job) continue;
                const state = await job.getState();
                return (
                    state === "waiting" ||
                    state === "active" ||
                    state === "delayed" ||
                    state === "prioritized" ||
                    state === "waiting-children"
                );
            }
            return false;
        };

        reconcileInterval = setInterval(() => {
            void lifecycle
                .reconcileStaleVideos(prisma, { isJobAlive })
                .then((count) => {
                    if (count > 0) {
                        console.warn(`Marked ${count} stale video job(s) as failed.`);
                    }
                })
                .catch((error: unknown) => {
                    console.error("Failed to reconcile stale video jobs.", error);
                });

            void Promise.all(
                activityQueues.map((queue) =>
                    queue.getJobCounts("active", "waiting", "delayed"),
                ),
            )
                .then((counts) => {
                    const hasJobs = counts.some(
                        ({ active, waiting, delayed }) =>
                            (active ?? 0) > 0 ||
                            (waiting ?? 0) > 0 ||
                            (delayed ?? 0) > 0,
                    );

                    if (!hasJobs) {
                        return;
                    }

                    return fetch(`${workerPublicUrl}/health`, {
                        method: "GET",
                        headers: {
                            "User-Agent": "ScrollMaestro-KeepAlive/1.0",
                            "Cache-Control": "no-cache",
                        },
                        signal: AbortSignal.timeout(3000),
                    }).catch(() => {
                        // The worker is already processing the jobs; a cold-start timeout is harmless.
                    });
                })
                .catch((error: unknown) => {
                    console.error("Failed to inspect worker queue activity.", error);
                });
        }, 4 * 60_000);
        reconcileInterval.unref();

        console.log(
            "Worker listening on media-processing, video-processing, and publishing queues.",
        );
    } catch (error) {
        console.error("Worker failed to initialize.", error);
        server.close(() => process.exit(1));
    }
}