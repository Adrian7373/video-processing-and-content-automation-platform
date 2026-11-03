import {
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UnrecoverableError, type Job } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { createReadStream, existsSync } from "fs";
import { join } from "node:path";
import { platform } from "node:os";
import { execFile, execFileSync, type ExecException } from "node:child_process";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { z } from "zod";
import axios, { isAxiosError } from "axios";
import FormData from "form-data";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../../../../../packages/database/index.js";
import {
    MAX_UPLOAD_DURATION_SECONDS,
    MAX_UPLOAD_FILE_SIZE_BYTES,
} from "../../../../../packages/database/uploadLimits.js";
import {
    failVideoAndRefund,
    heartbeatVideo,
    markVideoCompleted,
    markVideoProcessing,
} from "../../../../../packages/database/videoLifecycle.js";
import { env } from "../../config/env.js";
import { jobNames } from "../../constants/queues.js";

import { generateAndBurnCaptions, wordTimestampSchema } from "./captionProcessor.js";
import { CAPTION_STYLES } from "./captionStyles.js";
import {
    MAX_CLIPS,
    SEGMENTATION_SYSTEM_PROMPT,
    buildFallbackClips,
    buildSegmentationPrompt,
    buildSentenceChunks,
    dropHallucinatedSpeech,
    formatChunksForPrompt,
    geminiClipSchema,
    resolveClips,
    restorePunctuation,
    targetClipCount,
    tidyWordTimings,
    type SelectedClip,
} from "./clipSelection.js";

const s3Bucket = env.S3_BUCKET_NAME;
const LOCAL_TMP_DIR = join(process.cwd(), ".tmp");

/** Groq rejects audio uploads above 25 MB. */
const GROQ_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 2 * 60 * 1000;
const AUDIO_EXTRACTION_TIMEOUT_MS = 20 * 60 * 1000;
const FFMPEG_RENDER_TIMEOUT_SECONDS = 30 * 60;
const STALE_TEMP_FILE_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * FFmpeg reads the source straight from a presigned S3 URL (no full download,
 * which keeps memory and disk low on Render). These flags make that HTTP read
 * survive transient connection resets instead of failing the whole job.
 * `-reconnect_on_network_error` is deliberately omitted: on DNS/connect
 * failures it makes ffprobe retry indefinitely instead of failing fast.
 */
const HTTP_INPUT_OPTIONS = [
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "10",
    "-rw_timeout",
    "60000000",
];

const s3 = new S3Client({
    ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
    maxAttempts: 5,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 30_000,
        socketTimeout: 10 * 60 * 1000,
    }),
});

const videoProcessingJobSchema = z.object({
    videoId: z.string().uuid(),
    s3Key: z.string(),
    userId: z.string().min(1),
    userPrompt: z.string().trim().max(1000).optional().nullable(),
    processingMode: z.enum(["CLIP", "CAPTION_ONLY"]).default("CLIP"),
    aspectRatio: z
        .enum(["VERTICAL_9_16", "LANDSCAPE_16_9", "SQUARE_1_1"])
        .default("VERTICAL_9_16"),
    captionStyle: z
        .enum(CAPTION_STYLES)
        .default("KARAOKE"),
});

export type VideoProcessingJobData = z.infer<typeof videoProcessingJobSchema>;

const transcriptSegmentSchema = z
    .object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        words: z.array(wordTimestampSchema).nullable().optional(),
        no_speech_prob: z.number().optional(),
        avg_logprob: z.number().optional(),
        compression_ratio: z.number().optional(),
    })
    .passthrough();

const transcriptResponseSchema = z
    .object({
        segments: z.array(transcriptSegmentSchema).nullable().optional(),
        language: z.string().optional(),
        words: z.array(wordTimestampSchema).nullable().optional(),
    })
    .passthrough();

type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
type TranscriptWord = z.infer<typeof wordTimestampSchema>;

class VideoNoLongerClaimableError extends UnrecoverableError {
    constructor(videoId: string) {
        super(
            `Video "${videoId}" is no longer owned by this job (it was retried, failed, or deleted); discarding results.`,
        );
        this.name = "VideoNoLongerClaimableError";
    }
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
    label: string,
    fn: (attempt: number) => Promise<T>,
    options: {
        attempts: number;
        baseDelayMs: number;
        isRetryable?: (error: unknown) => boolean;
        retryAfterMs?: (error: unknown) => number | undefined;
    },
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= options.attempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;
            const retryable =
                !(error instanceof UnrecoverableError) &&
                (options.isRetryable?.(error) ?? true);
            if (!retryable || attempt === options.attempts) break;

