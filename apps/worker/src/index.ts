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
const PORT = Number(process.env.PORT) || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Worker is alive and listening!");
});


server.listen(PORT, "0.0.0.0", () => {
    console.log(`Health check server listening on 0.0.0.0:${PORT}`);
});