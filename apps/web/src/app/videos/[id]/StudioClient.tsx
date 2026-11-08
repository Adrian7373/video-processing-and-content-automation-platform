"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import AuthGateModal from "../../components/AuthGateModal";
import PlatformIcon, { PLATFORM_LABEL, type SocialPlatformType } from "../../components/PlatformIcon";
import PostDetailsModal, { type PostDetails } from "../../components/PostDetailsModal";
import { PLATFORM_COLOR, STATUS_BADGE, badgeBase, ui } from "@/lib/ui";

export type { SocialPlatformType };

export type PublishStatusType =
    | "SCHEDULED"
    | "PUBLISHING"
    | "PUBLISHED"
    | "FAILED"
    | "CANCELLED";

type ScheduledPost = {
    id: string;
    status: PublishStatusType;
    scheduledFor: string;
    caption: string;
    publishedUrl?: string | null;
    errorMessage?: string | null;
    failureCode?: string | null;
    socialAccount: {
        id?: string;
        platform: SocialPlatformType;
        accountName: string;
    };
};

type Segment = {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    keyPoints: string[];
    thumbnailText: string | null;
    socialCaption: string | null;
    clipUrl: string | null;
    captionedClipUrl: string | null;
    thumbnailUrl: string | null;
    scheduledPosts: ScheduledPost[];
};

type Video = {
    id: string;
    title: string;
    status: "UPLOADING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    aspectRatio: "VERTICAL_9_16" | "LANDSCAPE_16_9" | "SQUARE_1_1";
    errorMessage?: string | null;
    segments: Segment[];
};

interface SocialAccountOption {
    id: string;
    platform: SocialPlatformType;
    accountName: string;
}

const QUICK_TIMES = ["09:00", "12:00", "18:00", "21:00"] as const;

const RATIO_LABEL: Record<Video["aspectRatio"], string> = {
    VERTICAL_9_16: "9:16",
    SQUARE_1_1: "1:1",
    LANDSCAPE_16_9: "16:9",
};

const FRAME_CLASS: Record<Video["aspectRatio"], string> = {
    VERTICAL_9_16: "aspect-[9/16] h-[min(48vh,560px)]",
    SQUARE_1_1: "aspect-square w-full max-w-[min(48vh,520px)]",
    LANDSCAPE_16_9: "aspect-video w-full",
};

function seconds(value: string) {
    const parts = value.split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    return parts.length === 2 ? parts[0]! * 60 + parts[1]! : Number(value);
}

function timecode(totalSeconds: number) {
    const total = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function clipLength(segment: Segment) {
    const total = Math.max(0, Math.round(seconds(segment.endTime) - seconds(segment.startTime)));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function activePosts(segment: Segment) {
    return segment.scheduledPosts.filter((p) => p.status !== "CANCELLED");
}

/* ------------------------------------------------------------------ */
/* Scheduling logic shared by the inspector tab and the modal          */
/* ------------------------------------------------------------------ */

function useScheduler(segment: Segment, onSaved: () => void, onSuccess?: () => void) {
    const [accounts, setAccounts] = useState<SocialAccountOption[] | null>(null);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [caption, setCaption] = useState(segment.socialCaption || `${segment.title} #shorts #reels #tiktok`);
    const [dateString, setDateString] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [timeString, setTimeString] = useState("18:00");
    const [isScheduling, setIsScheduling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [captionFor, setCaptionFor] = useState(segment.id);

    // Reset the caption when a different clip is selected (render-time sync, no effect).
    if (captionFor !== segment.id) {
        setCaptionFor(segment.id);
        setCaption(segment.socialCaption || `${segment.title} #shorts #reels #tiktok`);
        setError(null);
    }

    useEffect(() => {
        let mounted = true;
        fetch("/api/integrations/accounts", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { accounts?: SocialAccountOption[] } | null) => {
                if (!mounted) return;
                const list = data?.accounts ?? [];
                setAccounts(list);
                if (list[0]) setSelectedAccountIds([list[0].id]);
            })
            .catch(() => mounted && setAccounts([]));
        return () => {
            mounted = false;
        };
    }, []);

    const toggleAccountSelection = (accountId: string) => {
        setError(null);
        setSelectedAccountIds((prev) => (prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]));
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (selectedAccountIds.length === 0) {
            setError("Choose at least one account to post to.");
            return;
        }
        const scheduled = new Date(`${dateString}T${timeString}:00`);
        if (Number.isNaN(scheduled.getTime())) {
            setError("Choose a valid date and time.");
            return;
        }

        setIsScheduling(true);
        try {
            const response = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    segmentId: segment.id,
                    socialAccountIds: selectedAccountIds,
                    scheduledFor: scheduled.toISOString(),
                    caption,
                }),
            });
            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as { error?: string };
                throw new Error(errorData.error || "The clip could not be scheduled. Try again.");
            }
            onSaved();
            onSuccess?.();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "The clip could not be scheduled. Try again.");
        } finally {
            setIsScheduling(false);
        }
    };

    return {
        accounts,
        selectedAccountIds,
        toggleAccountSelection,
        caption,
        setCaption,
        dateString,
        setDateString,
        timeString,
        setTimeString,
        isScheduling,
        error,
        handleScheduleSubmit,
    };
}