            const delay =
                options.retryAfterMs?.(error) ??
                options.baseDelayMs * 2 ** (attempt - 1) +
                    Math.floor(Math.random() * 500);
            console.warn(
                `[${label}] attempt ${attempt}/${options.attempts} failed; retrying in ${delay}ms.`,
                error instanceof Error ? error.message : error,
            );
            await sleep(delay);
        }
    }
    throw lastError;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

async function cleanupStaleTempFiles(): Promise<void> {
    try {
        const entries = await readdir(LOCAL_TMP_DIR);
        const cutoff = Date.now() - STALE_TEMP_FILE_AGE_MS;
        await Promise.all(
            entries.map(async (entry) => {
                const filePath = join(LOCAL_TMP_DIR, entry);
                const info = await stat(filePath).catch(() => null);
                if (info?.isFile() && info.mtimeMs < cutoff) {
                    await unlink(filePath).catch(() => {});
                }
            }),
        );
    } catch {
        // Directory does not exist yet.
    }
}

// ---------------------------------------------------------------------------
// Transcript normalisation
// ---------------------------------------------------------------------------

function cleanText(text: string): string {
    return text.replace(/\\[Nn]|[\r\n]+/g, " ").trim();
}

function normalizeTranscriptWords(words: TranscriptWord[]): TranscriptWord[] {
    return words
        .filter(
            (word) =>
                Number.isFinite(word.start) &&
                Number.isFinite(word.end) &&
                word.end > word.start &&
                word.word.trim().length > 0,
        )
        .map((word) => ({ ...word, word: cleanText(word.word) }))
        .sort((a, b) => a.start - b.start || a.end - b.end)
        .filter(
            (word, index, sorted) =>
                index === 0 ||
                word.start !== sorted[index - 1]!.start ||
                word.end !== sorted[index - 1]!.end ||
                word.word !== sorted[index - 1]!.word,
        );
}

function getTranscriptWords(
    transcriptData: z.infer<typeof transcriptResponseSchema>,
): TranscriptWord[] {
    if (transcriptData.words && transcriptData.words.length > 0) {
        return normalizeTranscriptWords(transcriptData.words);
    }
    return normalizeTranscriptWords(
        (transcriptData.segments ?? []).flatMap((segment) => segment.words ?? []),
    );
}

function getTranscriptSegments(
    transcriptData: z.infer<typeof transcriptResponseSchema>,
    words: TranscriptWord[],
): TranscriptSegment[] {
    if (transcriptData.segments && transcriptData.segments.length > 0) {
        return [...transcriptData.segments]
            .filter(
                (segment) =>
                    Number.isFinite(segment.start) &&
                    Number.isFinite(segment.end) &&
                    segment.end > segment.start,
            )
            .map((segment) => ({ ...segment, text: cleanText(segment.text) }))
            .filter((segment) => segment.text.length > 0)
            .sort((a, b) => a.start - b.start || a.end - b.end)
            .filter(
                (segment, index, sorted) =>
                    index === 0 ||
                    segment.start !== sorted[index - 1]!.start ||
                    segment.end !== sorted[index - 1]!.end ||
                    segment.text !== sorted[index - 1]!.text,
            );
    }

    if (words.length === 0) return [];

    return [
        {
            start: words[0]!.start,
            end: words[words.length - 1]!.end,
            text: words.map((word) => word.word).join(" "),
        },
    ];
}

// ---------------------------------------------------------------------------
// Segment selection (logic lives in clipSelection.ts)
// ---------------------------------------------------------------------------

/**
 * Gemini sees one numbered sentence per line (index, start-end, text) and
 * answers with chunk ranges, so clip boundaries always land on sentence
 * boundaries and never on invented timestamps.
 */
