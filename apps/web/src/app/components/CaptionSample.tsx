import type { CSSProperties } from "react";
import { Anton, Montserrat } from "next/font/google";
import type { CaptionStyle } from "@/../../packages/database/index";

/*
 * Browser mirror of the burned-in caption styles in
 * apps/worker/src/processors/media/captionStyles.ts. Same fonts, colours and
 * per-word behaviour, so what people pick is what they get. Keep the two in
 * step when a style changes.
 */

const montserrat = Montserrat({ weight: ["800", "900"], subsets: ["latin"], display: "swap" });
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap" });

export const CAPTION_STYLE_OPTIONS: Array<{ id: CaptionStyle; label: string }> = [
    { id: "KARAOKE", label: "Karaoke" },
    { id: "HIGHLIGHT", label: "Highlight" },
    { id: "POP", label: "Word pop" },
    { id: "MARKER", label: "Marker" },
    { id: "BOX", label: "Boxed" },
    { id: "NEON", label: "Neon" },
    { id: "HEADLINE", label: "Headline" },
    { id: "MINIMAL", label: "Clean" },
    { id: "NONE", label: "No captions" },
];

export const SAMPLE_WORDS = ["To", "get", "started"];
/** Steps in one preview loop: one per word, then a held beat with the phrase complete. */
export const SAMPLE_STEPS = SAMPLE_WORDS.length + 1;

const OUTLINE = (width: string, colour = "#000"): CSSProperties => ({
    WebkitTextStroke: `${width} ${colour}`,
    paintOrder: "stroke fill",
});

type Look = {
    font: "montserrat" | "anton";
    weight: 800 | 900 | 400;
    size: number;
    uppercase: boolean;
    base: CSSProperties;
    active?: CSSProperties;
    /** Karaoke: words already spoken keep this look. */
    spoken?: CSSProperties;
    box?: CSSProperties;
    /** Only show this many words at a time (word pop). */
    window?: number;
};

const LOOKS: Record<Exclude<CaptionStyle, "NONE">, Look> = {
    KARAOKE: {
        font: "montserrat",
        weight: 900,
        size: 1,
        uppercase: true,
        base: { color: "#fff", ...OUTLINE("0.16em"), textShadow: "0 0.07em 0 #000" },
        spoken: { color: "#FFE14D" },
    },
    HIGHLIGHT: {
        font: "montserrat",
        weight: 900,
        size: 1,
        uppercase: true,
        base: { color: "#fff", ...OUTLINE("0.16em"), textShadow: "0 0.07em 0 #000" },
        active: { color: "#4CFF7A", transform: "scale(1.12)" },
    },
    POP: {
        font: "montserrat",
        weight: 900,
        size: 1.3,
        uppercase: true,
        base: { color: "#fff", ...OUTLINE("0.16em"), textShadow: "0 0.08em 0 #000" },
        active: { color: "#FFE14D" },
        window: 2,
    },
    MARKER: {
        font: "montserrat",
        weight: 800,
        size: 0.95,
        uppercase: false,
        base: { color: "#fff", ...OUTLINE("0.1em") },
        active: {
            color: "#141414",
            WebkitTextStroke: "0",
            background: "#C9A7FF",
            boxShadow: "0 0 0 0.12em #C9A7FF",
        },
    },
    BOX: {
        font: "montserrat",
        weight: 800,
        size: 0.85,
        uppercase: false,
        base: { color: "#fff" },
        active: { color: "#FFB547" },
        box: { background: "#121212", padding: "0.18em 0.4em" },
    },
    NEON: {
        font: "montserrat",
        weight: 900,
        size: 0.95,
        uppercase: true,
        base: {
            color: "#F2FFFF",
            textShadow: "0 0 0.06em #00E1FF, 0 0 0.16em #00E1FF, 0 0 0.3em #00E1FF",
        },
        active: {
            color: "#fff",
            textShadow: "0 0 0.06em #FF3DB5, 0 0 0.16em #FF3DB5, 0 0 0.3em #FF3DB5",
        },
    },
    HEADLINE: {
        font: "anton",
        weight: 400,
        size: 1.3,
        uppercase: true,
        base: { color: "#fff", ...OUTLINE("0.12em"), textShadow: "0 0.08em 0 #000", letterSpacing: "0.01em" },
        active: { color: "#FFD400" },
    },
    MINIMAL: {
        font: "montserrat",
        weight: 800,
        size: 0.85,
        uppercase: false,
        base: { color: "#fff", ...OUTLINE("0.06em"), textShadow: "0 0.04em 0.08em rgba(0,0,0,0.6)" },
    },
};

/**
 * One frame of a caption style. `step` 0..n-1 marks the spoken word; `step`
 * n shows the phrase complete. Size comes from the parent's font-size.
 */
export default function CaptionSample({ style, step }: { style: CaptionStyle; step: number }) {
    if (style === "NONE") return null;
    const look = LOOKS[style];
    const activeIndex = Math.min(step, SAMPLE_WORDS.length - 1);
    const done = step >= SAMPLE_WORDS.length;

    // Word pop shows short groups; the group holding the spoken word.
    let words = SAMPLE_WORDS.map((word, index) => ({ word, index }));
    let groupKey = 0;
    if (look.window) {
        groupKey = Math.floor(activeIndex / look.window);
        words = words.slice(groupKey * look.window, groupKey * look.window + look.window);
    }

    return (
        <span
            key={look.window ? groupKey : undefined}
            className={`inline-block max-w-full text-center leading-[1.08] ${look.font === "anton" ? anton.className : montserrat.className} ${look.window ? "motion-safe:animate-[sm-caption-pop_160ms_ease-out]" : ""}`}
            style={{
                fontSize: `${look.size}em`,
                fontWeight: look.weight,
                textTransform: look.uppercase ? "uppercase" : "none",
                ...look.box,
            }}
        >
            {words.map(({ word, index }, i) => {
                const isActive = !done && index === activeIndex;
                const isSpoken = look.spoken ? index <= activeIndex || done : false;
                return (
                    <span key={index}>
                        <span
                            className="inline-block transition-[color,transform] duration-100"
                            style={{
                                ...look.base,
                                ...(isSpoken ? look.spoken : null),
                                ...(isActive ? look.active : null),
                            }}
                        >
                            {word}
                        </span>
                        {i < words.length - 1 ? " " : null}
                    </span>
                );
            })}
        </span>
    );
}
