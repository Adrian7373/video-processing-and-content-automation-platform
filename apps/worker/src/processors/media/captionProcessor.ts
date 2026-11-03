import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Job } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "../../../../../packages/database/index.js";
import { env } from "../../config/env.js";
import {
    CAPTION_STYLES,
    buildAssSubtitleContent,
    type AspectRatioType,
    type CaptionStyleType,
} from "./captionStyles.js";

export { buildAssSubtitleContent, type AspectRatioType, type CaptionStyleType };

/** Bundled caption fonts (Montserrat, Anton), handed to libass via `fontsdir`. */
const CAPTION_FONTS_DIR = fileURLToPath(new URL("../../../fonts", import.meta.url));

const s3Bucket = env.S3_BUCKET_NAME;
const LOCAL_TMP_DIR = join(process.cwd(), ".tmp");

const s3 = new S3Client({
    ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
    maxAttempts: 5,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 30_000,
        socketTimeout: 10 * 60 * 1000,
    }),
});

async function uploadS3File(
    localPath: string,
    s3Key: string,
    contentType: string,
): Promise<void> {
    if (!s3Bucket) {
        throw new Error("S3_BUCKET_NAME must be configured.");
    }

    const fileStats = await fs.stat(localPath);

    await s3.send(
        new PutObjectCommand({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: createReadStream(localPath),
            ContentLength: fileStats.size,
            ContentType: contentType,
        }),
    );
}

export const wordTimestampSchema = z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
});

export type WordTimestamp = z.infer<typeof wordTimestampSchema>;

export interface GenerateCaptionsOptions {
    inputClipPath: string;
    outputClipPath: string;
    outputAssPath: string;
    outputThumbnailPath?: string;
    words: WordTimestamp[];
    segmentStartTime: number;
    segmentEndTime: number;
    captionStyle: CaptionStyleType;
    aspectRatio: AspectRatioType;
    /** Resolved FFmpeg executable; falls back to FFMPEG_PATH, then "ffmpeg" on PATH. */
    ffmpegPath?: string;
    /** Kill FFmpeg if rendering exceeds this many milliseconds. */
    timeoutMs?: number;
}

const DEFAULT_CAPTION_RENDER_TIMEOUT_MS = 30 * 60 * 1000;

export interface GenerateCaptionsResult {
    captionedClipPath: string | null;
    assFilePath: string | null;
    thumbnailFilePath: string | null;
}

/**
 * Extracts a single high-quality JPEG thumbnail frame from a video clip
 */
export function extractThumbnailFromClip(
    inputPath: string,
    outputPath: string,
    timeOffsetSeconds: number = 1,
): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .seekInput(Math.max(0, timeOffsetSeconds))
            .frames(1)
            .outputOptions(["-q:v", "2"])
            .on("end", () => resolve())
            .on("error", (err) =>
                reject(new Error(`Thumbnail extraction failed: ${err.message}`)),
            )
            .save(outputPath);
    });
}

/**
 * Escapes file paths for FFmpeg's libass filter on Windows & POSIX
 */
function escapeFfmpegAssPath(filePath: string): string {
    return filePath
        .replace(/\\/g, "/")
        .replace(/^([A-Za-z]):/, "$1\\:")
        .replace(/'/g, "'\\\\\\''");
}

/**
 * Generates the .ass file, burns captions into the video clip using FFmpeg,
 * and optionally extracts a thumbnail frame.
 */
export async function generateAndBurnCaptions(
    options: GenerateCaptionsOptions,
): Promise<GenerateCaptionsResult> {
    const {
        inputClipPath,
        outputClipPath,
        outputAssPath,
        outputThumbnailPath,
        words,
        segmentStartTime,
        segmentEndTime,
        captionStyle,
        aspectRatio,
        ffmpegPath,
        timeoutMs = DEFAULT_CAPTION_RENDER_TIMEOUT_MS,
    } = options;

    const duration = Math.max(0.1, segmentEndTime - segmentStartTime);
    const seekTime = Math.min(1.0, duration / 2);

    // 1. Respect "NONE" immediately (still extract thumbnail from inputClipPath if requested)
    if (captionStyle === "NONE" || words.length === 0) {
        let thumbnailFilePath: string | null = null;
        if (outputThumbnailPath) {
            await extractThumbnailFromClip(inputClipPath, outputThumbnailPath, seekTime);
            thumbnailFilePath = outputThumbnailPath;
        }
        return { captionedClipPath: null, assFilePath: null, thumbnailFilePath };
    }

    // 2. Generate .ass subtitle file
    let assContent = buildAssSubtitleContent(
        words,
        segmentStartTime,
        segmentEndTime,
        captionStyle,
        aspectRatio,
    );
    await fs.writeFile(outputAssPath, assContent, "utf8");
    assContent = "";

    // 3. Burn into video with FFmpeg
    const sanitizedInput = inputClipPath.replace(/\\/g, "/");
    const sanitizedOutput = outputClipPath.replace(/\\/g, "/");
    const escapedAssPath = escapeFfmpegAssPath(outputAssPath);
    const fontsOption = existsSync(CAPTION_FONTS_DIR)
        ? `:fontsdir='${escapeFfmpegAssPath(CAPTION_FONTS_DIR)}'`
        : "";
    const aspectRatioFilter =
        aspectRatio === "VERTICAL_9_16"
            ? "crop='min(iw,ih*(9/16))':'min(ih,iw*(16/9))',scale=1080:1920,setsar=1"
            : aspectRatio === "SQUARE_1_1"
                ? "crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080,setsar=1"
                : "crop='min(iw,ih*(16/9))':'min(ih,iw*(9/16))',scale=1920:1080,setsar=1";

    if (global.gc) {
        global.gc();
    }

    await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn(
            ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg",
            [
                "-y",
                "-threads",
                "1",
                "-i",
                sanitizedInput,
                "-vf",
                `${aspectRatioFilter},ass=filename='${escapedAssPath}'${fontsOption}`,
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "21",
                "-pix_fmt",
                "yuv420p",
                // ultrafast turns the deblocking filter off; turning it back on
                // removes most visible blockiness for a small CPU cost.
                "-x264-params",
                "rc-lookahead=5:ref=1:sync-lookahead=0:deblock=1,0,0",
                "-threads",
                "1",
                "-max_muxing_queue_size",
                "400",
                "-c:a",
                "copy",
                "-movflags",
                "+faststart",
                sanitizedOutput,
            ],
            { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
        );
        let stderrTail = "";
        let timedOut = false;
        const killTimer = setTimeout(() => {
            timedOut = true;
            ffmpegProcess.kill("SIGKILL");
        }, timeoutMs);

        ffmpegProcess.stderr.on("data", (chunk: Buffer | string) => {
            stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2048);
        });
        ffmpegProcess.once("error", (error) => {
            clearTimeout(killTimer);
            reject(error);
        });
        ffmpegProcess.once("close", (code, signal) => {
            clearTimeout(killTimer);
            if (timedOut) {
                reject(
                    new Error(
                        `FFmpeg caption rendering timed out after ${Math.round(timeoutMs / 1000)}s.`,
                    ),
                );
                return;
            }
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `FFmpeg caption rendering failed (${signal ?? `exit code ${code}`}): ${stderrTail.trim() || "no diagnostic output"}`,
                ),
            );
        });
    });

    // 4. Extract thumbnail from the captioned video if requested
    let thumbnailFilePath: string | null = null;
    if (outputThumbnailPath) {
        await extractThumbnailFromClip(sanitizedOutput, outputThumbnailPath, seekTime);
        thumbnailFilePath = outputThumbnailPath;
    }

    return {
        captionedClipPath: outputClipPath,
        assFilePath: outputAssPath,
        thumbnailFilePath,
    };
}

