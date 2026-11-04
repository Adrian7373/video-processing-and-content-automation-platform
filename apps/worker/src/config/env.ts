import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    S3_BUCKET_NAME: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
    FFMPEG_PATH: z.string().min(1).optional(),
    FLASK_API_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.parse(process.env);
const flaskApiUrl =
    parsedEnv.FLASK_API_URL ??
    (process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:5001"
        : undefined);

if (!flaskApiUrl) {
    throw new Error(
        "FLASK_API_URL must be configured outside local development. It must be the reachable URL of the transcriber service, not localhost.",
    );
}

export const env = {
    ...parsedEnv,
    FLASK_API_URL: flaskApiUrl,
};
