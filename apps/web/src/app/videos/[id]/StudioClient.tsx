"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

export type SocialPlatformType =
    | "YOUTUBE_SHORTS"
    | "TIKTOK"
    | "INSTAGRAM_REELS"
    | "FACEBOOK_REELS";

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
    status: "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";
    aspectRatio: "VERTICAL_9_16" | "LANDSCAPE_16_9" | "SQUARE_1_1";
    segments: Segment[];
};

interface SocialAccountOption {
    id: string;
    platform: SocialPlatformType;
    accountName: string;
}

const DEFAULT_DEMO_ACCOUNTS: SocialAccountOption[] = [
    { id: "demo-yt", platform: "YOUTUBE_SHORTS", accountName: "YouTube Shorts" },
    { id: "demo-tt", platform: "TIKTOK", accountName: "TikTok Creator" },
    { id: "demo-ig", platform: "INSTAGRAM_REELS", accountName: "Instagram Reels" },
    { id: "demo-fb", platform: "FACEBOOK_REELS", accountName: "Facebook Reels" },
];

const QUICK_TIME_PRESETS = [
    { label: "Morning", time: "09:00", display: "9:00 AM" },
    { label: "Lunch", time: "12:00", display: "12:00 PM" },
    { label: "Prime", time: "18:00", display: "6:00 PM" },
    { label: "Late", time: "21:00", display: "9:00 PM" },
] as const;

const PLATFORM_META: Record<
    SocialPlatformType,
    {
        label: string;
        shortLabel: string;
        pillSurface: string;
        accentBar: string;
        iconColor: string;
        activeRing: string;
    }
> = {
    YOUTUBE_SHORTS: {
        label: "YouTube Shorts",
        shortLabel: "Shorts",
        pillSurface:
            "bg-slate-900/95 border-slate-800 hover:border-rose-500/50 text-slate-100",
        accentBar: "bg-rose-500",
        iconColor: "text-rose-400",
        activeRing: "border-rose-500/60 bg-rose-500/10 text-white",
    },
    TIKTOK: {
        label: "TikTok",
        shortLabel: "TikTok",
        pillSurface:
            "bg-slate-900/95 border-slate-800 hover:border-cyan-400/50 text-slate-100",
        accentBar: "bg-cyan-400",
        iconColor: "text-cyan-300",
        activeRing: "border-cyan-400/60 bg-cyan-400/10 text-white",
    },
    INSTAGRAM_REELS: {
        label: "Instagram Reels",
        shortLabel: "Reels",
        pillSurface:
            "bg-slate-900/95 border-slate-800 hover:border-pink-500/50 text-slate-100",
        accentBar: "bg-pink-500",
        iconColor: "text-pink-400",
        activeRing: "border-pink-500/60 bg-pink-500/10 text-white",
    },
    FACEBOOK_REELS: {
        label: "Facebook Reels",
        shortLabel: "FB Reels",
        pillSurface:
            "bg-slate-900/95 border-slate-800 hover:border-blue-500/50 text-slate-100",
        accentBar: "bg-blue-500",
        iconColor: "text-blue-400",
        activeRing: "border-blue-500/60 bg-blue-500/10 text-white",
    },
};

const STATUS_META: Record<
    PublishStatusType,
    { label: string; badgeClass: string; dotClass: string }
> = {
    SCHEDULED: {
        label: "Scheduled",
        badgeClass: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        dotClass: "bg-amber-400",
    },
    PUBLISHING: {
        label: "Publishing",
        badgeClass: "border-sky-400/30 bg-sky-400/10 text-sky-300",
        dotClass: "bg-sky-400 animate-ping",
    },
    PUBLISHED: {
        label: "Published",
        badgeClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        dotClass: "bg-emerald-400",
    },
    FAILED: {
        label: "Failed",
        badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-300",
        dotClass: "bg-rose-500",
    },
    CANCELLED: {
        label: "Cancelled",
        badgeClass: "border-slate-700 bg-slate-800/60 text-slate-400",
        dotClass: "bg-slate-500",
    },
};

const aspectClasses: Record<Video["aspectRatio"], string> = {
    VERTICAL_9_16: "aspect-[9/16] max-h-[64vh]",
    SQUARE_1_1: "aspect-square max-w-[60vh]",
    LANDSCAPE_16_9: "aspect-video w-full",
};