async function selectClipSegments(params: {
    words: TranscriptWord[];
    segments: TranscriptSegment[];
    sourceDuration: number;
    userPrompt: string | null | undefined;
    videoTitle: string;
    language: string | undefined;
}): Promise<SelectedClip[]> {
    const chunks = buildSentenceChunks(params.words, params.segments);
    const maxClips = Math.min(MAX_CLIPS, targetClipCount(params.sourceDuration).max);
    const prompt = buildSegmentationPrompt({
        chunksText: formatChunksForPrompt(chunks),
        sourceDuration: params.sourceDuration,
        language: params.language,
        userPrompt: params.userPrompt,
    });

    try {
        return await withRetry(
            "Gemini",
            async () => {
                const { object } = await generateObject({
                    model: google("gemini-3.5-flash-lite"),
                    schema: geminiClipSchema,
                    system: SEGMENTATION_SYSTEM_PROMPT,
                    prompt,
                    abortSignal: AbortSignal.timeout(3 * 60 * 1000),
                });
                const clips = resolveClips({
                    clips: object.clips,
                    chunks,
                    words: params.words,
                    sourceDuration: params.sourceDuration,
                    maxClips,
                    fallbackTitle: params.videoTitle,
                });
                if (clips.length === 0) {
                    throw new Error("Gemini returned no clips with usable chunk ranges.");
                }
                return clips;
            },
            { attempts: 3, baseDelayMs: 3000 },
        );
    } catch (error) {
        console.error(
            "Gemini highlight selection failed after retries; using transcript-based fallback clips.",
            error,
        );
        const fallback = buildFallbackClips({
            chunks,
            words: params.words,
            sourceDuration: params.sourceDuration,
            videoTitle: params.videoTitle,
        });
        if (fallback.length === 0) {
            throw new UnrecoverableError(
                "Could not find any usable clip in this video. Try Caption-only mode.",
            );
        }
        return fallback;
    }
}

// ---------------------------------------------------------------------------
// FFmpeg
// ---------------------------------------------------------------------------

let ffmpegExecutablePath: string | undefined;
let ffprobeExecutablePath: string | undefined;

function findOnPath(binary: string): string | undefined {
    try {
        const command = platform() === "win32" ? "where.exe" : "which";
        return execFileSync(command, [binary], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })
            .trim()
            .split(/\r?\n/)[0];
    } catch {
        return undefined;
    }
}

function configureFfmpeg(): void {
    const configuredPath = env.FFMPEG_PATH;
    const standardPaths =
        platform() === "win32"
            ? [
                "C:\\ffmpeg\\bin\\ffmpeg.exe",
                "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
                "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
            ]
            : ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];

    if (configuredPath && !existsSync(configuredPath)) {
        throw new Error(`FFMPEG_PATH does not exist: "${configuredPath}".`);
    }

    const resolvedPath =
        configuredPath ??
        standardPaths.find((candidate) => existsSync(candidate)) ??
        findOnPath("ffmpeg");
    if (!resolvedPath) {
        throw new Error(
            "FFmpeg is required but was not found. Install FFmpeg or set FFMPEG_PATH to the executable path.",
        );
    }

    // Prefer the ffprobe that ships next to the resolved ffmpeg binary.
    const siblingProbe = resolvedPath.replace(
        /ffmpeg(\.exe)?$/i,
        (_match, ext: string | undefined) => `ffprobe${ext ?? ""}`,
    );
    const resolvedProbe =
        siblingProbe !== resolvedPath && existsSync(siblingProbe)
            ? siblingProbe
            : findOnPath("ffprobe");
    if (!resolvedProbe) {
        throw new Error(
            "ffprobe is required to verify that the source video contains audio.",
        );
    }

    ffmpeg.setFfmpegPath(resolvedPath);
    ffmpeg.setFfprobePath(resolvedProbe);
    ffmpegExecutablePath = resolvedPath;
    ffprobeExecutablePath = resolvedProbe;
}

configureFfmpeg();

function runExecFile(
    executable: string,
    args: string[],
    timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(
            executable,
            args,
            { windowsHide: true, timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 4 * 1024 * 1024 },
            (error: ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    const reason = error.killed
                        ? `timed out after ${Math.round(timeoutMs / 1000)}s`
                        : stderr.trim().slice(-2000) || error.message;
                    reject(new Error(reason));
                    return;
                }
                resolve({ stdout, stderr });
            },
        );
    });
}

