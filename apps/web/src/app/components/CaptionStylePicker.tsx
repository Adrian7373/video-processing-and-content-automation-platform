"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CaptionStyle } from "@/../../packages/database/index";
import CaptionSample, { CAPTION_STYLE_OPTIONS, SAMPLE_STEPS } from "./CaptionSample";

const STEP_MS = 420;
/** The completed phrase holds a little longer before the loop restarts. */
const HOLD_STEPS = 2;
/** Frame shown while a tile is not playing: mid-phrase, so the style's word treatment is visible. */
const RESTING_STEP = 1;

function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Caption style choice as a row of live samples. Hovering or focusing a
 * tile plays its sample; arrow keys move the selection.
 */
export default function CaptionStylePicker({
    value,
    onChange,
    allowNone,
    disabled,
}: {
    value: CaptionStyle;
    onChange: (style: CaptionStyle) => void;
    allowNone: boolean;
    disabled?: boolean;
}) {
    const options = CAPTION_STYLE_OPTIONS.filter((option) => allowNone || option.id !== "NONE");
    const [playing, setPlaying] = useState<CaptionStyle | null>(null);
    const [tick, setTick] = useState(0);
    const [edges, setEdges] = useState({ start: true, end: true });
    const scrollerRef = useRef<HTMLDivElement>(null);
    const tileRefs = useRef(new Map<CaptionStyle, HTMLButtonElement>());

    useEffect(() => {
        if (!playing) return;
        const timer = window.setInterval(() => setTick((t) => t + 1), STEP_MS);
        return () => window.clearInterval(timer);
    }, [playing]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const update = () =>
            setEdges({
                start: scroller.scrollLeft <= 2,
                end: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2,
            });
        const observer = new ResizeObserver(update);
        observer.observe(scroller);
        scroller.addEventListener("scroll", update, { passive: true });
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", update);
        };
    }, []);

    const play = (style: CaptionStyle) => {
        if (prefersReducedMotion()) return;
        setTick(0);
        setPlaying(style);
    };
    const stop = (style: CaptionStyle) => setPlaying((current) => (current === style ? null : current));

    const loopStep = tick % (SAMPLE_STEPS + HOLD_STEPS);
    const stepFor = (style: CaptionStyle) =>
        playing === style ? Math.min(loopStep, SAMPLE_STEPS - 1) : RESTING_STEP;

    const scrollByPage = (direction: 1 | -1) => {
        const scroller = scrollerRef.current;
        if (scroller) scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: "smooth" });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const delta =
            event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
        if (!delta) return;
        event.preventDefault();
        const index = options.findIndex((option) => option.id === value);
        const next = options[(index + delta + options.length) % options.length]!;
        onChange(next.id);
        const tile = tileRefs.current.get(next.id);
        tile?.focus();
        tile?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    };

    const arrowClass =
        "absolute top-[46px] z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-raised text-ink shadow-[0_4px_12px_-4px_rgba(14,20,36,0.35)] transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

    return (
        <div className="relative">
            <div
                ref={scrollerRef}
                role="radiogroup"
                aria-label="Caption style"
                onKeyDown={onKeyDown}
                className="-mx-1 flex snap-x gap-3 overflow-x-auto scroll-px-1 px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {options.map((option) => {
                    const selected = option.id === value;
                    return (
                        <div key={option.id} className="flex w-[124px] shrink-0 snap-start flex-col items-center gap-2">
                            <button
                                ref={(node) => {
                                    if (node) tileRefs.current.set(option.id, node);
                                    else tileRefs.current.delete(option.id);
                                }}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={option.label}
                                tabIndex={selected ? 0 : -1}
                                disabled={disabled}
                                onClick={() => onChange(option.id)}
                                onMouseEnter={() => play(option.id)}
                                onMouseLeave={() => stop(option.id)}
                                onFocus={() => play(option.id)}
                                onBlur={() => stop(option.id)}
                                className={`relative grid h-[92px] w-full place-items-center overflow-hidden rounded-xl bg-frame bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,255,255,0.16),transparent_72%)] px-2 text-[15px] transition [container-type:inline-size] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-50 ${
                                    selected
                                        ? "shadow-[0_0_0_2px_var(--sm-page),0_0_0_4px_var(--sm-ink)]"
                                        : "hover:shadow-[0_0_0_2px_var(--sm-page),0_0_0_3px_var(--sm-line-strong)]"
                                }`}
                            >
                                {selected && (
                                    <span className="absolute left-1.5 top-1.5 rounded-md bg-[rgba(5,8,15,0.75)] px-1.5 py-px text-[13px] font-medium leading-5 text-white">
                                        Selected
                                    </span>
                                )}
                                {option.id === "NONE" ? (
                                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                                        <rect x="3" y="6" width="18" height="12" rx="2.5" />
                                        <path d="M7 14h4M13 14h4M4 20 20 4" />
                                    </svg>
                                ) : (
                                    <span className={`pointer-events-none ${selected ? "mt-4" : ""}`} aria-hidden="true">
                                        <CaptionSample style={option.id} step={stepFor(option.id)} />
                                    </span>
                                )}
                            </button>
                            <span className={`text-[13px] ${selected ? "font-medium text-ink" : "text-muted"}`}>{option.label}</span>
                        </div>
                    );
                })}
            </div>

            {!edges.start && (
                <button type="button" aria-label="Show previous styles" onClick={() => scrollByPage(-1)} className={`${arrowClass} -left-3`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m15 6-6 6 6 6" />
                    </svg>
                </button>
            )}
            {!edges.end && (
                <button type="button" aria-label="Show more styles" onClick={() => scrollByPage(1)} className={`${arrowClass} -right-3`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                    </svg>
                </button>
            )}
        </div>
    );
}