function PlatformIcon({
    platform,
    className = "h-3.5 w-3.5",
}: {
    platform: SocialPlatformType;
    className?: string;
}) {
    switch (platform) {
        case "YOUTUBE_SHORTS":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className={className}
                >
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
            );
        case "TIKTOK":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className={className}
                >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
            );
        case "INSTAGRAM_REELS":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={className}
                >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
            );
        case "FACEBOOK_REELS":
            return (
                <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className={className}
                >
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
            );
    }
}

function seconds(value: string) {
    const parts = value.split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    return parts.length === 2 ? parts[0]! * 60 + parts[1]! : Number(value);
}

function timestamp(value: string) {
    const total = Math.max(0, Math.round(seconds(value)));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function duration(segment: Segment) {
    return Math.max(0, Math.round(seconds(segment.endTime) - seconds(segment.startTime)));
}

function formatDurationBadge(secs: number): string {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0
        ? `${mins}:${String(rem).padStart(2, "0")}`
        : `0:${String(rem).padStart(2, "0")}`;
}

// Shared multi-channel scheduling hook matching CalendarClient.tsx
function useScheduler(segment: Segment, onSaved: () => void, onSuccess?: () => void) {
    const [accounts, setAccounts] = useState<SocialAccountOption[]>(DEFAULT_DEMO_ACCOUNTS);
    const [hasLiveAccounts, setHasLiveAccounts] = useState(false);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([
        DEFAULT_DEMO_ACCOUNTS[0]!.id,
    ]);
    const [caption, setCaption] = useState(
        segment.socialCaption || `${segment.title} #shorts #reels #tiktok`,
    );
    const [dateString, setDateString] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [timeString, setTimeString] = useState("18:00");
    const [isScheduling, setIsScheduling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetch("/api/integrations/accounts", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { accounts?: SocialAccountOption[] } | null) => {
                if (!mounted || !data?.accounts || data.accounts.length === 0) return;
                setAccounts(data.accounts);
                setHasLiveAccounts(true);
                setSelectedAccountIds([data.accounts[0]!.id]);
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        setCaption(segment.socialCaption || `${segment.title} #shorts #reels #tiktok`);
        setError(null);
    }, [segment.id, segment.socialCaption, segment.title]);

    const toggleAccountSelection = (accountId: string) => {
        setError(null);
        setSelectedAccountIds((prev) =>
            prev.includes(accountId)
                ? prev.filter((id) => id !== accountId)
                : [...prev, accountId],
        );
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (selectedAccountIds.length === 0) {
            setError("Select at least one target platform to schedule.");
            return;
        }

        if (!dateString || !timeString) {
            setError("Please select a valid publish date and time.");
            return;
        }

        const scheduledDateTime = new Date(`${dateString}T${timeString}:00`);
        if (Number.isNaN(scheduledDateTime.getTime())) {
            setError("Invalid date or time format.");
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
                    scheduledFor: scheduledDateTime.toISOString(),
                    caption,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to schedule post.");
            }

            onSaved();
            if (onSuccess) onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to schedule post.");
        } finally {
            setIsScheduling(false);
        }
    };

    return {
        accounts,
        hasLiveAccounts,
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

export default function StudioClient({ videoId }: { videoId: string }) {
    const [video, setVideo] = useState<Video | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [captioned, setCaptioned] = useState(true);
    const [tab, setTab] = useState<"insights" | "schedule">("insights");
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const response = await fetch(`/api/videos/${videoId}`, { cache: "no-store" });
            if (!response.ok) throw new Error("Unable to load video.");
            const data = (await response.json()) as Video;
            setVideo(data);
            setActiveId((current) => current ?? data.segments[0]?.id ?? null);
            setError(null);
        } catch (loadError) {
            setError(
                loadError instanceof Error ? loadError.message : "Unable to load video.",
            );
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!video || (video.status !== "PROCESSING" && video.status !== "UPLOADING"))
            return;
        const interval = window.setInterval(() => void load(), 4000);
        return () => window.clearInterval(interval);
    }, [load, video]);

    // Close modal on Escape key for keyboard accessibility
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setScheduleOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const active = useMemo(
        () =>
            video?.segments.find((segment) => segment.id === activeId) ??
            video?.segments[0],
        [activeId, video],
    );

    const filteredSegments = useMemo(() => {
        if (!video) return [];
        if (!searchQuery.trim()) return video.segments;
        const q = searchQuery.toLowerCase();
        return video.segments.filter(
            (seg) =>
                seg.title.toLowerCase().includes(q) ||
                (seg.thumbnailText ?? "").toLowerCase().includes(q),
        );
    }, [video, searchQuery]);

    if (loading) return <StudioSkeleton />;

    if (error || !video) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 p-10 text-slate-100">
                <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center shadow-xl">
                    <p className="text-sm font-semibold text-rose-300">
                        {error ?? "Video not found."}
                    </p>
                    <a
                        href="/videos"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        ← Back to Video Library
                    </a>
                </div>
            </div>
        );
    }

    if (video.status !== "COMPLETED") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
                <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
                    <div
                        className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400"
                        aria-hidden="true"
                    />
                    <h1 className="text-lg font-bold text-white">
                        Preparing your Clip Studio
                    </h1>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        Live status:{" "}
                        <span className="font-mono font-semibold text-sky-400">
                            {video.status}
                        </span>
                        . Extracting viral segments, burning captions, and generating
                        thumbnails automatically.
                    </p>
                </div>
            </div>
        );
    }

    const ratioLabel =
        video.aspectRatio === "VERTICAL_9_16"
            ? "9:16"
            : video.aspectRatio === "SQUARE_1_1"
                ? "1:1"
                : "16:9";

    const totalQueuedCount = video.segments.reduce(
        (acc, seg) =>
            acc +
            seg.scheduledPosts.filter((p) => p.status !== "CANCELLED").length,
        0,
    );

    return (
        <main className="bg-[#0A0D14] text-slate-100 ">

            {/* 3-COLUMN STUDIO WORKSPACE */}
            <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)_380px]">
                {/* LEFT PANE: Segment Library with Generated Thumbnails */}
                <aside
                    aria-label="Extracted Video Segments"
                    className="flex flex-col border-b border-slate-800/90 bg-[#0A0D14] lg:h-[calc(100vh-69px)] lg:border-b-0 lg:border-r"
                >
                    <div className="border-b border-slate-800/90 p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                                    Extracted Clips
                                </h2>
                                <span
                                    aria-live="polite"
                                    className="rounded-full border border-slate-700 bg-[#0A0D14] px-2 py-0.5 font-mono text-xs font-medium text-slate-300"
                                >
                                    {filteredSegments.length}
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                                Select to preview
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative mt-3">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search extracted clips"
                                placeholder="Filter by clip title or hook..."
                                className="block w-full rounded-xl border border-slate-800 bg-[#0A0D14] py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                            />
                        </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {filteredSegments.map((segment) => {
                            const originalIndex = video.segments.findIndex(
                                (s) => s.id === segment.id,
                            );
                            const isSelected = active?.id === segment.id;
                            return (
                                <SegmentListCard
                                    key={segment.id}
                                    segment={segment}
                                    index={originalIndex}
                                    aspectRatio={video.aspectRatio}
                                    isSelected={isSelected}
                                    onSelect={() => setActiveId(segment.id)}
                                    onQuickSchedule={() => {
                                        setActiveId(segment.id);
                                        setScheduleOpen(true);
                                    }}
                                />
                            );
                        })}
                    </div>
                </aside>

                {/* CENTER PANE: Video Player & Primary Actions */}
                <section
                    aria-label="Video Clip Preview"
                    className="flex flex-col items-center justify-between border-b border-slate-800/90 bg-[#0A0D14] p-6 lg:h-[calc(100vh-69px)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-8"
                >
                    {active && (
                        <Workspace
                            segment={active}
                            captioned={captioned}
                            setCaptioned={setCaptioned}
                            aspectRatio={video.aspectRatio}
                            onSchedule={() => setScheduleOpen(true)}
                        />
                    )}
                </section>

                {/* RIGHT PANE: Insights & Publish Queue */}
                <InsightsPanel
                    segment={active}
                    tab={tab}
                    setTab={setTab}
                    onSaved={load}
                    onOpenModal={() => setScheduleOpen(true)}
                />
            </div>

            {active && scheduleOpen && (
                <ScheduleModal
                    segment={active}
                    aspectRatio={video.aspectRatio}
                    onClose={() => setScheduleOpen(false)}
                    onSaved={load}
                />
            )}
        </main>
    );
}