async function getS3SourceMetadata(s3Key: string): Promise<void> {
    if (!s3Bucket) {
        throw new UnrecoverableError("S3_BUCKET_NAME must be configured.");
    }

    try {
        const metadata = await s3.send(
            new HeadObjectCommand({ Bucket: s3Bucket, Key: s3Key }),
        );
        if (
            metadata.ContentLength !== undefined &&
            metadata.ContentLength > MAX_UPLOAD_FILE_SIZE_BYTES
        ) {
            throw new UnrecoverableError("Video files must not exceed 300 MB.");
        }
        if (metadata.ContentLength === 0) {
            throw new UnrecoverableError("The uploaded video file is empty.");
        }
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
            ?.$metadata?.httpStatusCode;
        if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
            throw new UnrecoverableError(
                "The uploaded video could not be found in storage. Please upload it again.",
            );
        }
        throw error;
    }
}

/** A fresh presigned URL per FFmpeg invocation, so long jobs never hit URL expiry. */
function getSourceUrl(s3Key: string): Promise<string> {
    if (!s3Bucket) {
        throw new UnrecoverableError("S3_BUCKET_NAME must be configured.");
    }
    return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }),
        { expiresIn: 7200 },
    );
}

/** Returns the container duration, or undefined when the container does not store one (e.g. MediaRecorder WebM). */
async function probeVideoDuration(sourceUrl: string): Promise<number | undefined> {
    const { stdout } = await runExecFile(
        ffprobeExecutablePath!,
        [
            ...HTTP_INPUT_OPTIONS,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            sourceUrl,
        ],
        PROBE_TIMEOUT_MS,
    ).catch((error: Error) => {
        throw new Error(`Unable to inspect video: ${error.message}`);
    });

    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

async function extractAudio(sourceUrl: string, audioPath: string): Promise<void> {
    console.log("Extracting audio...");
    const { stdout } = await runExecFile(
        ffprobeExecutablePath!,
        [
            ...HTTP_INPUT_OPTIONS,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=index",
            "-of",
            "json",
            sourceUrl,
        ],
        PROBE_TIMEOUT_MS,
    ).catch((error: Error) => {
        throw new Error(`Unable to inspect audio streams: ${error.message}`);
    });

    let hasAudioStream: boolean;
    try {
        const probeResult = JSON.parse(stdout) as { streams?: unknown[] };
        hasAudioStream = (probeResult.streams?.length ?? 0) > 0;
    } catch {
        throw new Error("ffprobe returned invalid stream metadata.");
    }

    if (!hasAudioStream) {
        throw new UnrecoverableError(
            "This video has no audio track, so it cannot be transcribed. Upload a video with sound.",
        );
    }

    await runExecFile(
        ffmpegExecutablePath!,
        [
            "-y",
            ...HTTP_INPUT_OPTIONS,
            "-i",
            sourceUrl,
            "-map",
            "0:a:0",
            "-vn",
            // Whisper works on 16 kHz mono, so spend the whole 64 kbps on one
            // clean channel instead of splitting it across stereo.
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "64k",
            "-f",
            "mp3",
            audioPath,
        ],
        AUDIO_EXTRACTION_TIMEOUT_MS,
    ).catch((error: Error) => {
        throw new Error(`FFmpeg audio extraction failed: ${error.message}`);
    });
}

function getAspectRatioFilter(aspectRatio: VideoProcessingJobData["aspectRatio"]): string {
    switch (aspectRatio) {
        case "VERTICAL_9_16":
            return "crop='min(iw,ih*(9/16))':'min(ih,iw*(16/9))',scale=1080:1920:flags=lanczos,setsar=1";
        case "SQUARE_1_1":
            return "crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080:flags=lanczos,setsar=1";
        case "LANDSCAPE_16_9":
            return "crop='min(iw,ih*(16/9))':'min(ih,iw*(9/16))',scale=1920:1080:flags=lanczos,setsar=1";
    }
}

function sliceVideo(
    sourceUrl: string,
    outputPath: string,
    startTime: number,
    duration: number,
    aspectRatio: VideoProcessingJobData["aspectRatio"],
): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(sourceUrl, { timeout: FFMPEG_RENDER_TIMEOUT_SECONDS })
            .inputOptions([...HTTP_INPUT_OPTIONS, "-threads", "1"])
            .setStartTime(startTime)
            .setDuration(duration)
            .outputOptions([
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-vf",
                getAspectRatioFilter(aspectRatio),
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                // CRF 20: this file is also the source of the captioned
                // render, so it must survive a second encode cleanly.
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-threads",
                "1",
                // ultrafast disables deblocking; re-enabling it is cheap and
                // removes most visible blockiness.
                "-x264-params",
                "rc-lookahead=5:ref=1:sync-lookahead=0:deblock=1,0,0",
                "-max_muxing_queue_size",
                "1024",
                // Platforms play shorts at about -14 LUFS; normalising here
                // keeps quiet recordings from sounding weak next to others.
                "-af",
                "loudnorm=I=-14:TP=-1.5:LRA=11",
                "-ar",
                "48000",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-ac",
                "2",
                "-movflags",
                "+faststart",
            ])
            .on("end", () => resolve())
            .on("error", (error: Error, _stdout?: string | null, stderr?: string | null) =>
                reject(
                    new Error(
                        `FFmpeg clip render failed: ${error.message}${stderr ? ` | ${stderr.trim().slice(-1000)}` : ""}`,
                    ),
                ),
            )
            .save(outputPath);
    });
}

