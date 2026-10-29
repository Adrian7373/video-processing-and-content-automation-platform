import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { Job } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { prisma } from "../../../../../packages/database/index.js";
import { env } from "../../config/env.js";

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
export type CaptionStyleType = "NONE" | "KARAOKE" | "HIGHLIGHT" | "MINIMAL";
export type AspectRatioType = "VERTICAL_9_16" | "SQUARE_1_1" | "LANDSCAPE_16_9";

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
}

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
 * Formats seconds into ASS timestamp format: H:MM:SS.CC (centiseconds)
 */
function formatAssTime(seconds: number): string {
    const clamped = Math.max(0, seconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const secs = Math.floor(clamped % 60);
    const centiseconds = Math.min(99, Math.round((clamped - Math.floor(clamped)) * 100));

    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

/**
 * Escapes characters that have special meaning in ASS dialogue lines
 */
function escapeAssText(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
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
 * Groups clip-relative words into short, readable phrases (3-4 words max)
 */
function chunkWordsIntoPhrases(words: WordTimestamp[], maxWordsPerLine = 4): WordTimestamp[][] {
    const phrases: WordTimestamp[][] = [];
    let current: WordTimestamp[] = [];

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        current.push(word!);

        const nextWord = words[i + 1];
        const endsWithPunctuation = /[.!?,;:]$/.test(word!.word);
        const hasLongPause = nextWord ? nextWord.start - word!.end > 0.55 : false;

        if (current.length >= maxWordsPerLine || endsWithPunctuation || hasLongPause) {
            phrases.push(current);
            current = [];
        }
    }

    if (current.length > 0) {
        phrases.push(current);
    }

    return phrases;
}

/**
 * Builds the complete .ass file string for KARAOKE, HIGHLIGHT, or MINIMAL styles
 */
export function buildAssSubtitleContent(
    words: WordTimestamp[],
    segmentStartTime: number,
    segmentEndTime: number,
    captionStyle: Exclude<CaptionStyleType, "NONE">,
    aspectRatio: AspectRatioType,
): string {
    const segmentDuration = Math.max(0.1, segmentEndTime - segmentStartTime);

    // Filter words inside the segment window and shift timestamps to start at 0
    const relativeWords = words
        .filter((w) => w.end > segmentStartTime && w.start < segmentEndTime)
        .map((w) => {
            const start = Math.max(0, w.start - segmentStartTime);
            const end = Math.min(segmentDuration, Math.max(start + 0.05, w.end - segmentStartTime));
            return { word: w.word.trim(), start, end };
        })
        .filter((w) => w.word.length > 0);

    const resolution =
        aspectRatio === "VERTICAL_9_16"
            ? { width: 1080, height: 1920, fontSize: 72, marginV: 320 }
            : aspectRatio === "SQUARE_1_1"
                ? { width: 1080, height: 1080, fontSize: 60, marginV: 140 }
                : { width: 1920, height: 1080, fontSize: 56, marginV: 90 };

    // ASS colors use &HAABBGGRR (BGR order!):
    // Yellow: &H0000FFFF | White: &H00FFFFFF | Black: &H00000000
    const isMinimal = captionStyle === "MINIMAL";
    const primaryColor = captionStyle === "KARAOKE" ? "&H0000FFFF" : "&H00FFFFFF";
    const secondaryColor = "&H00FFFFFF";
    const outlineWidth = isMinimal ? 3 : 10;

    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resolution.width}
PlayResY: ${resolution.height}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${resolution.fontSize},${primaryColor},${secondaryColor},&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,${outlineWidth},0,2,60,60,${resolution.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    const phrases = chunkWordsIntoPhrases(relativeWords, isMinimal ? 6 : 4);
    const dialogueLines: string[] = [];

    for (const phrase of phrases) {
        if (phrase.length === 0) continue;
        const phraseStart = phrase[0]!.start;
        const phraseEnd = phrase[phrase.length - 1]!.end;

        if (captionStyle === "KARAOKE") {
            let cursor = phraseStart;
            const karaokeTokens = phrase.map((w) => {
                const gapCs = Math.max(0, Math.round((w.start - cursor) * 100));
                const wordDurCs = Math.max(5, Math.round((w.end - w.start) * 100));
                cursor = w.end;
                const prefixGap = gapCs > 0 ? `{\\k${gapCs}}` : "";
                return `${prefixGap}{\\kf${wordDurCs}}${escapeAssText(w.word.toUpperCase())}`;
            });

            dialogueLines.push(
                `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${karaokeTokens.join(" ")}`,
            );
        } else if (captionStyle === "HIGHLIGHT") {
            for (let idx = 0; idx < phrase.length; idx++) {
                const activeWord = phrase[idx];
                const nextWord = phrase[idx + 1];
                const eventStart = activeWord!.start;
                const eventEnd = nextWord ? nextWord.start : phraseEnd;

                const renderedWords = phrase.map((w, wIdx) => {
                    const clean = escapeAssText(w.word.toUpperCase());
                    return wIdx === idx
                        ? `{\\c&H0000FFFF&\\fscx110\\fscy110}${clean}{\\c&H00FFFFFF&\\fscx100\\fscy100}`
                        : clean;
                });

                dialogueLines.push(
                    `Dialogue: 0,${formatAssTime(eventStart)},${formatAssTime(eventEnd)},Default,,0,0,0,,${renderedWords.join(" ")}`,
                );
            }
        } else {
            const text = phrase.map((w) => escapeAssText(w.word)).join(" ");
            dialogueLines.push(
                `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${text}`,
            );
        }
    }

    return `${header}\n${dialogueLines.join("\n")}\n`;
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
    const assContent = buildAssSubtitleContent(
        words,
        segmentStartTime,
        segmentEndTime,
        captionStyle,
        aspectRatio,
    );
    await fs.writeFile(outputAssPath, assContent, "utf8");

    // 3. Burn into video with FFmpeg
    const sanitizedInput = inputClipPath.replace(/\\/g, "/");
    const sanitizedOutput = outputClipPath.replace(/\\/g, "/");
    const escapedAssPath = escapeFfmpegAssPath(outputAssPath);

    await new Promise<void>((resolve, reject) => {
        ffmpeg(sanitizedInput)
            .videoFilters(`ass='${escapedAssPath}'`)
            .outputOptions([
                "-c:v libx264",
                "-preset veryfast",
                "-crf 23",
                "-pix_fmt yuv420p",
                "-c:a copy",
                "-movflags +faststart",
            ])
            .output(sanitizedOutput)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
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
    captionStyle: z.enum(["NONE", "KARAOKE", "HIGHLIGHT", "MINIMAL"]).default("KARAOKE"),
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