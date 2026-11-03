"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
    AlertCircle,
    CalendarClock,
    Check,
    Monitor,
    Moon,
    Plus,
    Scissors,
    Sun,
    Trash2,
    Upload,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";

/* ------------------------------------------------------------------ */
/* Tokens shown on the page (mirrors designsystem.css)                 */
/* ------------------------------------------------------------------ */

const PALETTE = [
    { name: "Page", token: "--bg", role: "The page ground", light: "#FFFFFF", dark: "#0E1424" },
    { name: "Surface", token: "--surface", role: "Panels, tracks, quiet fills", light: "#F4F4F2", dark: "#151D33" },
    { name: "Ink", token: "--ink", role: "Text, icons, the playhead", light: "#1F2B4D", dark: "#EEF0F6" },
    { name: "Muted", token: "--muted", role: "Labels, meta, hints", light: "#646B81", dark: "#A3AAC0" },
    { name: "Signal", token: "--action", role: "The one main action, kept clips", light: "#F7941D", dark: "#F7941D" },
    { name: "Link", token: "--link", role: "Text links on the page", light: "#A65300", dark: "#FFB25E" },
] as const;

const STATUS = [
    { name: "Ready", token: "--success", light: "#1B7F52", dark: "#4CC38A" },
    { name: "Failed", token: "--danger", light: "#C2303A", dark: "#FF7C82" },
    { name: "Scheduled", token: "--info", light: "#2E57C9", dark: "#8EAEFF" },
] as const;

function luminance(hex: string) {
    const channels = [1, 3, 5]
        .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
}

/* ------------------------------------------------------------------ */
/* Sample content: one real-feeling source video and its clips         */
/* ------------------------------------------------------------------ */

const SOURCE_SECONDS = 38 * 60 + 12;
const CLIPS = [
    { title: "Why we doubled our prices", start: 250, end: 292, words: ["WE", "DOUBLED", "THE", "PRICE"] },
    { title: "The customer call that changed our roadmap", start: 1053, end: 1100, words: ["ONE", "CALL", "CHANGED", "IT"] },
    { title: "One number to check every Monday", start: 1745, end: 1781, words: ["CHECK", "THIS", "EVERY", "MONDAY"] },
] as const;