function extractThumbnail(
    inputPath: string,
    outputPath: string,
    timeOffsetSeconds: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath, { timeout: 120 })
            .seekInput(Math.max(0, timeOffsetSeconds))
            // Pick the most representative of the next ~2 s of frames instead
            // of whatever frame lands on the offset (often a blink or blur).
            .videoFilters("thumbnail=48")
            .frames(1)
            .outputOptions(["-q:v", "2"])
            .on("end", () => resolve())
            .on("error", (err: Error) =>
                reject(new Error(`Thumbnail extraction failed: ${err.message}`)),
            )
            .save(outputPath);
    });
}

async function assertNonEmptyFile(filePath: string, label: string): Promise<void> {
    const info = await stat(filePath).catch(() => null);
    if (!info || info.size === 0) {
        throw new Error(`${label} produced an empty file.`);
    }
}

async function uploadS3File(
    localPath: string,
    s3Key: string,
    contentType: string,
): Promise<void> {
    if (!s3Bucket) {
        throw new UnrecoverableError("S3_BUCKET_NAME must be configured.");
    }

    const fileStats = await stat(localPath);
    // A fresh stream per attempt: a consumed stream cannot be resent.
    await withRetry(
        "S3 upload",
        () =>
            s3.send(
                new PutObjectCommand({
                    Bucket: s3Bucket,
                    Key: s3Key,
                    Body: createReadStream(localPath),
                    ContentLength: fileStats.size,
                    ContentType: contentType,
                }),
            ),
        { attempts: 3, baseDelayMs: 2000 },
    );
    await unlink(localPath).catch(() => {});
}

// ---------------------------------------------------------------------------
// Transcription (Groq Whisper)
// ---------------------------------------------------------------------------

