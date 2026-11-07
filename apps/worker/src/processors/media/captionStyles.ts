/**
 * Burned-in caption styles, rendered as ASS subtitles by libass.
 *
 * Pure functions only (no I/O). The web app's style picker
 * (apps/web/src/app/components/CaptionStylePicker.tsx) mirrors these looks in
 * CSS; keep the two in step when a style changes.
 *
 * Fonts are bundled in apps/worker/fonts and passed to the `ass` filter with
 * `fontsdir`, so captions look the same locally and on Render.
 */

export type CaptionWord = { word: string; start: number; end: number };

export const CAPTION_STYLES = [
    "NONE",
    "KARAOKE",
    "HIGHLIGHT",
    "MINIMAL",
    "POP",
    "MARKER",
    "BOX",
    "NEON",
    "HEADLINE",
] as const;
export type CaptionStyleType = (typeof CAPTION_STYLES)[number];
export type BurnedCaptionStyle = Exclude<CaptionStyleType, "NONE">;
export type AspectRatioType = "VERTICAL_9_16" | "SQUARE_1_1" | "LANDSCAPE_16_9";

/** How the words of a phrase are animated. */
type Mode =
    /** Words fill with the accent colour as they are spoken (\kf). */
    | "karaoke"
    /** The whole phrase shows; the spoken word gets the `active` look. */
    | "active"
    /** The whole phrase shows, no per-word change. */
    | "static";

type StyleSpec = {
    font: string;
    /** Font size relative to the aspect ratio's base size. */
    size: number;
    /** Average advance per character as a share of the ASS font size (measured, +10%), used to fit one line. */
    charEm: number;
    uppercase: boolean;
    mode: Mode;
    maxWords?: number;
    text: string;
    outline: string;
    outlineWidth: number;
    shadow: number;
    shadowColour: string;
    /** 3 = opaque box behind the line (outline colour), 1 = normal outline. */
    borderStyle: 1 | 3;
    blur?: number;
    /** karaoke: colour the words fill to. */
    fill?: string;
    /** active: override tags for the spoken word (closed with a style reset). */
    active?: string;
    /** Scale the phrase in from this percentage when it appears. */
    popIn?: number;
    /** active: a solid rectangle behind the spoken word, drawn on a lower layer. */
    marker?: { colour: string; pad: number };
};

/** "#RRGGBB" (+ alpha 0–255, 0 = opaque) → ASS "&HAABBGGRR". */
function ass(hex: string, alpha = 0): string {
    const value = hex.replace("#", "");
    const r = value.slice(0, 2);
    const g = value.slice(2, 4);
    const b = value.slice(4, 6);
    const a = alpha.toString(16).padStart(2, "0");
    return `&H${a}${b}${g}${r}`.toUpperCase();
}