function timecode(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const WAVE_BARS = Array.from({ length: 140 }, (_, i) => {
    const v =
        0.35 +
        0.3 * Math.abs(Math.sin(i * 0.37)) +
        0.25 * Math.abs(Math.sin(i * 1.13 + 1.7)) * Math.abs(Math.cos(i * 0.09));
    // Rounded so server and client serialise identical style strings (no hydration mismatch).
    return Math.round(Math.min(1, Math.max(0.12, v)) * 1000) / 10;
});

const INDEX = [
    {
        group: "Foundations",
        items: [
            { id: "colour", label: "Colour" },
            { id: "type", label: "Type" },
            { id: "space", label: "Spacing and radius" },
        ],
    },
    {
        group: "Components",
        items: [
            { id: "buttons", label: "Buttons" },
            { id: "forms", label: "Form controls" },
            { id: "feedback", label: "Status and feedback" },
        ],
    },
    {
        group: "Patterns",
        items: [
            { id: "clips", label: "Clips and captions" },
            { id: "schedule", label: "Schedule list" },
        ],
    },
] as const;

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Mark() {
    return (
        <span className="ds-mark" aria-hidden="true">
            <i />
            <i />
            <i />
        </span>
    );
}

/** A flat studio frame used as clip artwork until real thumbnails load. */
function StudioScene({ tone = 0 }: { tone?: number }) {
    const walls = ["#2a3a63", "#3b2f4f", "#24464a"];
    const wall = walls[tone % walls.length];
    return (
        <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="90" height="160" fill={wall} />
            <rect y="104" width="90" height="56" fill="#141b2e" />
            <circle cx="70" cy="30" r="16" fill="#f7941d" opacity="0.85" />
            <rect x="14" y="20" width="22" height="30" rx="2" fill="#ffffff" opacity="0.08" />
            <ellipse cx="45" cy="82" rx="17" ry="19" fill="#e9c4a3" />
            <path d="M18 160c2-30 12-46 27-46s25 16 27 46z" fill="#101626" />
            <path d="M28 72c2-14 10-20 17-20s16 6 17 20c-6-6-11-8-17-8s-11 2-17 8z" fill="#151a24" />
            <rect x="57" y="96" width="6" height="22" rx="3" fill="#0b0f19" />
            <rect x="55" y="86" width="10" height="14" rx="5" fill="#2b2f3a" />
        </svg>
    );
}

function Caption({ style, words, active = 2 }: { style: "karaoke" | "highlight" | "minimal"; words: readonly string[]; active?: number }) {
    if (style === "minimal") {
        return <p className="ds-caption ds-caption--minimal">{words.join(" ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p>;
    }
    return (
        <p className={`ds-caption ds-caption--${style}`}>
            {words.map((word, i) => (
                // The space sits outside the span: a scaled inline-block word would swallow it.
                <Fragment key={word + i}>
                    <span {...(style === "karaoke" && i <= active ? { "data-done": "" } : {})} {...(style === "highlight" && i === active ? { "data-on": "" } : {})}>
                        {word}
                    </span>
                    {i < words.length - 1 ? " " : null}
                </Fragment>
            ))}
        </p>
    );
}

function SectionHead({ title, text }: { title: string; text: string }) {
    return (
        <div className="ds-section__head">
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* The signature component: the clip timeline                          */
/* ------------------------------------------------------------------ */

function ClipTimeline() {
    const [selected, setSelected] = useState(0);
    const clip = CLIPS[selected]!;
    const pct = (s: number) => (s / SOURCE_SECONDS) * 100;

    return (
        <div className="ds-timeline">
            <div className="ds-timeline__bar">
                <div className="ds-timeline__title">
                    <h4>Founder podcast, episode 42</h4>
                    <span className="label">
                        <span className="tc">{timecode(SOURCE_SECONDS)}</span> source, 3 clips found
                    </span>
                </div>
                <div className="ds-row">
                    <span className="ds-badge ds-badge--ready">Ready</span>
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm">
                        <Plus aria-hidden="true" /> Add a clip
                    </button>
                </div>
            </div>

            <div className="ds-timeline__track-wrap">
                <div className="ds-track">
                    <div className="ds-wave" aria-hidden="true">
                        {WAVE_BARS.map((h, i) => {
                            const t = (i / WAVE_BARS.length) * SOURCE_SECONDS;
                            const inside = t >= clip.start - 12 && t <= clip.end + 12;
                            return <span key={i} data-in={inside} style={{ height: `${h}%` }} />;
                        })}
                    </div>
                    {CLIPS.map((c, i) => (
                        <button
                            key={c.title}
                            type="button"
                            className="ds-seg"
                            aria-pressed={selected === i}
                            aria-label={`Clip ${i + 1}: ${c.title}, ${timecode(c.start)} to ${timecode(c.end)}`}
                            onClick={() => setSelected(i)}
                            style={{ left: `${pct(c.start) - 1.2}%`, width: `${Math.max(pct(c.end - c.start) + 2.4, 3.5)}%` }}
                        >
                            <span className="ds-seg__num">{i + 1}</span>
                        </button>
                    ))}
                    <span className="ds-playhead" style={{ left: `${pct(clip.start)}%` }} aria-hidden="true" />
                </div>
                <div className="ds-ruler tc" aria-hidden="true">
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <span key={f}>{timecode(SOURCE_SECONDS * f)}</span>
                    ))}
                </div>
            </div>

            <div className="ds-clips">
                {CLIPS.map((c, i) => (
                    <button key={c.title} type="button" className="ds-clip" aria-pressed={selected === i} onClick={() => setSelected(i)}>
                        <span className="label">
                            Clip {i + 1}, <span className="tc">{timecode(c.start)}–{timecode(c.end)}</span>
                        </span>
                        <strong>{c.title}</strong>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DesignSystem() {
    const { mode, resolved, setMode } = useTheme();
    const [activeId, setActiveId] = useState<string>("colour");
    const [captions, setCaptions] = useState(true);
    const [mode2, setMode2] = useState<"clips" | "full">("clips");
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        // The current section is the last one whose top has passed a line just
        // under the header. Checked on scroll (rAF-throttled), not via
        // IntersectionObserver, whose entries only report the sections that changed.
        const ids = INDEX.flatMap((g) => g.items.map((item) => item.id));
        let frame = 0;
        const update = () => {
            frame = 0;
            const line = 140;
            let current: string = ids[0]!;
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top - line <= 0) current = id;
            }
            const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
            setActiveId(atBottom ? ids[ids.length - 1]! : current);
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        onScroll();
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "Auto", icon: Monitor },
    ];

    return (
        <div className="ds" data-theme={mode}>
            <header className="ds-nav">
                <div className="ds-nav__inner">
                    <Link href="/designsystem" className="ds-brand">
                        <Mark />
                        Scroll Maestro
                        <span className="ds-brand__tag">Design system</span>
                    </Link>
                    <div className="ds-nav__actions">
                        <div className="ds-seg-ctl" role="radiogroup" aria-label="Colour theme">
                            {themeOptions.map(({ value, label, icon: Icon }) => (
                                <button key={value} type="button" role="radio" aria-checked={mode === value} aria-label={label} onClick={() => setMode(value)}>
                                    <Icon aria-hidden="true" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        <Link href="/" className="ds-btn ds-btn--primary ds-btn--sm ds-nav__open">
                            Open the app
                        </Link>
                    </div>
                </div>
            </header>

            <div className="ds-shell">
                <nav className="ds-index" aria-label="Design system sections">
                    {INDEX.map((group) => (
                        <div key={group.group} className="ds-index__group">
                            <p>{group.group}</p>
                            {group.items.map((item) => (
                                <a key={item.id} href={`#${item.id}`} aria-current={activeId === item.id}>
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    ))}
                </nav>

                <main className="ds-main">
                    {/* Hero: the product's own UI is the visual */}
                    <section className="ds-hero" aria-labelledby="ds-title">
                        <div className="ds-hero__text">
                            <h1 id="ds-title">Scroll Maestro design system</h1>
                            <p className="lead">
                                Colours, type and components for the app that turns long videos into captioned short clips. Every token works in light and dark mode.
                            </p>
                            <div className="ds-facts">
                                <span className="ds-fact"><strong>1</strong> accent colour</span>
                                <span className="ds-fact"><strong>2</strong> typefaces</span>
                                <span className="ds-fact"><strong>3</strong> corner sizes</span>
                                <span className="ds-fact">Showing <strong>{resolved}</strong> mode</span>
                            </div>
                        </div>
                        <ClipTimeline />
                    </section>

                    {/* Colour */}
                    <section id="colour" className="ds-section">
                        <SectionHead title="Colour" text="The interface stays neutral so the videos carry the colour. Signal orange marks the one main action and the clips you keep." />
                        <div className="ds-swatches">
                            {PALETTE.map((c) => {
                                const hex = resolved === "dark" ? c.dark : c.light;
                                const ground = resolved === "dark" ? "#0E1424" : "#FFFFFF";
                                const ratio = c.token === "--bg" ? null : contrast(hex, ground);
                                const textOn = luminance(hex) > 0.35 ? "#1F2B4D" : "#FFFFFF";
                                return (
                                    <div key={c.token} className="ds-swatch">
                                        <div className="ds-swatch__chip" style={{ background: `var(${c.token})`, color: textOn }}>
                                            <span>Aa</span>
                                            {ratio ? <span className="tc">{ratio.toFixed(1)}:1</span> : null}
                                        </div>
                                        <div className="ds-swatch__meta">
                                            <strong>{c.name}</strong>
                                            <span className="label">{c.role}</span>
                                            <span className="ds-swatch__pair label">
                                                <span>Light <span className="tc">{c.light}</span></span>
                                                <span>Dark <span className="tc">{c.dark}</span></span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <h3 className="ds-sub">Status colours</h3>
                        <div className="ds-grid-3">
                            {STATUS.map((s) => {
                                const hex = resolved === "dark" ? s.dark : s.light;
                                const ratio = contrast(hex, resolved === "dark" ? "#0E1424" : "#FFFFFF");
                                return (
                                    <div key={s.token} className="ds-panel ds-stack">
                                        <span className={`ds-badge ds-badge--${s.name.toLowerCase()}`}>{s.name}</span>
                                        <span className="label">
                                            <span className="tc">{hex}</span>, {ratio.toFixed(1)}:1 on the page
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <h3 className="ds-sub">One system, two rooms</h3>
                        <div className="ds-theme-pair">
                            <div style={{ background: "#FFFFFF", color: "#1F2B4D" } as CSSProperties}>
                                <span className="label" style={{ color: "#646B81" }}>Light</span>
                                <h3 style={{ color: "#1F2B4D" }}>Navy ink on white paper</h3>
                                <p style={{ color: "#646B81" }}>For daytime editing and bright offices.</p>
                            </div>
                            <div style={{ background: "#0E1424", color: "#EEF0F6" } as CSSProperties}>
                                <span className="label" style={{ color: "#A3AAC0" }}>Dark</span>
                                <h3 style={{ color: "#EEF0F6" }}>The ink becomes the room</h3>
                                <p style={{ color: "#A3AAC0" }}>A deep navy, not black, so video frames keep their contrast.</p>
                            </div>
                        </div>
                    </section>

                    {/* Type */}
                    <section id="type" className="ds-section">
                        <SectionHead title="Type" text="Funnel Display sets headings, Funnel Sans sets everything people read. DM Mono appears only for timecodes, where digits must line up." />
                        <div>
                            {[
                                { name: "Display", spec: "Funnel Display 500, 64/66", el: <h1 style={{ fontSize: "var(--t-display)" }}>Turn one video into ten clips</h1> },
                                { name: "Heading", spec: "Funnel Display 500, 36/41", el: <h2>Clips ready to review</h2> },
                                { name: "Title", spec: "Funnel Display 500, 22/29", el: <h3>Why we doubled our prices</h3> },
                                { name: "Lead", spec: "Funnel Sans 400, 18/29", el: <p className="lead">Upload a video and get captioned clips back in minutes, sized for TikTok and YouTube Shorts.</p> },
                                { name: "Body", spec: "Funnel Sans 400, 16/26", el: <p style={{ maxWidth: "62ch" }}>Each clip keeps the full thought, from the setup to the point, so viewers never land mid-sentence.</p> },
                                { name: "Label", spec: "Funnel Sans 500, 13/18", el: <p className="label">Aspect ratio</p> },
                                { name: "Timecode", spec: "DM Mono 400, 13/18", el: <p className="tc">04:10–04:52</p> },
                            ].map((row) => (
                                <div key={row.name} className="ds-type-row">
                                    <div className="ds-type-row__meta">
                                        <strong className="small">{row.name}</strong>
                                        <span className="label">{row.spec}</span>
                                    </div>
                                    {row.el}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Spacing + radius */}
                    <section id="space" className="ds-section">
                        <SectionHead title="Spacing and radius" text="Ten spacing steps from 4 to 128 pixels. Corners grow with the size of the thing: controls 8, panels 12, frames 20." />
                        <div className="ds-grid-2">
                            <div className="ds-space">
                                {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map((px, i) => (
                                    <div key={px} className="ds-space__row">
                                        <span className="label">s-{i + 1}</span>
                                        <span className="tc">{px}px</span>
                                        <span className="ds-space__bar" style={{ width: `${(px / 128) * 100}%` }} />
                                    </div>
                                ))}
                            </div>
                            <div className="ds-grid-3" style={{ alignContent: "start" }}>
                                {[
                                    { r: 8, use: "Buttons, inputs" },
                                    { r: 12, use: "Panels, toasts" },
                                    { r: 20, use: "Video frames" },
                                ].map((x) => (
                                    <div key={x.r} className="ds-radius">
                                        <div className="ds-radius__box" style={{ borderRadius: x.r }} />
                                        <span className="small"><strong>{x.r}px</strong></span>
                                        <span className="label">{x.use}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Buttons */}
                    <section id="buttons" className="ds-section">
                        <SectionHead title="Buttons" text="One filled orange button per view, for the main action. Everything else is secondary, quiet or a text link. Labels say what happens." />
                        <div className="ds-stack">
                            <div className="ds-specimen">
                                <div className="ds-row">
                                    <button type="button" className="ds-btn ds-btn--primary">
                                        <Scissors aria-hidden="true" /> Find clips
                                    </button>
                                    <button type="button" className="ds-btn ds-btn--secondary">Change settings</button>
                                    <button type="button" className="ds-btn ds-btn--quiet">Cancel</button>
                                    <a className="link" href="#buttons">See caption styles</a>
                                </div>
                            </div>
                            <span className="label">Primary, secondary, quiet and a text link</span>

                            <div className="ds-specimen">
                                <div className="ds-row">
                                    <button type="button" className="ds-btn ds-btn--primary" disabled>
                                        <span className="ds-spinner" aria-hidden="true" /> Finding clips
                                    </button>
                                    <button type="button" className="ds-btn ds-btn--secondary" disabled>Change settings</button>
                                    <button type="button" className="ds-btn ds-btn--danger">
                                        <Trash2 aria-hidden="true" /> Delete video
                                    </button>
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--icon" aria-label="Schedule clip">
                                        <CalendarClock aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                            <span className="label">Working, disabled, destructive and icon-only</span>
                        </div>
                    </section>

                    {/* Forms */}
                    <section id="forms" className="ds-section">
                        <SectionHead title="Form controls" text="Fields are 44 pixels tall with the label above. Limits appear before someone hits them, and errors say how to fix the problem." />
                        <div className="ds-grid-2">
                            <div className="ds-stack">
                                <div className="ds-field">
                                    <span className="ds-field__label" id="mode-label">What should we make?</span>
                                    <div className="ds-seg-ctl ds-seg-ctl--full" role="radiogroup" aria-labelledby="mode-label">
                                        <button type="button" role="radio" aria-checked={mode2 === "clips"} onClick={() => setMode2("clips")}>Short clips</button>
                                        <button type="button" role="radio" aria-checked={mode2 === "full"} onClick={() => setMode2("full")}>Captioned full video</button>
                                    </div>
                                </div>
                                <div
                                    className="ds-drop"
                                    data-over={dragOver}
                                    role="button"
                                    tabIndex={0}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOver(false);
                                    }}
                                >
                                    <span className="ds-drop__icon"><Upload aria-hidden="true" size={20} /></span>
                                    <strong>Drop a video or choose a file</strong>
                                    <span className="label">MP4, MOV or WebM, up to 300 MB and 45 minutes</span>
                                </div>
                                <label className="ds-switch">
                                    <span className="ds-stack" style={{ gap: 2 }}>
                                        <strong className="small">Burn captions into clips</strong>
                                        <span className="label">Captions stay visible when the platform hides subtitles.</span>
                                    </span>
                                    <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
                                    <span className="ds-switch__track" aria-hidden="true" />
                                </label>
                            </div>
                            <div className="ds-stack">
                                <div className="ds-field">
                                    <label htmlFor="ds-directive">Clip directive</label>
                                    <textarea id="ds-directive" className="ds-textarea" placeholder="Find the moments where we talk about pricing" />
                                    <span className="ds-field__hint">Optional. Leave empty and we pick the strongest moments.</span>
                                </div>
                                <div className="ds-grid-2" style={{ gap: "var(--s-4)" }}>
                                    <div className="ds-field">
                                        <label htmlFor="ds-ratio">Aspect ratio</label>
                                        <select id="ds-ratio" className="ds-select" defaultValue="9:16">
                                            <option value="9:16">Vertical 9:16</option>
                                            <option value="1:1">Square 1:1</option>
                                            <option value="16:9">Landscape 16:9</option>
                                        </select>
                                    </div>
                                    <div className="ds-field">
                                        <label htmlFor="ds-style">Caption style</label>
                                        <select id="ds-style" className="ds-select" defaultValue="karaoke">
                                            <option value="karaoke">Karaoke</option>
                                            <option value="highlight">Highlight</option>
                                            <option value="minimal">Minimal</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="ds-field">
                                    <label htmlFor="ds-title-input">Clip title</label>
                                    <input id="ds-title-input" className="ds-input" defaultValue="" placeholder="Name this clip" aria-invalid="true" aria-describedby="ds-title-error" />
                                    <span id="ds-title-error" className="ds-field__error">Add a title so you can find this clip in the calendar.</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Feedback */}
                    <section id="feedback" className="ds-section">
                        <SectionHead title="Status and feedback" text="Every video shows where it is in the pipeline. Messages name what happened and what to do next, in the same words as the button that started it." />
                        <div className="ds-stack">
                            <div className="ds-row">
                                <span className="ds-badge">Uploading</span>
                                <span className="ds-badge ds-badge--processing">Processing</span>
                                <span className="ds-badge ds-badge--ready">Ready</span>
                                <span className="ds-badge ds-badge--scheduled">Scheduled</span>
                                <span className="ds-badge ds-badge--failed">Failed</span>
                            </div>

                            <div className="ds-panel ds-stack">
                                <div className="ds-row" style={{ justifyContent: "space-between" }}>
                                    <h4>Founder podcast, episode 42</h4>
                                    <span className="label">About 3 minutes left</span>
                                </div>
                                <ol className="ds-steps" aria-label="Processing steps">
                                    <li data-state="done">Upload</li>
                                    <li data-state="done">Transcribe</li>
                                    <li data-state="active" style={{ "--p": "62%" } as CSSProperties}>Find highlights</li>
                                    <li>Render clips</li>
                                </ol>
                            </div>

                            <div className="ds-grid-2">
                                <div className="ds-toast ds-toast--success" role="status">
                                    <span className="ds-toast__icon"><Check aria-hidden="true" /></span>
                                    <div>
                                        <p><strong>Clip scheduled</strong></p>
                                        <p className="small muted">Posts to TikTok on Tuesday 14 November at 18:00.</p>
                                    </div>
                                    <button type="button" className="ds-btn ds-btn--quiet ds-btn--sm">Undo</button>
                                </div>
                                <div className="ds-toast ds-toast--error" role="alert">
                                    <span className="ds-toast__icon"><AlertCircle aria-hidden="true" /></span>
                                    <div>
                                        <p><strong>Upload stopped</strong></p>
                                        <p className="small muted">The connection dropped at 64%. Your credit was not used.</p>
                                    </div>
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm">Retry upload</button>
                                </div>
                            </div>

                            <div className="ds-empty">
                                <Mark />
                                <h3>No projects yet</h3>
                                <p className="muted" style={{ maxWidth: "44ch" }}>Upload a video and your clips appear here, ready to review and schedule.</p>
                                <button type="button" className="ds-btn ds-btn--primary">
                                    <Upload aria-hidden="true" /> Upload a video
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Clips */}
                    <section id="clips" className="ds-section">
                        <SectionHead title="Clips and captions" text="Clips show in a 9:16 frame with their timecode. The three caption styles render the same words, so people choose by look, not by name." />
                        <div className="ds-grid-3 ds-clipgrid">
                            {(["karaoke", "highlight", "minimal"] as const).map((style, i) => (
                                <a key={style} href="#clips" className="ds-clipcard">
                                    <div className="ds-frame">
                                        <div className="ds-frame__scene"><StudioScene tone={i} /></div>
                                        <span className="ds-frame__time tc">{timecode(CLIPS[i]!.end - CLIPS[i]!.start)}</span>
                                        <Caption style={style} words={CLIPS[i]!.words} />
                                    </div>
                                    <div className="ds-clipcard__meta">
                                        <h4>{CLIPS[i]!.title}</h4>
                                        <span className="label">{style[0]!.toUpperCase() + style.slice(1)} captions</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </section>

                    {/* Schedule */}
                    <section id="schedule" className="ds-section">
                        <SectionHead title="Schedule list" text="Scheduled posts read as a list in time order: the clip, where it goes, when, and its state." />
                        <div className="ds-list">
                            {[
                                { clip: 0, platform: "TikTok", when: "Tue 14 Nov, 18:00", status: "scheduled", label: "Scheduled" },
                                { clip: 1, platform: "YouTube Shorts", when: "Wed 15 Nov, 12:30", status: "processing", label: "Publishing" },
                                { clip: 2, platform: "TikTok", when: "Mon 13 Nov, 09:15", status: "ready", label: "Published" },
                                { clip: 0, platform: "YouTube Shorts", when: "Sun 12 Nov, 20:00", status: "failed", label: "Failed" },
                            ].map((row, i) => (
                                <div key={i} className="ds-list__row">
                                    <div className="ds-list__thumb"><StudioScene tone={row.clip} /></div>
                                    <div className="ds-list__text">
                                        <strong>{CLIPS[row.clip]!.title}</strong>
                                        <span className="label">{row.when}</span>
                                    </div>
                                    <span className="ds-platform">{row.platform}</span>
                                    <span className={`ds-badge ds-badge--${row.status}`}>{row.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>

            <footer className="ds-footer">
                <div className="ds-footer__inner">
                    <span className="ds-brand" style={{ fontSize: 16 }}>
                        <Mark /> Scroll Maestro
                    </span>
                    <span className="label">Design system, version 1. Tokens live in designsystem.css.</span>
                </div>
            </footer>
        </div>
    );
}
