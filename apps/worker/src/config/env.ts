import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    S3_BUCKET_NAME: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
    FFMPEG_PATH: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().min(1),
    TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
    TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