/** Colour override tag value: "&HBBGGRR&". */
function tagColour(hex: string): string {
    return `${ass(hex).slice(0, 2)}${ass(hex).slice(4)}&`;
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";

export const STYLE_SPECS: Record<BurnedCaptionStyle, StyleSpec> = {
    KARAOKE: {
        font: "Montserrat Black",
        size: 0.95,
        charEm: 0.48,
        uppercase: true,
        mode: "karaoke",
        text: WHITE,
        fill: "#FFE14D",
        outline: BLACK,
        outlineWidth: 6,
        shadow: 4,
        shadowColour: BLACK,
        borderStyle: 1,
    },
    HIGHLIGHT: {
        font: "Montserrat Black",
        size: 0.95,
        charEm: 0.48,
        uppercase: true,
        mode: "active",
        text: WHITE,
        outline: BLACK,
        outlineWidth: 6,
        shadow: 4,
        shadowColour: BLACK,
        borderStyle: 1,
        active: `\\c${tagColour("#4CFF7A")}\\fscx112\\fscy112`,
    },
    MINIMAL: {
        font: "Montserrat ExtraBold",
        size: 0.8,
        charEm: 0.37,
        uppercase: false,
        mode: "static",
        maxWords: 7,
        text: WHITE,
        outline: BLACK,
        outlineWidth: 2.5,
        shadow: 2,
        shadowColour: BLACK,
        borderStyle: 1,
        blur: 0.6,
    },
    POP: {
        font: "Montserrat Black",
        size: 1.3,
        charEm: 0.48,
        uppercase: true,
        mode: "active",
        maxWords: 2,
        text: WHITE,
        outline: BLACK,
        outlineWidth: 7,
        shadow: 5,
        shadowColour: BLACK,
        borderStyle: 1,
        active: `\\c${tagColour("#FFE14D")}`,
        popIn: 72,
    },
    MARKER: {
        font: "Montserrat ExtraBold",
        size: 0.9,
        charEm: 0.38,
        uppercase: false,
        mode: "active",
        text: WHITE,
        outline: BLACK,
        outlineWidth: 4,
        shadow: 0,
        shadowColour: BLACK,
        borderStyle: 1,
        active: `\\c${tagColour("#141414")}\\bord0`,
        marker: { colour: "#C9A7FF", pad: 10 },
    },
    BOX: {
        font: "Montserrat ExtraBold",
        size: 0.78,
        charEm: 0.37,
        uppercase: false,
        mode: "active",
        maxWords: 6,
        text: WHITE,
        outline: "#121212",
        outlineWidth: 16,
        shadow: 0,
        shadowColour: BLACK,
        borderStyle: 3,
        active: `\\c${tagColour("#FFB547")}`,
    },
    NEON: {
        font: "Montserrat Black",
        size: 0.92,
        charEm: 0.48,
        uppercase: true,
        mode: "active",
        text: "#F2FFFF",
        outline: "#00E1FF",
        outlineWidth: 4,
        shadow: 0,
        shadowColour: BLACK,
        borderStyle: 1,
        blur: 7,
        active: `\\c${tagColour(WHITE)}\\3c${tagColour("#FF3DB5")}`,
    },
    HEADLINE: {
        font: "Anton",
        size: 1.25,
        charEm: 0.28,
        uppercase: true,
        mode: "active",
        maxWords: 5,
        text: WHITE,
        outline: BLACK,
        outlineWidth: 5,
        shadow: 5,
        shadowColour: BLACK,
        borderStyle: 1,
        active: `\\c${tagColour("#FFD400")}`,
    },
};

type Layout = { width: number; height: number; baseSize: number; marginV: number; marginH: number; maxWords: number };

/**
 * Vertical captions sit at roughly 70% of the frame height, above the
 * TikTok / Shorts caption, username and action bar that cover the bottom
 * quarter of the screen.
 */
function getLayout(aspectRatio: AspectRatioType): Layout {
    switch (aspectRatio) {
        case "VERTICAL_9_16":
            return { width: 1080, height: 1920, baseSize: 100, marginV: 520, marginH: 70, maxWords: 4 };
        case "SQUARE_1_1":
            return { width: 1080, height: 1080, baseSize: 84, marginV: 130, marginH: 70, maxWords: 4 };
        case "LANDSCAPE_16_9":
            return { width: 1920, height: 1080, baseSize: 72, marginV: 90, marginH: 220, maxWords: 6 };
    }
}

function formatAssTime(seconds: number): string {
    const clamped = Math.max(0, seconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const secs = Math.floor(clamped % 60);
    const centiseconds = Math.min(99, Math.round((clamped - Math.floor(clamped)) * 100));
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
    return text
        .replace(/\\[Nn]|[\r\n]+/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/\{/g, "\\{")
        .replace(/\}/g, "\\}");
}

/** Uppercase styles drop trailing commas and full stops (noise on screen) but keep ? and !. */
function displayWord(text: string, uppercase: boolean): string {
    if (!uppercase) return escapeAssText(text);
    return escapeAssText(text.replace(/[.,;:]+(["'”’)]*)$/, "$1").toUpperCase());
}

/**
 * Groups words into short phrases that fit one caption line, breaking early
 * at punctuation and pauses so each phrase reads as a unit.
 */
function chunkWordsIntoPhrases(words: CaptionWord[], maxWords: number, maxChars: number): CaptionWord[][] {
    const phrases: CaptionWord[][] = [];
    let current: CaptionWord[] = [];
    let currentChars = 0;

    const flush = () => {
        if (current.length > 0) phrases.push(current);
        current = [];
        currentChars = 0;
    };

    for (let i = 0; i < words.length; i++) {
        const word = words[i]!;
        const text = word.word.replace(/\\[Nn]|[\r\n]+/g, " ").trim();
        if (!text) continue;

        if (current.length > 0 && currentChars + 1 + text.length > maxChars) flush();
        currentChars += (current.length > 0 ? 1 : 0) + text.length;
        current.push({ ...word, word: text });

        const next = words[i + 1];
        const endsSentence = /[.!?…]["'”’)]*$/.test(text);
        const endsClause = /[,;:]["'”’)]*$/.test(text);
        const pause = next ? next.start - word.end : 0;
        if (current.length >= maxWords || endsSentence || (endsClause && (current.length >= 2 || maxWords <= 2)) || pause > 0.5) {
            flush();
        }
    }

    flush();
    return phrases;
}

function relativeWords(words: CaptionWord[], segmentStart: number, segmentEnd: number): CaptionWord[] {
    const duration = Math.max(0.1, segmentEnd - segmentStart);
    return words
        .filter((w) => w.end > segmentStart && w.start < segmentEnd)
        .map((w) => {
            const start = Math.max(0, w.start - segmentStart);
            const end = Math.min(duration, Math.max(start + 0.05, w.end - segmentStart));
            return { word: w.word.replace(/\\[Nn]|[\r\n]+/g, " ").trim(), start, end };
        })
        .filter((w) => w.word.length > 0)
        .sort((a, b) => a.start - b.start || a.end - b.end)
        .filter(
            (word, index, all) =>
                index === 0 ||
                word.start !== all[index - 1]!.start ||
                word.end !== all[index - 1]!.end ||
                word.word !== all[index - 1]!.word,
        )
        .map((word, index, all) => {
            const start = Math.max(word.start, index > 0 ? all[index - 1]!.end : 0);
            return { ...word, start, end: Math.max(start + 0.05, word.end) };
        });
}

export function buildAssSubtitleContent(
    words: CaptionWord[],
    segmentStartTime: number,
    segmentEndTime: number,
    captionStyle: BurnedCaptionStyle,
    aspectRatio: AspectRatioType,
): string {
    const spec = STYLE_SPECS[captionStyle];
    const layout = getLayout(aspectRatio);
    const segmentDuration = Math.max(0.1, segmentEndTime - segmentStartTime);

    const fontSize = Math.round(layout.baseSize * spec.size);
    const usableWidth = layout.width - layout.marginH * 2 - spec.outlineWidth * 2;
    const maxChars = Math.max(8, Math.floor(usableWidth / (fontSize * spec.charEm)));
    const maxWords = spec.maxWords ?? layout.maxWords;

    // Karaoke fills from SecondaryColour to PrimaryColour.
    const primary = spec.mode === "karaoke" ? ass(spec.fill ?? spec.text) : ass(spec.text);
    const secondary = ass(spec.text);
    // Box styles stay opaque: libass draws one box per glyph, so a
    // translucent box shows darker stripes where neighbouring boxes overlap.
    const outlineAlpha = 0;
    const blurTag = spec.blur ? `\\blur${spec.blur}` : "";

    // WrapStyle 0 (smart wrap) is only a safety net: phrases are sized to fit one line.
    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${layout.width}
PlayResY: ${layout.height}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${spec.font},${fontSize},${primary},${secondary},${ass(spec.outline, outlineAlpha)},${ass(spec.shadowColour, 0x60)},0,0,0,0,100,100,0,0,${spec.borderStyle},${spec.outlineWidth},${spec.shadow},2,${layout.marginH},${layout.marginH},${layout.marginV},1${
        spec.marker
            ? `\nStyle: Marker,${spec.font},${fontSize},&HFF000000,&HFF000000,${ass(spec.marker.colour)},&HFF000000,0,0,0,0,100,100,0,0,3,${spec.marker.pad},0,2,${layout.marginH},${layout.marginH},${layout.marginV},1`
            : ""
    }

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    const phrases = chunkWordsIntoPhrases(relativeWords(words, segmentStartTime, segmentEndTime), maxWords, maxChars);
    const lines: string[] = [];
    const dialogue = (start: number, end: number, text: string, layer = 1, style = "Default") =>
        lines.push(`Dialogue: ${layer},${formatAssTime(start)},${formatAssTime(end)},${style},,0,0,0,,${text}`);

    for (const [phraseIndex, phrase] of phrases.entries()) {
        const phraseStart = phrase[0]!.start;
        const lastWordEnd = phrase[phrase.length - 1]!.end;
        const nextPhraseStart = phrases[phraseIndex + 1]?.[0]?.start ?? segmentDuration;
        // Hold the phrase through short gaps so captions do not flicker off
        // between phrases, but clear it during real pauses.
        const phraseEnd = Math.min(nextPhraseStart, segmentDuration, Math.max(lastWordEnd + 0.6, phraseStart + 0.5));
        if (phraseEnd <= phraseStart) continue;

        const pop = (eventStart: number) =>
            spec.popIn && eventStart === phraseStart
                ? `\\fscx${spec.popIn}\\fscy${spec.popIn}\\t(0,90,\\fscx106\\fscy106)\\t(90,150,\\fscx100\\fscy100)`
                : "";

        if (spec.mode === "karaoke") {
            let cursor = phraseStart;
            const tokens = phrase.map((w) => {
                const gapCs = Math.max(0, Math.round((w.start - cursor) * 100));
                const durationCs = Math.max(5, Math.round((w.end - w.start) * 100));
                cursor = w.end;
                return `${gapCs > 0 ? `{\\k${gapCs}}` : ""}{\\kf${durationCs}}${displayWord(w.word, spec.uppercase)}`;
            });
            dialogue(phraseStart, phraseEnd, `{${blurTag}${pop(phraseStart)}}${tokens.join(" ")}`);
        } else if (spec.mode === "static") {
            dialogue(
                phraseStart,
                phraseEnd,
                `{${blurTag}${pop(phraseStart)}}${phrase.map((w) => displayWord(w.word, spec.uppercase)).join(" ")}`,
            );
        } else {
            for (let idx = 0; idx < phrase.length; idx++) {
                const next = phrase[idx + 1];
                // Each word stays active until the next one starts, so the line
                // never blinks off between words.
                const eventStart = idx === 0 ? phraseStart : phrase[idx]!.start;
                const eventEnd = next ? next.start : phraseEnd;
                if (eventEnd <= eventStart) continue;

                const rendered = phrase.map((w, wIdx) => {
                    const text = displayWord(w.word, spec.uppercase);
                    return wIdx === idx ? `{${spec.active ?? ""}}${text}{\\r${blurTag}}` : text;
                });
                dialogue(eventStart, eventEnd, `{${blurTag}${pop(eventStart)}}${rendered.join(" ")}`);

                if (spec.marker) {
                    // Same text and layout underneath, with only the spoken
                    // word's box visible, so the box lines up exactly.
                    const boxes = phrase.map((w, wIdx) => {
                        const text = displayWord(w.word, spec.uppercase);
                        return wIdx === idx ? `{\\3a&H00&}${text}{\\3a&HFF&}` : text;
                    });
                    dialogue(eventStart, eventEnd, `{\\3a&HFF&}${boxes.join(" ")}`, 0, "Marker");
                }
            }
        }
    }

    return `${header}\n${lines.join("\n")}\n`;
}