function isRetryableHttpError(error: unknown): boolean {
    if (!isAxiosError(error)) return true;
    const status = error.response?.status;
    if (status === undefined) return true; // network error / timeout
    return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryAfterMs(error: unknown): number | undefined {
    if (!isAxiosError(error)) return undefined;
    const header = error.response?.headers?.["retry-after"];
    const seconds = Number.parseFloat(String(header ?? ""));
    return Number.isFinite(seconds) && seconds > 0
        ? Math.min(seconds * 1000, 60_000)
        : undefined;
}

async function transcribeAudio(audioPath: string) {
    const audioStats = await stat(audioPath);
    if (audioStats.size === 0) {
        throw new UnrecoverableError("The video's audio track is empty.");
    }
    if (audioStats.size > GROQ_MAX_AUDIO_BYTES) {
        throw new UnrecoverableError(
            "The video's audio is too long to transcribe. Videos must not exceed 45 minutes.",
        );
    }

    console.log("Sending audio to Groq for transcription...");
    try {
        const response = await withRetry(
            "Groq",
            async () => {
                const formData = new FormData();
                formData.append("file", createReadStream(audioPath), {
                    filename: "audio.mp3",
                    contentType: "audio/mpeg",
                    knownLength: audioStats.size,
                });
                formData.append("model", "whisper-large-v3-turbo");
                formData.append("response_format", "verbose_json");
                formData.append("temperature", "0");
                formData.append("timestamp_granularities[]", "word");
                formData.append("timestamp_granularities[]", "segment");

                return axios.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            "Content-Length": formData.getLengthSync(),
                            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout: 5 * 60 * 1000,
                    },
                );
            },
            {
                attempts: 4,
                baseDelayMs: 4000,
                isRetryable: isRetryableHttpError,
                retryAfterMs,
            },
        );

        const parsed = transcriptResponseSchema.safeParse(response.data);
        if (!parsed.success) {
            throw new Error(
                `Groq returned an unexpected transcription payload: ${parsed.error.message}`,
            );
        }
        return parsed.data;
    } catch (error) {
        if (isAxiosError(error) && error.response && !isRetryableHttpError(error)) {
            const detail = JSON.stringify(error.response.data ?? "").slice(0, 500);
            throw new UnrecoverableError(
                `Transcription was rejected (HTTP ${error.response.status}): ${detail}`,
            );
        }
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

type SegmentRow = {
    videoId: string;
    clipS3Key: string;
    captionedClipS3Key: string | null;
    subtitleS3Key: string | null;
    thumbnailS3Key: string | null;
    startTime: string;
    endTime: string;
    title: string;
    keyPoints: string[];
    thumbnailText: string;
    socialCaption: string;
};

void cleanupStaleTempFiles();

export async function processVideo(
    job: Job<VideoProcessingJobData>,
): Promise<{ status: "completed" | "skipped" }> {
    if (job.name !== jobNames.processVideo) {
        throw new UnrecoverableError(
            `Unsupported job "${job.name}" received by the media worker.`,
        );
    }
    if (!job.id) {
        throw new UnrecoverableError("Video-processing jobs must have a job ID.");
    }

    const parsedJob = videoProcessingJobSchema.safeParse(job.data);
    if (!parsedJob.success) {
        throw new UnrecoverableError(
            `Invalid video-processing payload: ${parsedJob.error.message}`,
        );
    }
    const jobData = parsedJob.data;
    const jobId = String(job.id);

    await mkdir(LOCAL_TMP_DIR, { recursive: true });
    const audioPath = join(LOCAL_TMP_DIR, `${jobId}.mp3`).replace(/\\/g, "/");
    const temporaryFilesToCleanup: string[] = [audioPath];
    let heartbeatTimer: NodeJS.Timeout | undefined;

    try {
        const parentVideo = await prisma.video.findUnique({
            where: { id: jobData.videoId },
            select: {
                userPrompt: true,
                aspectRatio: true,
                captionStyle: true,
                title: true,
            },
        });
        if (!parentVideo) {
            console.warn(`Video ${jobData.videoId} no longer exists; skipping job ${jobId}.`);
            return { status: "skipped" };
        }

        const claimed = await markVideoProcessing(prisma, jobData.videoId, jobId);
        if (!claimed) {
            console.warn(
                `Video ${jobData.videoId} is not claimable by job ${jobId} (already finished, failed, or re-queued); skipping.`,
            );
            return { status: "skipped" };
        }

        // Keep the heartbeat alive for the whole job. The reconciler marks a
        // PROCESSING video as failed (and refunds it) when heartbeats stop, so
        // stopping it during rendering made long videos fail while still rendering.
        heartbeatTimer = setInterval(() => {
            void heartbeatVideo(prisma, jobData.videoId, jobId).catch(
                (heartbeatError: unknown) => {
                    console.error(
                        `Failed to update heartbeat for video ${jobData.videoId}.`,
                        heartbeatError,
                    );
                },
            );
        }, HEARTBEAT_INTERVAL_MS);
        heartbeatTimer.unref();

        const rawJobData = job.data as Record<string, unknown>;
        const rawPrompt = jobData.userPrompt ?? parentVideo.userPrompt;
        const isCaptionOnly =
            jobData.processingMode === "CAPTION_ONLY" ||
            rawPrompt?.trim() === "[CAPTION_ONLY]";
        const processingMode = isCaptionOnly ? "CAPTION_ONLY" : "CLIP";
        const userPrompt = isCaptionOnly ? "" : rawPrompt;
        const aspectRatio =
            typeof rawJobData.aspectRatio === "string"
                ? jobData.aspectRatio
                : parentVideo.aspectRatio;
        const captionStyle =
            typeof rawJobData.captionStyle === "string"
                ? jobData.captionStyle
                : parentVideo.captionStyle;
        const videoTitle = parentVideo.title?.trim() || "Video";

        console.log(
            `Starting job ${jobId} (attempt ${job.attemptsMade + 1}) | Mode: ${processingMode}`,
        );

        await getS3SourceMetadata(jobData.s3Key);

        const probedDuration = await withRetry(
            "ffprobe",
            async () => probeVideoDuration(await getSourceUrl(jobData.s3Key)),
            { attempts: 3, baseDelayMs: 2000 },
        );
        if (probedDuration !== undefined && probedDuration > MAX_UPLOAD_DURATION_SECONDS + 1) {
            throw new UnrecoverableError("Videos must not exceed 45 minutes.");
        }

        await withRetry(
            "Audio extraction",
            async () => extractAudio(await getSourceUrl(jobData.s3Key), audioPath),
            { attempts: 3, baseDelayMs: 2000 },
        );

        const transcriptData = await transcribeAudio(audioPath);
        await unlink(audioPath).catch(() => {});

        const rawWords = getTranscriptWords(transcriptData);
        const cleaned = dropHallucinatedSpeech(
            getTranscriptSegments(transcriptData, rawWords),
            rawWords,
        );
        if (cleaned.droppedSegments > 0) {
            console.log(`Dropped ${cleaned.droppedSegments} transcript segment(s) that look like Whisper hallucinations.`);
        }
        const transcriptSegments = cleaned.segments;
        // Punctuated, de-stretched words: better caption phrasing and sentence-level clip boundaries.
        const transcriptWords = tidyWordTimings(restorePunctuation(cleaned.words, transcriptSegments));
        const lastSpokenSecond = Math.max(
            transcriptWords[transcriptWords.length - 1]?.end ?? 0,
            transcriptSegments[transcriptSegments.length - 1]?.end ?? 0,
        );
        // MediaRecorder WebM files often carry no container duration; fall back to the transcript.
        const sourceDuration = probedDuration ?? (lastSpokenSecond > 0 ? lastSpokenSecond + 1 : 0);
        if (sourceDuration <= 0) {
            throw new UnrecoverableError(
                "Could not determine the video's length. Try re-exporting it as MP4.",
            );
        }
        if (global.gc) global.gc();

        let structuredSegments: SelectedClip[];

        if (processingMode === "CAPTION_ONLY") {
            console.log("CAPTION_ONLY Mode selected. Bypassing Gemini generation.");
            structuredSegments = [
                {
                    segment_title: videoTitle,
                    thumbnail_text: "FULL VIDEO",
                    start_time: 0,
                    end_time: sourceDuration,
                    key_points: ["Full video processed for captions"],
                    social_caption: `Here is the full captioned video for ${videoTitle} #captions`,
                },
            ];
        } else {
            if (transcriptSegments.length === 0) {
                throw new UnrecoverableError(
                    "No speech was detected in this video, so no clips could be selected. Try Caption-only mode.",
                );
            }
            console.log("CLIP Mode selected. Asking Gemini to extract highlights...");
            structuredSegments = await selectClipSegments({
                words: transcriptWords,
                segments: transcriptSegments,
                sourceDuration,
                userPrompt,
                videoTitle,
                language: transcriptData.language,
            });
        }
        if (global.gc) global.gc();

        const segmentRows: SegmentRow[] = [];

        for (const [index, segment] of structuredSegments.entries()) {
            const duration = segment.end_time - segment.start_time;
            if (duration <= 0) continue;

            const basePath = join(LOCAL_TMP_DIR, `${jobId}-segment-${index}`).replace(/\\/g, "/");
            const rawClipPath = `${basePath}.mp4`;
            const thumbnailPath = `${basePath}-thumb.jpg`;
            const assPath = `${basePath}.ass`;
            const captionedPath = `${basePath}-captioned.mp4`;
            temporaryFilesToCleanup.push(rawClipPath, thumbnailPath, assPath, captionedPath);

            if (global.gc) global.gc();

            await withRetry(
                `Clip ${index + 1} render`,
                async () => {
                    await sliceVideo(
                        await getSourceUrl(jobData.s3Key),
                        rawClipPath,
                        segment.start_time,
                        duration,
                        aspectRatio,
                    );
                    await assertNonEmptyFile(rawClipPath, `Clip ${index + 1} render`);
                },
                { attempts: 2, baseDelayMs: 3000 },
            );
            await heartbeatVideo(prisma, jobData.videoId, jobId).catch(() => {});

            const rawClipS3Key = `processed-videos/${jobId}-segment-${index}.mp4`;
            let thumbnailS3Key: string | null = `processed-thumbnails/${jobId}-segment-${index}.jpg`;
            let captionedClipS3Key: string | null = null;
            let subtitleS3Key: string | null = null;

            // Thumbnails are cosmetic: never fail the whole video because of one.
            try {
                await extractThumbnail(rawClipPath, thumbnailPath, Math.min(1.0, duration / 2));
                await assertNonEmptyFile(thumbnailPath, "Thumbnail extraction");
            } catch (thumbnailError) {
                console.warn(`Thumbnail for clip ${index + 1} failed; continuing without it.`, thumbnailError);
                thumbnailS3Key = null;
            }

            const clipHasWords = transcriptWords.some(
                (word) => word.end > segment.start_time && word.start < segment.end_time,
            );
            if (captionStyle !== "NONE" && clipHasWords) {
                try {
                    const captionResult = await generateAndBurnCaptions({
                        inputClipPath: rawClipPath,
                        outputClipPath: captionedPath,
                        outputAssPath: assPath,
                        words: transcriptWords,
                        segmentStartTime: segment.start_time,
                        segmentEndTime: segment.end_time,
                        captionStyle,
                        aspectRatio,
                        ...(ffmpegExecutablePath ? { ffmpegPath: ffmpegExecutablePath } : {}),
                    });

                    if (captionResult.captionedClipPath) {
                        await assertNonEmptyFile(captionedPath, "Caption render");
                        const captionedKey = `processed-videos/${jobId}-segment-${index}-captioned.mp4`;
                        const subtitleKey = `processed-videos/${jobId}-segment-${index}.ass`;
                        await uploadS3File(captionedPath, captionedKey, "video/mp4");
                        await uploadS3File(assPath, subtitleKey, "text/plain");
                        captionedClipS3Key = captionedKey;
                        subtitleS3Key = subtitleKey;
                    }
                } catch (captionError) {
                    // Deliver the clean clip rather than failing the whole video.
                    console.error(
                        `Caption burn for clip ${index + 1} failed; delivering the uncaptioned clip.`,
                        captionError,
                    );
                }
                await heartbeatVideo(prisma, jobData.videoId, jobId).catch(() => {});
            }

            await uploadS3File(rawClipPath, rawClipS3Key, "video/mp4");
            if (thumbnailS3Key) {
                try {
                    await uploadS3File(thumbnailPath, thumbnailS3Key, "image/jpeg");
                } catch (thumbnailUploadError) {
                    console.warn(`Thumbnail upload for clip ${index + 1} failed.`, thumbnailUploadError);
                    thumbnailS3Key = null;
                }
            }

            segmentRows.push({
                videoId: jobData.videoId,
                clipS3Key: rawClipS3Key,
                captionedClipS3Key,
                subtitleS3Key,
                thumbnailS3Key,
                startTime: String(round2(segment.start_time)),
                endTime: String(round2(segment.end_time)),
                title: segment.segment_title,
                keyPoints: segment.key_points,
                thumbnailText: segment.thumbnail_text,
                socialCaption: segment.social_caption,
            });
        }

        if (segmentRows.length === 0) {
            throw new UnrecoverableError("No clips could be produced from this video.");
        }

        await prisma.$transaction(async (transaction) => {
            // Idempotent on retries / reprocessing: never leave duplicate segments.
            await transaction.videoSegment.deleteMany({
                where: { videoId: jobData.videoId },
            });
            await transaction.videoSegment.createMany({ data: segmentRows });

            const completed = await markVideoCompleted(transaction, jobData.videoId, jobId);
            if (!completed) {
                // Rolls back the segment insert.
                throw new VideoNoLongerClaimableError(jobData.videoId);
            }
        });

        return { status: "completed" };
    } catch (error) {
        const maxAttempts = job.opts.attempts ?? 1;
        // `attemptsMade` counts *finished* attempts, so the current one is +1.
        const isFinalAttempt =
            error instanceof UnrecoverableError || job.attemptsMade + 1 >= maxAttempts;

        if (isFinalAttempt) {
            await failVideoAndRefund(prisma, {
                videoId: jobData.videoId,
                jobId,
                error,
            }).catch((statusError: unknown) => {
                console.error(
                    `Failed to mark video ${jobData.videoId} as FAILED and refund credit.`,
                    statusError,
                );
            });
        } else {
            console.warn(
                `Video ${jobData.videoId} attempt ${job.attemptsMade + 1}/${maxAttempts} failed; BullMQ will retry.`,
                error,
            );
        }

        throw error;
    } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        await Promise.all(
            temporaryFilesToCleanup.map((filePath) => unlink(filePath).catch(() => {})),
        );
    }
}
