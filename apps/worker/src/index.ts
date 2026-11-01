import http from "http";
import { redis } from "./config/redis.js";
import { mediaWorker, legacyVideoWorker } from "./workers/mediaWorker.js";
import { publishingWorker } from "./workers/publishingWorker.js";

let isShuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}; shutting down workers.`);

    await Promise.all([
        mediaWorker.close(),
        legacyVideoWorker.close(),
        publishingWorker.close(),
    ]);
    await redis.quit();
};

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

console.log(
    "Worker listening on media-processing, video-processing, and publishing queues.",
);

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Worker is alive and listening!");
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Dummy HTTP server running on port ${PORT}`);
});