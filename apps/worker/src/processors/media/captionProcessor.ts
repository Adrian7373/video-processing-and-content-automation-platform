import fs from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { z } from "zod";

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
    words: WordTimestamp[];
    segmentStartTime: number;
    segmentEndTime: number;
    captionStyle: CaptionStyleType;
    aspectRatio: AspectRatioType;
}

export interface GenerateCaptionsResult {
    captionedClipPath: string | null;
    assFilePath: string | null;
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
    const outlineWidth = isMinimal ? 3 : 5;

    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resolution.width}
PlayResY: ${resolution.height}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${resolution.fontSize},${primaryColor},${secondaryColor},&H00000000,&H80000000,${isMinimal ? 0 : -1},0,0,0,100,100,0,0,1,${outlineWidth},2,2,60,60,${resolution.marginV},1

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
            // Render one event per active word so the active word pops in Yellow and scales slightly
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
            // MINIMAL style
            const text = phrase.map((w) => escapeAssText(w.word)).join(" ");
            dialogueLines.push(
                `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${text}`,
            );
        }
    }

    return `${header}\n${dialogueLines.join("\n")}\n`;
}

/**
 * Generates the .ass file and burns captions into the video clip using FFmpeg
 */
export async function generateAndBurnCaptions(
    options: GenerateCaptionsOptions,
): Promise<GenerateCaptionsResult> {
    const {
        inputClipPath,
        outputClipPath,
        outputAssPath,
        words,
        segmentStartTime,
        segmentEndTime,
        captionStyle,
        aspectRatio,
    } = options;

    // 1. Respect "NONE" immediately
    if (captionStyle === "NONE" || words.length === 0) {
        return { captionedClipPath: null, assFilePath: null };
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

    return {
        captionedClipPath: outputClipPath,
        assFilePath: outputAssPath,
    };
}