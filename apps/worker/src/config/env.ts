import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    S3_BUCKET_NAME: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
    FFMPEG_PATH: z.string().min(1).optional(),
    FLASK_API_URL: z.string().url().default("http://127.0.0.1:5001"),
});

const parsedEnv = envSchema.parse(process.env);

if (
    process.env.NODE_ENV === "production" &&
    !process.env.FLASK_API_URL
) {
    throw new Error(
        "FLASK_API_URL must be configured in production. It must be the reachable URL of the transcriber service, not localhost.",
    );
}

export const env = parsedEnv;
