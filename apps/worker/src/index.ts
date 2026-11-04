import http from "http";

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

        closeWorkers = async () => {
            await Promise.all([
                media.mediaWorker.close(),
                media.legacyVideoWorker.close(),
                publishing.publishingWorker.close(),
            ]);
        };
        disconnectServices = async () => {
            await prisma.$disconnect();
            await redis.quit();
        };

        reconcileInterval = setInterval(() => {
            void lifecycle
                .reconcileStaleVideos(prisma)
                .then((count) => {
                    if (count > 0) {
                        console.warn(`Marked ${count} stale video job(s) as failed.`);
                    }
                })
                .catch((error: unknown) => {
                    console.error("Failed to reconcile stale video jobs.", error);
                });
        }, 60_000);
        reconcileInterval.unref();

        console.log(
            "Worker listening on media-processing, video-processing, and publishing queues.",
        );
    } catch (error) {
        console.error("Worker failed to initialize.", error);
        server.close(() => process.exit(1));
    }
}