function SegmentListCard({
    segment,
    index,
    aspectRatio,
    isSelected,
    onSelect,
    onQuickSchedule,
}: {
    segment: Segment;
    index: number;
    aspectRatio: Video["aspectRatio"];
    isSelected: boolean;
    onSelect: () => void;
    onQuickSchedule: () => void;
}) {
    const clipDuration = duration(segment);
    const activeScheduledCount = segment.scheduledPosts.filter(
        (p) => p.status !== "CANCELLED",
    ).length;

    const ratioLabel =
        aspectRatio === "VERTICAL_9_16"
            ? "9:16"
            : aspectRatio === "SQUARE_1_1"
                ? "1:1"
                : "16:9";

    return (
        <article
            role="button"
            tabIndex={0}
            aria-label={`Select clip ${index + 1}: ${segment.title}`}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className={`group relative flex cursor-pointer gap-3.5 rounded-xl border p-3 text-left shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isSelected
                ? "border-sky-400/70 bg-sky-500/10 ring-1 ring-sky-400/30"
                : "border-slate-800/90 bg-[#0A0D14] hover:border-slate-700"
                }`}
        >
            {/* Reserved 9:16 Media Thumbnail Container (Prevents CLS) */}
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-[#0A0D14]">
                {segment.thumbnailUrl ? (
                    <img
                        src={segment.thumbnailUrl}
                        alt={segment.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-1.5 text-center">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            aria-hidden="true"
                            className="h-5 w-5 text-slate-600 transition-colors group-hover:text-sky-400"
                        >
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                    </div>
                )}

                {/* Clip Index Badge */}
                <span className="absolute left-1 top-1 rounded bg-[#0A0D14] px-1 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                    #{String(index + 1).padStart(2, "0")}
                </span>

                {/* Duration Overlay */}
                <span className="absolute bottom-1 right-1 rounded bg-slate-950/90 px-1 py-0.5 font-mono text-[10px] font-medium text-slate-200">
                    {formatDurationBadge(clipDuration)}
                </span>
            </div>

            {/* Card Content */}
            <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                            {segment.thumbnailText || "HIGHLIGHT"}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">
                            {timestamp(segment.startTime)}–{timestamp(segment.endTime)}
                        </span>
                    </div>

                    <h3 className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-slate-100">
                        {segment.title}
                    </h3>
                </div>

                {/* Metadata & Quick Schedule Row */}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="rounded bg-[#0A0D14] px-1.5 py-0.5 font-mono text-slate-300">
                            {ratioLabel}
                        </span>
                        {segment.captionedClipUrl && (
                            <span
                                title="Burned-in subtitles included"
                                className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-300"
                            >
                                CC
                            </span>
                        )}
                        {activeScheduledCount > 0 && (
                            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300">
                                {activeScheduledCount}× queued
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickSchedule();
                        }}
                        aria-label={`Schedule ${segment.title}`}
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-slate-700 bg-[#0A0D14] px-2 py-1 text-[11px] font-medium text-slate-100 transition hover:border-sky-400/60 hover:bg-sky-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            aria-hidden="true"
                            className="h-3 w-3"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Schedule
                    </button>
                </div>
            </div>
        </article>
    );
}

function Workspace({
    segment,
    captioned,
    setCaptioned,
    aspectRatio,
    onSchedule,
}: {
    segment: Segment;
    captioned: boolean;
    setCaptioned: (value: boolean) => void;
    aspectRatio: Video["aspectRatio"];
    onSchedule: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const source =
        captioned && segment.captionedClipUrl
            ? segment.captionedClipUrl
            : segment.clipUrl;

    const handleCopyCaption = async () => {
        await navigator.clipboard.writeText(segment.socialCaption ?? segment.title);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex w-full max-w-3xl flex-col items-center">
            {/* Top Player Bar */}
            <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#0A0D14] px-4 py-2.5">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-slate-100">
                            {segment.title}
                        </span>
                        <span className="shrink-0 rounded bg-[#0A0D14] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            {timestamp(segment.startTime)} – {timestamp(segment.endTime)}
                        </span>
                    </div>
                </div>

                {segment.captionedClipUrl && (
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-300 hover:text-white">
                        <input
                            type="checkbox"
                            checked={captioned}
                            onChange={(event) => setCaptioned(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-700 bg-[#0A0D14] text-sky-400 focus:ring-2 focus:ring-sky-400 focus:ring-offset-0"
                        />
                        Burned-in Captions (CC)
                    </label>
                )}
            </div>

            {/* Video Container */}
            <div
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#0A0D14] shadow-2xl ${aspectClasses[aspectRatio]}`}
            >
                <video
                    key={source ?? "empty"}
                    controls
                    preload="metadata"
                    poster={segment.thumbnailUrl ?? undefined}
                    className="h-full w-full object-contain"
                    src={source ?? undefined}
                />
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-5 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#0A0D14] p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={source ?? "#"}
                        download
                        className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-sky-400"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download MP4
                    </a>

                    <button
                        type="button"
                        onClick={() => void handleCopyCaption()}
                        className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-slate-400"
                        >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {copied ? "Copied!" : "Copy Caption"}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onSchedule}
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Schedule to Socials
                </button>
            </div>
        </div>
    );
}

function InsightsPanel({
    segment,
    tab,
    setTab,
    onSaved,
    onOpenModal,
}: {
    segment?: Segment;
    tab: "insights" | "schedule";
    setTab: (tab: "insights" | "schedule") => void;
    onSaved: () => void;
    onOpenModal: () => void;
}) {
    if (!segment) {
        return (
            <aside className="bg-slate-900/40 p-6 text-xs text-slate-400">
                Select a segment to view viral insights and scheduling controls.
            </aside>
        );
    }

    const activeQueueCount = segment.scheduledPosts.filter(
        (p) => p.status !== "CANCELLED",
    ).length;

    return (
        <aside
            aria-label="Clip Insights and Publishing Queue"
            className="flex min-w-0 flex-col bg-[#0A0D14] p-5 lg:h-[calc(100vh-69px)] lg:overflow-y-auto"
        >
            {/* Segmented Tab Switcher */}
            <div
                role="tablist"
                aria-label="Inspector tabs"
                className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "insights"}
                    onClick={() => setTab("insights")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${tab === "insights"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                        }`}
                >
                    Viral Metadata
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "schedule"}
                    onClick={() => setTab("schedule")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${tab === "schedule"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <span>Publish Queue</span>
                    {activeQueueCount > 0 && (
                        <span className="rounded-full bg-sky-400/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-sky-300">
                            {activeQueueCount}
                        </span>
                    )}
                </button>
            </div>

            {tab === "insights" && (
                <MetadataEditor segment={segment} onSaved={onSaved} />
            )}
            {tab === "schedule" && (
                <SchedulePanel
                    segment={segment}
                    onSaved={onSaved}
                    onOpenModal={onOpenModal}
                />
            )}
        </aside>
    );
}

function MetadataEditor({
    segment,
    onSaved,
}: {
    segment: Segment;
    onSaved: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(segment.title);
    const [thumbnailText, setThumbnailText] = useState(segment.thumbnailText ?? "");
    const [socialCaption, setSocialCaption] = useState(segment.socialCaption ?? "");
    const [keyPoints, setKeyPoints] = useState(segment.keyPoints.join("\n"));
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setTitle(segment.title);
        setThumbnailText(segment.thumbnailText ?? "");
        setSocialCaption(segment.socialCaption ?? "");
        setKeyPoints(segment.keyPoints.join("\n"));
        setEditing(false);
    }, [segment]);

    async function save() {
        setSaving(true);
        try {
            const response = await fetch(`/api/segments/${segment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    thumbnailText: thumbnailText || null,
                    socialCaption: socialCaption || null,
                    keyPoints: keyPoints
                        .split("\n")
                        .map((point) => point.trim())
                        .filter(Boolean),
                }),
            });
            if (!response.ok) throw new Error("Unable to save metadata.");
            setEditing(false);
            onSaved();
        } catch (error) {
            console.error("Unable to save segment metadata.", error);
        } finally {
            setSaving(false);
        }
    }

    const handleCopy = async () => {
        if (!segment.socialCaption) return;
        await navigator.clipboard.writeText(segment.socialCaption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Viral Metadata & Hooks
                </h2>
                <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-sky-400 transition hover:border-slate-700 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                    {editing ? "Cancel" : "Edit Metadata"}
                </button>
            </div>

            {editing ? (
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                            Clip Title
                        </span>
                        <input
                            placeholder="Clip title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                            Thumbnail Hook Badge
                        </span>
                        <input
                            placeholder="e.g. WAIT FOR IT..."
                            value={thumbnailText}
                            onChange={(event) => setThumbnailText(event.target.value)}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                            Social Media Caption
                        </span>
                        <textarea
                            placeholder="Social media caption and hashtags"
                            value={socialCaption}
                            onChange={(event) => setSocialCaption(event.target.value)}
                            rows={4}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                            Key Talking Points (one per line)
                        </span>
                        <textarea
                            placeholder="Key points (one per line)"
                            value={keyPoints}
                            onChange={(event) => setKeyPoints(event.target.value)}
                            rows={4}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving}
                        className="w-full min-h-[40px] rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        {saving ? "Saving Changes..." : "Save Metadata"}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Thumbnail & Hook Preview Card */}
                    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                            {segment.thumbnailUrl ? (
                                <img
                                    src={segment.thumbnailUrl}
                                    alt={segment.title}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-600">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <polyline points="21 15 16 10 5 21" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            {segment.thumbnailText && (
                                <span className="inline-block rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                                    {segment.thumbnailText}
                                </span>
                            )}
                            <h3 className="mt-1.5 text-sm font-bold leading-snug text-white">
                                {segment.title}
                            </h3>
                        </div>
                    </div>

                    {/* Auto-Caption Card */}
                    {segment.socialCaption && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Suggested Social Caption
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleCopy()}
                                    className="text-xs font-semibold text-sky-400 transition hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                                >
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">
                                {segment.socialCaption}
                            </p>
                        </div>
                    )}

                    {/* Key Highlights */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Key Retention Hooks
                        </span>
                        <ul className="space-y-2.5 text-xs leading-relaxed text-slate-300">
                            {segment.keyPoints.map((point) => (
                                <li key={point} className="flex items-start gap-2.5">
                                    <span
                                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                                        aria-hidden="true"
                                    />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function SchedulePanel({
    segment,
    onSaved,
    onOpenModal,
}: {
    segment: Segment;
    onSaved: () => void;
    onOpenModal: () => void;
}) {
    const {
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
    } = useScheduler(segment, onSaved);

    const activePosts = segment.scheduledPosts.filter(
        (p) => p.status !== "CANCELLED",
    );

    const handleCancelPost = async (postId: string) => {
        try {
            await fetch(`/api/schedule/${postId}`, { method: "DELETE" });
            onSaved();
        } catch {
            // Ignore
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Scheduled Distribution
                </h2>
                <button
                    type="button"
                    onClick={onOpenModal}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                >
                    Expand Modal ↗
                </button>
            </div>

            {/* Active Queue Items */}
            {activePosts.length > 0 ? (
                <div className="space-y-2.5">
                    {activePosts.map((post) => {
                        const platformMeta =
                            PLATFORM_META[post.socialAccount.platform] ??
                            PLATFORM_META.YOUTUBE_SHORTS;
                        const statusMeta =
                            STATUS_META[post.status] ?? STATUS_META.SCHEDULED;

                        return (
                            <div
                                key={post.id}
                                className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3 pl-4 text-xs"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`absolute inset-y-0 left-0 w-1 ${platformMeta.accentBar}`}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                                        <span className={platformMeta.iconColor}>
                                            <PlatformIcon
                                                platform={post.socialAccount.platform}
                                                className="h-3.5 w-3.5"
                                            />
                                        </span>
                                        {platformMeta.label}
                                    </span>

                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                                        />
                                        {statusMeta.label}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="font-mono">
                                        {format(
                                            parseISO(post.scheduledFor),
                                            "MMM d, yyyy · h:mm a",
                                        )}
                                    </span>

                                    {post.status === "PUBLISHED" && post.publishedUrl ? (
                                        <a
                                            href={post.publishedUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-semibold text-sky-400 hover:underline"
                                        >
                                            View Live ↗
                                        </a>
                                    ) : post.status !== "PUBLISHED" ? (
                                        <button
                                            type="button"
                                            onClick={() => void handleCancelPost(post.id)}
                                            className="text-rose-400 hover:text-rose-300"
                                        >
                                            Remove
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-400">
                    No scheduled posts for this clip yet.
                </div>
            )}

            {/* Quick Schedule Form */}
            <form
                onSubmit={handleScheduleSubmit}
                className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
            >
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                        Quick Queue Clip
                    </span>
                    <span className="text-[11px] text-slate-400">
                        {selectedAccountIds.length} selected
                    </span>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs font-medium text-rose-300"
                    >
                        {error}
                    </p>
                )}

                {/* Multi-Select Channel Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    {accounts.map((acc) => {
                        const isSelected = selectedAccountIds.includes(acc.id);
                        const meta = PLATFORM_META[acc.platform];
                        return (
                            <button
                                key={acc.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => toggleAccountSelection(acc.id)}
                                className={`flex min-h-[38px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isSelected
                                    ? meta.activeRing
                                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    }`}
                            >
                                <span className={meta.iconColor}>
                                    <PlatformIcon
                                        platform={acc.platform}
                                        className="h-3.5 w-3.5"
                                    />
                                </span>
                                <span className="truncate">{meta.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2.5">
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-slate-300">
                            Date
                        </span>
                        <input
                            type="date"
                            required
                            value={dateString}
                            onChange={(e) => setDateString(e.target.value)}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-slate-300">
                            Time
                        </span>
                        <input
                            type="time"
                            required
                            value={timeString}
                            onChange={(e) => setTimeString(e.target.value)}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>
                </div>

                {/* Quick Time Presets */}
                <div className="flex flex-wrap items-center gap-1">
                    {QUICK_TIME_PRESETS.map((preset) => (
                        <button
                            key={preset.time}
                            type="button"
                            onClick={() => setTimeString(preset.time)}
                            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${timeString === preset.time
                                ? "border-sky-400/60 bg-sky-400/15 text-sky-300"
                                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                }`}
                        >
                            {preset.display}
                        </button>
                    ))}
                </div>

                {/* Caption */}
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <label
                            htmlFor="panel-caption-input"
                            className="text-[11px] font-semibold text-slate-300"
                        >
                            Caption & Hashtags
                        </label>
                        <span className="font-mono text-[10px] text-slate-400">
                            {caption.length} / 2200
                        </span>
                    </div>
                    <textarea
                        id="panel-caption-input"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Write a hook and hashtags..."
                        rows={3}
                        maxLength={2200}
                        className="block w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isScheduling}
                    className="w-full min-h-[40px] rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                    {isScheduling
                        ? "Queueing Post..."
                        : `Confirm Schedule (${selectedAccountIds.length})`}
                </button>
            </form>
        </div>
    );
}

function ScheduleModal({
    segment,
    aspectRatio,
    onClose,
    onSaved,
}: {
    segment: Segment;
    aspectRatio: Video["aspectRatio"];
    onClose: () => void;
    onSaved: () => void;
}) {
    const {
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
    } = useScheduler(segment, onSaved, onClose);

    const previewSource = segment.captionedClipUrl ?? segment.clipUrl;
    const clipDuration = duration(segment);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                    <div>
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-400">
                            Schedule Distribution
                        </span>
                        <h3
                            id="schedule-modal-title"
                            className="mt-0.5 text-base font-bold text-white"
                        >
                            {segment.title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close schedule modal"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                            className="h-4 w-4"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <form
                    onSubmit={handleScheduleSubmit}
                    className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[200px_1fr]"
                >
                    {/* Left Column: Media Preview */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-slate-900">
                            {previewSource ? (
                                <video
                                    src={previewSource}
                                    poster={segment.thumbnailUrl ?? undefined}
                                    controls
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                />
                            ) : segment.thumbnailUrl ? (
                                <img
                                    src={segment.thumbnailUrl}
                                    alt={segment.title}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                                    <span className="rounded bg-sky-500/15 px-2 py-1 text-[10px] font-bold text-sky-300">
                                        {segment.thumbnailText || "HIGHLIGHT"}
                                    </span>
                                    <p className="mt-2 text-xs text-slate-400">
                                        {segment.title}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                                {aspectRatio === "VERTICAL_9_16"
                                    ? "9:16 Vertical"
                                    : aspectRatio === "SQUARE_1_1"
                                        ? "1:1 Square"
                                        : "16:9 Landscape"}
                            </span>
                            <span className="font-mono font-semibold text-slate-200">
                                {formatDurationBadge(clipDuration)}
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Form Controls */}
                    <div className="space-y-4">
                        {/* Target Channels */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300">
                                    Target Channels
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    {selectedAccountIds.length} selected
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {accounts.map((acc) => {
                                    const isSelected = selectedAccountIds.includes(
                                        acc.id,
                                    );
                                    const meta = PLATFORM_META[acc.platform];
                                    return (
                                        <button
                                            key={acc.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() =>
                                                toggleAccountSelection(acc.id)
                                            }
                                            className={`flex min-h-[42px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isSelected
                                                ? meta.activeRing
                                                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                                }`}
                                        >
                                            <span className={meta.iconColor}>
                                                <PlatformIcon
                                                    platform={acc.platform}
                                                    className="h-4 w-4"
                                                />
                                            </span>
                                            <span className="truncate">
                                                {acc.accountName}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {error && (
                                <p
                                    role="alert"
                                    className="mt-1.5 text-xs font-medium text-rose-400"
                                >
                                    {error}
                                </p>
                            )}
                        </div>

                        {/* Date & Time + Quick Presets */}
                        <div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                                        Publish Date
                                    </span>
                                    <input
                                        type="date"
                                        required
                                        value={dateString}
                                        onChange={(e) =>
                                            setDateString(e.target.value)
                                        }
                                        className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                                        Publish Time
                                    </span>
                                    <input
                                        type="time"
                                        required
                                        value={timeString}
                                        onChange={(e) =>
                                            setTimeString(e.target.value)
                                        }
                                        className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                    />
                                </label>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="mr-1 text-[11px] text-slate-400">
                                    Quick slots:
                                </span>
                                {QUICK_TIME_PRESETS.map((preset) => (
                                    <button
                                        key={preset.time}
                                        type="button"
                                        onClick={() =>
                                            setTimeString(preset.time)
                                        }
                                        className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition ${timeString === preset.time
                                            ? "border-sky-400/60 bg-sky-400/15 text-sky-300"
                                            : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                            }`}
                                    >
                                        {preset.display}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Caption & Character Counter */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label
                                    htmlFor="modal-caption-input"
                                    className="text-xs font-semibold text-slate-300"
                                >
                                    Caption & Hashtags
                                </label>
                                <span className="font-mono text-[11px] text-slate-400">
                                    {caption.length} / 2200
                                </span>
                            </div>
                            <textarea
                                id="modal-caption-input"
                                rows={3}
                                maxLength={2200}
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Write a hook and relevant hashtags (#shorts #reels #tiktok)..."
                                className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isScheduling}
                                className="min-h-[40px] rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isScheduling}
                                className="min-h-[40px] rounded-xl bg-sky-400 px-5 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:opacity-50"
                            >
                                {isScheduling
                                    ? "Queueing Post..."
                                    : `Confirm Schedule (${selectedAccountIds.length})`}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function StudioSkeleton() {
    return (
        <main className="min-h-screen animate-pulse bg-slate-950 p-6">
            <div className="mx-auto max-w-[1600px]">
                <div className="h-10 w-72 rounded-xl bg-slate-900" />
                <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr_380px]">
                    <div className="h-[78vh] rounded-2xl bg-slate-900/70" />
                    <div className="h-[78vh] rounded-2xl bg-slate-900/70" />
                    <div className="h-[78vh] rounded-2xl bg-slate-900/70" />
                </div>
            </div>
        </main>
    );
}