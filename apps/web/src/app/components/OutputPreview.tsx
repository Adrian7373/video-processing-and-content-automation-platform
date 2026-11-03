import type { AspectRatio, CaptionStyle } from "@/../../packages/database/index";

type Mode = "CLIP" | "CAPTION_ONLY";

const FRAME_RATIO: Record<AspectRatio, string> = {
    VERTICAL_9_16: "aspect-[9/16]",
    SQUARE_1_1: "aspect-square",
    LANDSCAPE_16_9: "aspect-video",
};

const SAMPLE_WORDS = ["THIS", "IS", "THE", "PART", "YOU", "KEEP"];

/** Where sample clips sit on the source bar, as fractions of the video. */
const SAMPLE_CLIPS = [
    { start: 0.1, length: 0.08 },
    { start: 0.44, length: 0.1 },
    { start: 0.76, length: 0.07 },
];

function timecode(totalSeconds: number) {
    const total = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function Scene({ tone }: { tone: number }) {
    const walls = ["#2a3a63", "#3b2f4f", "#24464a"];
    return (
        <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <rect width="90" height="160" fill={walls[tone % walls.length]} />
            <rect y="104" width="90" height="56" fill="#141b2e" />
            <circle cx="70" cy="30" r="16" fill="#f7941d" opacity="0.85" />
            <ellipse cx="45" cy="82" rx="17" ry="19" fill="#e9c4a3" />
            <path d="M18 160c2-30 12-46 27-46s25 16 27 46z" fill="#101626" />
            <path d="M28 72c2-14 10-20 17-20s16 6 17 20c-6-6-11-8-17-8s-11 2-17 8z" fill="#151a24" />
        </svg>
    );
}

function SampleCaption({ style }: { style: CaptionStyle }) {
    if (style === "NONE") return null;
    const shadow = "[text-shadow:0_0_2px_#05080f,0_2px_0_#05080f,2px_0_0_#05080f,-2px_0_0_#05080f,0_-2px_0_#05080f]";
    if (style === "MINIMAL") {
        return (
            <p className="absolute inset-x-[8%] bottom-[14%] text-center text-[clamp(9px,6cqi,14px)] font-medium leading-tight text-white [text-shadow:0_1px_3px_rgba(5,8,15,0.9)]">
                This is the part you keep
            </p>
        );
    }
    return (
        <p className={`absolute inset-x-[6%] bottom-[14%] text-center font-display text-[clamp(10px,8.5cqi,20px)] font-bold leading-[1.1] text-white ${shadow}`}>
            {SAMPLE_WORDS.map((word, i) => (
                <span key={word}>
                    <span
                        className={
                            style === "KARAOKE"
                                ? i <= 2
                                    ? "text-[#ffd338]"
                                    : ""
                                : i === 3
                                    ? "inline-block scale-110 text-[#ffd338]"
                                    : ""
                        }
                    >
                        {word}
                    </span>
                    {i < SAMPLE_WORDS.length - 1 ? " " : null}
                </span>
            ))}
        </p>
    );
}

/**
 * A live picture of what the current settings will produce: where clips come
 * from in the source, and what each output looks like (shape and caption style).
 */
export default function OutputPreview({
    mode,
    aspectRatio,
    captionStyle,
    fileName,
    durationSeconds,
}: {
    mode: Mode;
    aspectRatio: AspectRatio;
    captionStyle: CaptionStyle;
    fileName: string | null;
    durationSeconds: number | null;
}) {
    const isClips = mode === "CLIP";
    const frames = isClips ? 3 : 1;
    const landscape = aspectRatio === "LANDSCAPE_16_9";
    const effectiveStyle: CaptionStyle = !isClips && captionStyle === "NONE" ? "KARAOKE" : captionStyle;

    return (
        <div className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-lg font-medium tracking-[-0.015em]">What you will get</h2>

            {/* Source */}
            <div className="mt-4 rounded-xl border border-line bg-raised p-4">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate font-medium">{fileName ?? "Your video"}</span>
                    <span className="shrink-0 tabular-nums text-muted">{durationSeconds ? timecode(durationSeconds) : "up to 45:00"}</span>
                </div>
                <div className="relative mt-7 h-7 rounded-md bg-surface">
                    {isClips ? (
                        SAMPLE_CLIPS.map((clip, i) => (
                            <span
                                key={i}
                                className="absolute inset-y-0 rounded-md bg-action"
                                style={{ left: `${clip.start * 100}%`, width: `${clip.length * 100}%` }}
                            >
                                <span className="absolute -top-5 left-0 text-[13px] font-semibold tabular-nums text-ink">{i + 1}</span>
                            </span>
                        ))
                    ) : (
                        <span className="absolute inset-0 rounded-md bg-action/40 shadow-[inset_0_0_0_2px_var(--sm-action)]" />
                    )}
                </div>
                <p className="mt-3 text-[13px] text-muted">
                    {isClips
                        ? "We pick the strongest moments, each a complete thought."
                        : "The whole video, start to finish."}
                </p>
            </div>

            {/* Outputs */}
            <div className={`mt-4 grid gap-3 ${frames === 1 ? (landscape ? "grid-cols-1" : "mx-auto max-w-[200px] grid-cols-1") : landscape ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3"}`}>
                {Array.from({ length: frames }, (_, i) => (
                    <div key={i} className={`relative overflow-hidden rounded-xl bg-frame [container-type:inline-size] ${FRAME_RATIO[aspectRatio]}`}>
                        <Scene tone={i} />
                        <span className="absolute left-2 top-2 rounded-md bg-[rgba(5,8,15,0.72)] px-1.5 py-0.5 text-[13px] tabular-nums text-white">
                            {isClips ? ["0:32", "0:47", "0:28"][i] : durationSeconds ? timecode(durationSeconds) : "Full"}
                        </span>
                        <SampleCaption style={effectiveStyle} />
                    </div>
                ))}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">
                {isClips
                    ? "Up to 5 clips of 20 to 60 seconds, fewer for short videos. Each comes with a title, a caption with hashtags and a thumbnail."
                    : "One video with captions burned in, the same length as your upload."}
            </p>
        </div>
    );
}