function ScheduleFields({ scheduler }: { scheduler: ReturnType<typeof useScheduler> }) {
    const { accounts, selectedAccountIds, toggleAccountSelection, caption, setCaption, dateString, setDateString, timeString, setTimeString, error } = scheduler;
    return (
        <div className="space-y-5">
            <fieldset>
                <legend className={ui.label}>Post to</legend>
                {accounts === null ? (
                    <div className="h-9 animate-pulse rounded-lg bg-surface" />
                ) : accounts.length === 0 ? (
                    <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
                        No accounts connected yet.{" "}
                        <Link href="/channels" className="font-medium text-link underline underline-offset-2">
                            Connect an account
                        </Link>{" "}
                        to schedule posts.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {accounts.map((acc) => (
                            <button key={acc.id} type="button" aria-pressed={selectedAccountIds.includes(acc.id)} onClick={() => toggleAccountSelection(acc.id)} className={ui.chip(selectedAccountIds.includes(acc.id))}>
                                <PlatformIcon platform={acc.platform} className={`h-4 w-4 ${PLATFORM_COLOR[acc.platform]}`} />
                                <span className="max-w-[16ch] truncate">{acc.accountName}</span>
                            </button>
                        ))}
                    </div>
                )}
            </fieldset>

            <div>
                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className={ui.label}>Date</span>
                        <input type="date" required value={dateString} onChange={(e) => setDateString(e.target.value)} className={ui.input} />
                    </label>
                    <label className="block">
                        <span className={ui.label}>Time</span>
                        <input type="time" required value={timeString} onChange={(e) => setTimeString(e.target.value)} className={ui.input} />
                    </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common posting times">
                    {QUICK_TIMES.map((time) => (
                        <button key={time} type="button" aria-pressed={timeString === time} onClick={() => setTimeString(time)} className={`${ui.chip(timeString === time)} h-8 px-2.5 tabular-nums`}>
                            {time}
                        </button>
                    ))}
                </div>
            </div>

            <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] font-medium">Caption</span>
                    <span className="text-[13px] tabular-nums text-muted">{caption.length} / 2200</span>
                </span>
                <textarea rows={4} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} className={ui.textarea} />
            </label>

            {error && (
                <p role="alert" className="text-sm font-medium text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}

function scheduleLabel(scheduler: ReturnType<typeof useScheduler>) {
    if (scheduler.isScheduling) return "Scheduling";
    return scheduler.selectedAccountIds.length > 1 ? `Schedule to ${scheduler.selectedAccountIds.length} accounts` : "Schedule post";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StudioClient({ videoId }: { videoId: string }) {
    const [video, setVideo] = useState<Video | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [captioned, setCaptioned] = useState(true);
    const [tab, setTab] = useState<"details" | "schedule">("details");
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await fetch(`/api/videos/${videoId}`, { cache: "no-store" });
            if (!response.ok) throw new Error(response.status === 404 ? "This video does not exist or belongs to another account." : "The video could not be loaded.");
            const data = (await response.json()) as Video;
            data.segments.sort((a, b) => seconds(a.startTime) - seconds(b.startTime));
            setVideo(data);
            setActiveId((current) => current ?? data.segments[0]?.id ?? null);
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "The video could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        fetch("/api/credits", { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: { isAnonymous?: boolean } | null) => {
                if (data) setIsAnonymous(data.isAnonymous ?? true);
            })
            .catch(() => setIsAnonymous(true));
    }, []);

    useEffect(() => {
        if (!video || (video.status !== "PROCESSING" && video.status !== "QUEUED" && video.status !== "UPLOADING")) return;
        const interval = window.setInterval(() => void load(), 4000);
        return () => window.clearInterval(interval);
    }, [load, video]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setScheduleOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const active = useMemo(() => video?.segments.find((s) => s.id === activeId) ?? video?.segments[0], [activeId, video]);

    const openSchedule = () => {
        if (isAnonymous) {
            setShowAuthModal(true);
            return;
        }
        setScheduleOpen(true);
    };

    const retry = async () => {
        setRetrying(true);
        try {
            const response = await fetch(`/api/videos/${videoId}/retry`, { method: "POST" });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(payload.error ?? "The video could not be retried.");
            window.dispatchEvent(new Event("vr:credits-updated"));
            await load();
        } catch (retryError) {
            setError(retryError instanceof Error ? retryError.message : "The video could not be retried.");
        } finally {
            setRetrying(false);
        }
    };

    if (loading) return <StudioSkeleton />;

    if (error || !video) {
        return (
            <StatusScreen title="This video could not be opened" body={error ?? "The video could not be loaded."}>
                <Link href="/videos" className={ui.btnSecondary}>
                    Back to my projects
                </Link>
            </StatusScreen>
        );
    }

    if (video.status === "FAILED") {
        return (
            <StatusScreen
                title={video.title}
                badge={<span className={`${badgeBase} bg-danger/12 text-danger`}>Failed</span>}
                body={`${video.errorMessage || "Processing stopped before any clips were made."} Your credit was refunded. Retrying uses 1 credit.`}
            >
                <button type="button" onClick={() => void retry()} disabled={retrying} className={ui.btnPrimary}>
                    {retrying ? "Retrying" : "Retry processing"}
                </button>
                <Link href="/videos" className={ui.btnSecondary}>
                    Back to my projects
                </Link>
            </StatusScreen>
        );
    }

    if (video.status !== "COMPLETED") {
        return (
            <StatusScreen
                title={video.title}
                badge={<span className={`${badgeBase} bg-action/18 text-ink before:animate-pulse`}>{video.status === "PROCESSING" ? "Processing" : "Queued"}</span>}
                body="We are transcribing the video, finding its strongest moments and rendering the clips. Most videos take a few minutes. This page updates by itself."
            >
                <div className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-line-strong" aria-hidden="true">
                    <div className="h-full w-1/3 animate-[sm-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-action" />
                </div>
            </StatusScreen>
        );
    }

    if (!active) {
        return (
            <StatusScreen title={video.title} body="Processing finished, but no clips were found in this video. Try again with a clip directive, or caption the full video instead.">
                <Link href="/" className={ui.btnPrimary}>
                    Upload a video
                </Link>
            </StatusScreen>
        );
    }

    const scheduledTotal = video.segments.reduce((acc, seg) => acc + activePosts(seg).length, 0);
    const source = captioned && active.captionedClipUrl ? active.captionedClipUrl : active.clipUrl;
    const activeIndex = video.segments.findIndex((s) => s.id === active.id);

    return (
        <main className="bg-page text-ink">
            {/* Header */}
            <header className="px-4 pt-5 sm:px-6">
                <Link href="/videos" className="inline-flex items-center gap-1 rounded text-sm text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
                    My projects
                </Link>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <h1 className={`${ui.h1} max-w-[40ch] text-balance text-[28px]`}>{video.title}</h1>
                    <p className="text-sm text-muted">
                        {video.segments.length} {video.segments.length === 1 ? "clip" : "clips"}, {RATIO_LABEL[video.aspectRatio]}
                        {scheduledTotal > 0 ? `, ${scheduledTotal} scheduled` : ""}
                    </p>
                </div>
            </header>

            {/* Source ruler: where each clip was cut from the original video */}
            <SourceRuler segments={video.segments} activeId={active.id} onSelect={setActiveId} />

            <div className="grid gap-6 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_352px]">
                {/* Clip list */}
                <nav aria-label="Clips from this video" className="lg:row-span-2 xl:row-span-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
                    <ol className="max-h-[340px] space-y-1 overflow-y-auto lg:max-h-none">
                        {video.segments.map((segment, index) => {
                            const selected = segment.id === active.id;
                            const queued = activePosts(segment).length;
                            return (
                                <li key={segment.id}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveId(segment.id)}
                                        aria-current={selected ? "true" : undefined}
                                        className={`flex w-full gap-3 rounded-lg p-2 text-left transition ${ui.focusRing} ${selected ? "bg-surface shadow-[inset_2px_0_0_var(--sm-action)]" : "hover:bg-surface"}`}
                                    >
                                        <div className="relative h-16 w-9 shrink-0 overflow-hidden rounded-md bg-frame">
                                            {segment.thumbnailUrl && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={segment.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] tabular-nums text-muted">
                                                <span className={`font-semibold ${selected ? "text-ink" : ""}`}>{index + 1}</span>
                                                <span className="mx-1.5">{timecode(seconds(segment.startTime))}</span>
                                                {clipLength(segment)}
                                            </p>
                                            <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{segment.title}</p>
                                            {queued > 0 && <p className="mt-0.5 text-[13px] text-info">Scheduled {queued}×</p>}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                {/* Stage */}
                <section aria-label="Clip preview" className="min-w-0">
                    <div className="flex justify-center rounded-[20px] bg-surface p-4">
                        <div className={`overflow-hidden rounded-xl bg-frame ${FRAME_CLASS[video.aspectRatio]} max-w-full`}>
                            <video key={source ?? "empty"} controls preload="metadata" poster={active.thumbnailUrl ?? undefined} className="h-full w-full object-contain" src={source ?? undefined} />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[13px] tabular-nums text-muted">
                                Clip {activeIndex + 1} of {video.segments.length}, {timecode(seconds(active.startTime))}–{timecode(seconds(active.endTime))}
                            </p>
                            <h2 className={`${ui.h2} mt-0.5`}>{active.title}</h2>
                        </div>
                        {active.captionedClipUrl && (
                            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                                Burned-in captions
                                <input type="checkbox" className="peer sr-only" checked={captioned} onChange={(e) => setCaptioned(e.target.checked)} />
                                <span aria-hidden="true" className="relative h-6 w-10 shrink-0 rounded-full bg-line-strong transition after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-action peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-page" />
                            </label>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={openSchedule} className={ui.btnPrimary}>
                            Schedule clip
                        </button>
                        <a href={source ?? undefined} download aria-disabled={!source} className={`${ui.btnSecondary} ${source ? "" : "pointer-events-none opacity-45"}`}>
                            Download MP4
                        </a>
                        <CopyButton text={active.socialCaption ?? active.title} label="Copy caption" />
                    </div>
                </section>

                {/* Inspector */}
                <aside aria-label="Clip details and schedule" className="min-w-0 lg:col-start-2 xl:col-start-auto">
                    <div role="tablist" aria-label="Clip panels" className={ui.segTrack}>
                        <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")} className={ui.segOption(tab === "details")}>
                            Details
                        </button>
                        <button type="button" role="tab" aria-selected={tab === "schedule"} onClick={() => setTab("schedule")} className={ui.segOption(tab === "schedule")}>
                            Schedule
                            {activePosts(active).length > 0 && <span className="tabular-nums text-muted">{activePosts(active).length}</span>}
                        </button>
                    </div>
                    <div className="mt-5">
                        {tab === "details" ? (
                            <DetailsPanel key={active.id} segment={active} onSaved={load} />
                        ) : (
                            <SchedulePanel segment={active} onSaved={load} isAnonymous={isAnonymous} onNeedAuth={() => setShowAuthModal(true)} />
                        )}
                    </div>
                </aside>
            </div>

            {scheduleOpen && <ScheduleModal segment={active} aspectRatio={video.aspectRatio} onClose={() => setScheduleOpen(false)} onSaved={load} />}

            {showAuthModal && (
                <AuthGateModal
                    reasonMessage="Sign in to schedule posts. You will also connect the accounts you post to."
                    onClose={() => setShowAuthModal(false)}
                    onSuccess={() => {
                        setShowAuthModal(false);
                        window.location.reload();
                    }}
                />
            )}
        </main>
    );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SourceRuler({ segments, activeId, onSelect }: { segments: Segment[]; activeId: string; onSelect: (id: string) => void }) {
    const end = Math.max(1, ...segments.map((s) => seconds(s.endTime)));
    const pct = (value: number) => (value / end) * 100;
    if (segments.length < 2) return null;

    return (
        <div className="px-4 pt-5 sm:px-6">
            <div className="rounded-xl border border-line bg-raised px-4 pb-3 pt-7">
                <div className="relative h-9 rounded-md bg-surface">
                    {segments.map((segment, index) => {
                        const left = pct(seconds(segment.startTime));
                        const width = Math.max(pct(seconds(segment.endTime)) - left, 1.2);
                        const selected = segment.id === activeId;
                        return (
                            <button
                                key={segment.id}
                                type="button"
                                onClick={() => onSelect(segment.id)}
                                aria-label={`Clip ${index + 1}: ${segment.title}, ${timecode(seconds(segment.startTime))} to ${timecode(seconds(segment.endTime))}`}
                                aria-pressed={selected}
                                style={{ left: `${left}%`, width: `${width}%` }}
                                className={`absolute inset-y-0 min-w-[14px] rounded-md transition ${ui.focusRing} ${selected ? "bg-action shadow-[0_0_0_2px_var(--sm-raised),0_0_0_4px_var(--sm-action)]" : "bg-action/35 hover:bg-action/60 dark:bg-action/55 dark:hover:bg-action/75"}`}
                            >
                                <span className={`absolute -top-6 left-0 text-[13px] font-semibold tabular-nums ${selected ? "text-ink" : "text-muted"}`}>{index + 1}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-between text-[13px] tabular-nums text-muted" aria-hidden="true">
                    <span>00:00</span>
                    <span>{timecode(end / 2)}</span>
                    <span>{timecode(end)}</span>
                </div>
            </div>
        </div>
    );
}

function CopyButton({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                } catch {
                    // Clipboard blocked; nothing to undo.
                }
            }}
            className={ui.btnSecondary}
        >
            <span aria-live="polite">{copied ? "Copied" : label}</span>
        </button>
    );
}

function DetailsPanel({ segment, onSaved }: { segment: Segment; onSaved: () => void }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(segment.title);
    const [thumbnailText, setThumbnailText] = useState(segment.thumbnailText ?? "");
    const [socialCaption, setSocialCaption] = useState(segment.socialCaption ?? "");
    const [keyPoints, setKeyPoints] = useState(segment.keyPoints.join("\n"));
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    async function save() {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setSaveError("Add a title before saving.");
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            const response = await fetch(`/api/segments/${segment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: trimmedTitle,
                    thumbnailText: thumbnailText || null,
                    socialCaption: socialCaption || null,
                    keyPoints: keyPoints.split("\n").map((p) => p.trim()).filter(Boolean),
                }),
            });
            if (!response.ok) throw new Error();
            setEditing(false);
            onSaved();
        } catch {
            setSaveError("The changes could not be saved. Try again.");
        } finally {
            setSaving(false);
        }
    }

    if (editing) {
        return (
            <div className="space-y-4">
                <label className="block">
                    <span className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-[13px] font-medium">Title</span>
                        <span className="text-[13px] tabular-nums text-muted">{title.length} / 100</span>
                    </span>
                    <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} className={ui.input} />
                    <span className={ui.hint}>Used as the video title on YouTube.</span>
                </label>
                <label className="block">
                    <span className={ui.label}>Thumbnail text</span>
                    <input value={thumbnailText} placeholder="A short hook, like WAIT FOR IT" onChange={(e) => setThumbnailText(e.target.value)} className={ui.input} />
                </label>
                <label className="block">
                    <span className={ui.label}>Caption</span>
                    <textarea value={socialCaption} onChange={(e) => setSocialCaption(e.target.value)} rows={4} className={ui.textarea} />
                </label>
                <label className="block">
                    <span className={ui.label}>Key points</span>
                    <textarea value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} rows={4} className={ui.textarea} />
                    <span className={ui.hint}>One point per line.</span>
                </label>
                {saveError && (
                    <p role="alert" className="text-sm font-medium text-danger">
                        {saveError}
                    </p>
                )}
                <div className="flex gap-2">
                    <button type="button" onClick={() => void save()} disabled={saving} className={ui.btnPrimarySm}>
                        {saving ? "Saving" : "Save changes"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className={ui.btnQuiet}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {segment.thumbnailText && (
                <div>
                    <p className="text-[13px] font-medium text-muted">Thumbnail text</p>
                    <p className="mt-1 font-display text-lg font-medium tracking-[-0.01em]">{segment.thumbnailText}</p>
                </div>
            )}

            <div>
                <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-muted">Caption</p>
                    {segment.socialCaption && <CopyMini text={segment.socialCaption} />}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{segment.socialCaption || "No caption yet."}</p>
            </div>

            {segment.keyPoints.length > 0 && (
                <div>
                    <p className="text-[13px] font-medium text-muted">Key points</p>
                    <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                        {segment.keyPoints.map((point) => (
                            <li key={point} className="flex gap-2.5">
                                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-action" aria-hidden="true" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <button type="button" onClick={() => setEditing(true)} className={ui.btnSecondarySm}>
                Edit details
            </button>
        </div>
    );
}

function CopyMini({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                } catch {
                    // Clipboard blocked.
                }
            }}
            className="rounded text-[13px] font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

function SchedulePanel({ segment, onSaved, isAnonymous, onNeedAuth }: { segment: Segment; onSaved: () => void; isAnonymous: boolean; onNeedAuth: () => void }) {
    const scheduler = useScheduler(segment, onSaved);
    const posts = activePosts(segment).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    const [openPostId, setOpenPostId] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const openPost = posts.find((p) => p.id === openPostId) ?? null;

    const closeModal = () => {
        setOpenPostId(null);
        setModalError(null);
    };

    const handleModalRemove = async (post: PostDetails) => {
        setModalError(null);
        try {
            const response = await fetch(`/api/schedule/${post.id}`, { method: "DELETE" });
            if (!response.ok) throw new Error();
            closeModal();
            onSaved();
        } catch {
            setModalError("The post could not be removed. Try again.");
        }
    };

    const handleModalRetry = async (post: PostDetails) => {
        setRetrying(true);
        setModalError(null);
        try {
            const response = await fetch(`/api/schedule/${post.id}/retry`, { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(data.error ?? "The post could not be retried. Try again.");
            closeModal();
            onSaved();
        } catch (error) {
            setModalError(error instanceof Error ? error.message : "The post could not be retried. Try again.");
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="space-y-6">
            {openPost && (
                <PostDetailsModal
                    post={{
                        id: openPost.id,
                        segmentTitle: segment.title,
                        platform: openPost.socialAccount.platform,
                        accountName: openPost.socialAccount.accountName,
                        caption: openPost.caption,
                        scheduledFor: openPost.scheduledFor,
                        status: openPost.status,
                        publishedUrl: openPost.publishedUrl,
                        errorMessage: openPost.errorMessage,
                        failureCode: openPost.failureCode,
                    }}
                    busy={retrying}
                    error={modalError}
                    onClose={closeModal}
                    onRemove={(post) => void handleModalRemove(post)}
                    onRetry={(post) => void handleModalRetry(post)}
                />
            )}
            <div>
                <p className="text-[13px] font-medium text-muted">Scheduled posts</p>
                {posts.length === 0 ? (
                    <p className="mt-1.5 text-sm text-muted">This clip is not scheduled anywhere yet.</p>
                ) : (
                    <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                        {posts.map((post) => (
                            <li key={post.id} className="relative flex items-center gap-3 px-3 py-2.5 transition hover:bg-surface">
                                <PlatformIcon platform={post.socialAccount.platform} className={`h-4 w-4 shrink-0 ${PLATFORM_COLOR[post.socialAccount.platform]}`} />
                                <button
                                    type="button"
                                    onClick={() => setOpenPostId(post.id)}
                                    aria-label={`View details for the ${format(parseISO(post.scheduledFor), "EEE d MMM, HH:mm")} post to ${post.socialAccount.accountName}`}
                                    className={`min-w-0 flex-1 rounded text-left before:absolute before:inset-0 ${ui.focusRing}`}
                                >
                                    <span className="block truncate text-sm font-medium">{post.socialAccount.accountName || PLATFORM_LABEL[post.socialAccount.platform].label}</span>
                                    <span className="block text-[13px] tabular-nums text-muted">{format(parseISO(post.scheduledFor), "EEE d MMM, HH:mm")}</span>
                                </button>
                                {post.status === "PUBLISHED" && post.publishedUrl ? (
                                    <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" className="relative text-[13px] font-medium text-link underline-offset-2 hover:underline">
                                        View post
                                    </a>
                                ) : (
                                    <span className={`${badgeBase} ${STATUS_BADGE[post.status].className}`}>{STATUS_BADGE[post.status].label}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {isAnonymous ? (
                <div className="rounded-lg border border-line bg-surface p-4">
                    <p className="text-sm font-semibold">Sign in to schedule</p>
                    <p className="mt-0.5 text-sm text-muted">Scheduling needs an account and a connected social account.</p>
                    <button type="button" onClick={onNeedAuth} className={`${ui.btnSecondarySm} mt-3`}>
                        Sign in
                    </button>
                </div>
            ) : (
                <form onSubmit={scheduler.handleScheduleSubmit} className="space-y-5 border-t border-line pt-5">
                    <p className="text-[13px] font-medium text-muted">Schedule this clip</p>
                    <ScheduleFields scheduler={scheduler} />
                    <button type="submit" disabled={scheduler.isScheduling || scheduler.accounts?.length === 0} className={`${ui.btnSecondary} w-full`}>
                        {scheduleLabel(scheduler)}
                    </button>
                </form>
            )}
        </div>
    );
}

function ScheduleModal({ segment, aspectRatio, onClose, onSaved }: { segment: Segment; aspectRatio: Video["aspectRatio"]; onClose: () => void; onSaved: () => void }) {
    const scheduler = useScheduler(segment, onSaved, onClose);
    const previewSource = segment.captionedClipUrl ?? segment.clipUrl;

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className={ui.modalBackdrop}>
            <div className={`${ui.modal} max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto`}>
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                    <div className="min-w-0">
                        <h2 id="schedule-title" className={ui.h2}>Schedule a clip</h2>
                        <p className="mt-0.5 truncate text-sm text-muted">{segment.title}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className={ui.btnIcon}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={scheduler.handleScheduleSubmit} className="grid gap-6 p-6 sm:grid-cols-[168px_minmax(0,1fr)]">
                    <div className="hidden sm:block">
                        <div className="aspect-[9/16] overflow-hidden rounded-xl bg-frame">
                            {previewSource ? (
                                <video src={previewSource} poster={segment.thumbnailUrl ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
                            ) : null}
                        </div>
                        <p className="mt-2 text-[13px] text-muted">
                            <span className="tabular-nums">{clipLength(segment)}</span>, {RATIO_LABEL[aspectRatio]}
                        </p>
                    </div>
                    <div className="space-y-5">
                        <ScheduleFields scheduler={scheduler} />
                        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                            <button type="button" onClick={onClose} disabled={scheduler.isScheduling} className={ui.btnSecondary}>
                                Cancel
                            </button>
                            <button type="submit" disabled={scheduler.isScheduling || scheduler.accounts?.length === 0} className={ui.btnPrimary}>
                                {scheduleLabel(scheduler)}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function StatusScreen({ title, badge, body, children }: { title: string; badge?: React.ReactNode; body: string; children?: React.ReactNode }) {
    return (
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-page px-6 py-16 text-ink">
            <div className="w-full max-w-lg">
                {badge}
                <h1 className={`${ui.h1} mt-3`}>{title}</h1>
                <p className="mt-3 text-base leading-relaxed text-muted">{body}</p>
                {children && <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>}
            </div>
        </main>
    );
}

function StudioSkeleton() {
    return (
        <main className="animate-pulse bg-page px-4 pt-5 sm:px-6" aria-busy="true" aria-label="Loading the studio">
            <div className="h-4 w-24 rounded bg-surface" />
            <div className="mt-3 h-8 w-80 max-w-full rounded-lg bg-surface" />
            <div className="mt-5 h-20 rounded-xl bg-surface" />
            <div className="mt-6 grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_352px]">
                <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="h-20 rounded-lg bg-surface" />
                    ))}
                </div>
                <div className="h-[60vh] rounded-[20px] bg-surface" />
                <div className="hidden h-[60vh] rounded-xl bg-surface xl:block" />
            </div>
        </main>
    );
}