export const captionJobSchema = z.object({
    segmentId: z.string().uuid(),
    videoId: z.string().uuid(),
    userId: z.string().min(1),
    inputClipPath: z.string().min(1),
    outputClipPath: z.string().min(1),
    outputAssPath: z.string().min(1),
    outputThumbnailPath: z.string().min(1).optional(),
    words: z.array(wordTimestampSchema),
    segmentStartTime: z.number(),
    segmentEndTime: z.number(),
    captionStyle: z.enum(CAPTION_STYLES).default("KARAOKE"),
    aspectRatio: z.enum(["VERTICAL_9_16", "SQUARE_1_1", "LANDSCAPE_16_9"]).default("VERTICAL_9_16"),
});

export type CaptionProcessingJobData = z.infer<typeof captionJobSchema>;

/**
 * BullMQ Job Processor for standalone `createCaption` jobs routed by mediaWorker
 */
export async function processCaption(job: Job<CaptionProcessingJobData>) {
    const payload = captionJobSchema.parse(job.data);

    await fs.mkdir(LOCAL_TMP_DIR, { recursive: true });
    const thumbnailPath =
        payload.outputThumbnailPath ??
        join(LOCAL_TMP_DIR, `${job.id ?? payload.segmentId}-thumb.jpg`).replace(/\\/g, "/");

    const result = await generateAndBurnCaptions({
        inputClipPath: payload.inputClipPath,
        outputClipPath: payload.outputClipPath,
        outputAssPath: payload.outputAssPath,
        outputThumbnailPath: thumbnailPath,
        words: payload.words,
        segmentStartTime: payload.segmentStartTime,
        segmentEndTime: payload.segmentEndTime,
        captionStyle: payload.captionStyle,
        aspectRatio: payload.aspectRatio,
    });

    let captionedClipS3Key: string | null = null;
    let subtitleS3Key: string | null = null;
    let thumbnailS3Key: string | null = null;

    if (result.captionedClipPath) {
        captionedClipS3Key = `processed-videos/${payload.segmentId}-captioned.mp4`;
        await uploadS3File(result.captionedClipPath, captionedClipS3Key, "video/mp4");
    }

    if (result.assFilePath) {
        subtitleS3Key = `processed-videos/${payload.segmentId}.ass`;
        await uploadS3File(result.assFilePath, subtitleS3Key, "text/plain");
    }

    if (result.thumbnailFilePath) {
        thumbnailS3Key = `processed-thumbnails/${payload.segmentId}.jpg`;
        await uploadS3File(result.thumbnailFilePath, thumbnailS3Key, "image/jpeg");
        await fs.rm(result.thumbnailFilePath, { force: true }).catch(() => undefined);
    }

    await prisma.videoSegment.update({
        where: { id: payload.segmentId },
        data: {
            ...(captionedClipS3Key ? { captionedClipS3Key } : {}),
            ...(subtitleS3Key ? { subtitleS3Key } : {}),
            ...(thumbnailS3Key ? { thumbnailS3Key } : {}),
        },
    });

    return {
        segmentId: payload.segmentId,
        ...result,
        captionedClipS3Key,
        subtitleS3Key,
        thumbnailS3Key,
        skipped: payload.captionStyle === "NONE",
    };
}