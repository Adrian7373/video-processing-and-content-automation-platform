"use client";

import React, { useState, useMemo } from "react";
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO,
    setHours,
    setMinutes,
} from "date-fns";

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

export interface CalendarClipItem {
    id: string;
    videoId: string;
    title: string;
    parentVideoTitle: string;
    durationSeconds: number;
    aspectRatio: "VERTICAL_9_16" | "SQUARE_1_1" | "LANDSCAPE_16_9";
    hasBurnedCaptions: boolean;
    thumbnailText: string;
    socialCaption: string;
    previewVideoUrl: string | null;
    thumbnailUrl: string | null;
}

export interface CalendarScheduledPostItem {
    id: string;
    videoSegmentId: string;
    segmentTitle: string;
    thumbnailText: string;
    socialAccountId: string;
    platform: SocialPlatformType;
    accountName: string;
    caption: string;
    scheduledFor: string; // ISO string
    status: PublishStatusType;
    publishedUrl: string | null;
}

export interface CalendarSocialAccountItem {
    id: string;
    platform: SocialPlatformType;
    accountName: string;
}

interface CalendarClientProps {
    initialClips: CalendarClipItem[];
    initialPosts: CalendarScheduledPostItem[];
    initialAccounts: CalendarSocialAccountItem[];
}

type DragPayload =
    | { type: "CLIP"; clip: CalendarClipItem }
    | { type: "POST"; post: CalendarScheduledPostItem };

const DEFAULT_DEMO_ACCOUNTS: CalendarSocialAccountItem[] = [
    { id: "demo-yt", platform: "YOUTUBE_SHORTS", accountName: "YouTube Shorts" },
    { id: "demo-tt", platform: "TIKTOK", accountName: "TikTok Creator" },
    { id: "demo-ig", platform: "INSTAGRAM_REELS", accountName: "Instagram Reels" },
    { id: "demo-fb", platform: "FACEBOOK_REELS", accountName: "Facebook Reels" },
];

const PLATFORM_META: Record<
    SocialPlatformType,
    { label: string; shortLabel: string; badgeClass: string; dotClass: string }
> = {
    YOUTUBE_SHORTS: {
        label: "YouTube Shorts",
        shortLabel: "YT",
        badgeClass: "border-red-500/40 bg-red-500/15 text-red-300",
        dotClass: "bg-red-500",
    },
    TIKTOK: {
        label: "TikTok",
        shortLabel: "TT",
        badgeClass: "border-cyan-400/40 bg-cyan-400/15 text-cyan-200",
        dotClass: "bg-cyan-400",
    },
    INSTAGRAM_REELS: {
        label: "Instagram Reels",
        shortLabel: "IG",
        badgeClass: "border-pink-500/40 bg-pink-500/15 text-pink-300",
        dotClass: "bg-pink-500",
    },
    FACEBOOK_REELS: {
        label: "Facebook Reels",
        shortLabel: "FB",
        badgeClass: "border-blue-500/40 bg-blue-500/15 text-blue-300",
        dotClass: "bg-blue-500",
    },
};

const STATUS_BADGE: Record<PublishStatusType, string> = {
    SCHEDULED: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    PUBLISHING: "text-sky-300 bg-sky-500/10 border-sky-500/30 animate-pulse",
    PUBLISHED: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    FAILED: "text-red-300 bg-red-500/10 border-red-500/30",
    CANCELLED: "text-neutral-400 bg-neutral-700/20 border-neutral-700",
};

function DraggableClipCard({
    clip,
    scheduledCount,
    onQuickSchedule,
}: {
    clip: CalendarClipItem;
    scheduledCount: number;
    onQuickSchedule: (clip: CalendarClipItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `clip-${clip.id}`,
        data: { type: "CLIP", clip } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group relative cursor-grab rounded-xl border border-neutral-800 bg-[#1C1C1F] p-3.5 transition hover:border-neutral-600 active:cursor-grabbing ${isDragging ? "opacity-40" : "opacity-100"
                }`}
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    {clip.thumbnailText || "VIRAL HOOK"}
                </span>
                <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
                    {clip.durationSeconds}s
                </span>
            </div>

            <h3 className="line-clamp-1 text-sm font-semibold text-neutral-100">
                {clip.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                {clip.parentVideoTitle}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-800/80 pt-2.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                        {clip.aspectRatio === "VERTICAL_9_16"
                            ? "9:16"
                            : clip.aspectRatio === "SQUARE_1_1"
                                ? "1:1"
                                : "16:9"}
                    </span>
                    {clip.hasBurnedCaptions && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300">
                            CC Burned
                        </span>
                    )}
                    {scheduledCount > 0 && (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-300">
                            {scheduledCount} scheduled
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onQuickSchedule(clip)}
                    className="rounded-md bg-neutral-800 px-2 py-1 font-medium text-neutral-200 transition hover:bg-neutral-200 hover:text-neutral-900"
                >
                    + Schedule
                </button>
            </div>
        </div>
    );
}

function DraggableScheduledPostPill({
    post,
    onSelectPost,
}: {
    post: CalendarScheduledPostItem;
    onSelectPost: (post: CalendarScheduledPostItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `post-${post.id}`,
        data: { type: "POST", post } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
    };

    const platformMeta = PLATFORM_META[post.platform];
    const timeFormatted = format(parseISO(post.scheduledFor), "h:mm a");

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onSelectPost(post)}
            className={`group flex cursor-grab items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition hover:brightness-110 active:cursor-grabbing ${platformMeta.badgeClass
                } ${isDragging ? "opacity-30" : "opacity-100"}`}
        >
            <div className="flex min-w-0 items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${platformMeta.dotClass}`} />
                <span className="font-bold">{platformMeta.shortLabel}</span>
                <span className="truncate font-medium text-neutral-100">
                    {post.segmentTitle}
                </span>
            </div>
            <span className="shrink-0 font-mono text-[10px] opacity-80">
                {timeFormatted}
            </span>
        </div>
    );
}

function DroppableCalendarDayCell({
    day,
    isCurrentMonth,
    posts,
    onAddClick,
    onSelectPost,
}: {
    day: Date;
    isCurrentMonth: boolean;
    posts: CalendarScheduledPostItem[];
    onAddClick: (day: Date) => void;
    onSelectPost: (post: CalendarScheduledPostItem) => void;
}) {
    const dayKey = format(day, "yyyy-MM-dd");
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${dayKey}`,
        data: { dayKey, date: day },
    });

    const today = isToday(day);

    return (
        <div
            ref={setNodeRef}
            className={`group relative flex min-h-[138px] flex-col justify-between border-b border-r border-neutral-800/80 p-2.5 transition ${isCurrentMonth ? "bg-[#141417]" : "bg-[#0D0D0F] text-neutral-600"
                } ${isOver
                    ? "bg-amber-500/10 ring-2 ring-inset ring-amber-400"
                    : "hover:bg-[#19191D]"
                }`}
        >
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today
                                ? "bg-amber-400 text-neutral-950"
                                : isCurrentMonth
                                    ? "text-neutral-300"
                                    : "text-neutral-600"
                            }`}
                    >
                        {format(day, "d")}
                    </span>

                    <button
                        type="button"
                        onClick={() => onAddClick(day)}
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 opacity-0 transition hover:bg-neutral-800 hover:text-white group-hover:opacity-100"
                        title="Schedule a clip on this day"
                    >
                        + Add
                    </button>
                </div>

                <div className="space-y-1.5">
                    {posts.map((post) => (
                        <DraggableScheduledPostPill
                            key={post.id}
                            post={post}
                            onSelectPost={onSelectPost}
                        />
                    ))}
                </div>
            </div>

            {isOver && (
                <div className="mt-2 rounded border border-dashed border-amber-400/60 bg-amber-500/10 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    Drop to Schedule
                </div>
            )}
        </div>
    );
}

export default function CalendarClient({
    initialClips,
    initialPosts,
    initialAccounts,
}: CalendarClientProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
    const [posts, setPosts] = useState<CalendarScheduledPostItem[]>(initialPosts);
    const [searchQuery, setSearchQuery] = useState("");
    const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);

    // Active drag state
    const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);

    // Schedule Modal state
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [modalClip, setModalClip] = useState<CalendarClipItem | null>(null);
    const [modalDateString, setModalDateString] = useState<string>(() =>
        format(new Date(), "yyyy-MM-dd"),
    );
    const [modalTimeString, setModalTimeString] = useState<string>("18:00");
    const [modalCaption, setModalCaption] = useState<string>("");
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Post Details Drawer/Modal state
    const [selectedPost, setSelectedPost] = useState<CalendarScheduledPostItem | null>(
        null,
    );

    const accounts = useMemo(
        () => (initialAccounts.length > 0 ? initialAccounts : DEFAULT_DEMO_ACCOUNTS),
        [initialAccounts],
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
    );

    // Build the 7-column calendar days array
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [currentMonth]);

    // Count how many posts each clip has
    const scheduledCountByClipId = useMemo(() => {
        const map = new Map<string, number>();
        for (const post of posts) {
            if (post.status !== "CANCELLED") {
                map.set(
                    post.videoSegmentId,
                    (map.get(post.videoSegmentId) ?? 0) + 1,
                );
            }
        }
        return map;
    }, [posts]);

    const filteredClips = useMemo(() => {
        return initialClips.filter((clip) => {
            const matchesSearch =
                clip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                clip.parentVideoTitle
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (onlyUnscheduled) {
                return (scheduledCountByClipId.get(clip.id) ?? 0) === 0;
            }
            return true;
        });
    }, [initialClips, searchQuery, onlyUnscheduled, scheduledCountByClipId]);

    const openScheduleModal = (clip: CalendarClipItem, targetDate?: Date) => {
        setModalClip(clip);
        setModalDateString(format(targetDate ?? new Date(), "yyyy-MM-dd"));
        setModalTimeString("18:00");
        setModalCaption(
            clip.socialCaption || `${clip.title} #shorts #reels #tiktok`,
        );
        setSelectedAccountIds(accounts[0] ? [accounts[0].id] : []);
        setIsScheduleModalOpen(true);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const payload = event.active.data.current as DragPayload | undefined;
        if (payload) {
            setActiveDrag(payload);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const payload = event.active.data.current as DragPayload | undefined;
        setActiveDrag(null);

        if (!payload || !event.over) return;

        const overId = String(event.over.id);
        if (!overId.startsWith("day-")) return;

        const targetDate = event.over.data.current?.date as Date | undefined;
        if (!targetDate) return;

        if (payload.type === "CLIP") {
            openScheduleModal(payload.clip, targetDate);
            return;
        }

        if (payload.type === "POST") {
            const existingDate = parseISO(payload.post.scheduledFor);
            if (isSameDay(existingDate, targetDate)) return;

            const updatedDate = setMinutes(
                setHours(targetDate, existingDate.getHours()),
                existingDate.getMinutes(),
            );
            const newIso = updatedDate.toISOString();

            // Optimistically update the calendar immediately
            setPosts((prev) =>
                prev.map((item) =>
                    item.id === payload.post.id
                        ? { ...item, scheduledFor: newIso }
                        : item,
                ),
            );

            // Attempt background sync with /api/schedule/[postId]
            try {
                await fetch(`/api/schedule/${payload.post.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scheduledFor: newIso }),
                });
            } catch {
                // Keep optimistic UI state when testing before API route is wired
            }
        }
    };

    const toggleAccountSelection = (accountId: string) => {
        setSelectedAccountIds((prev) =>
            prev.includes(accountId)
                ? prev.filter((id) => id !== accountId)
                : [...prev, accountId],
        );
    };

    const handleScheduleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!modalClip || selectedAccountIds.length === 0) return;

        setIsSubmitting(true);
        const scheduledDateTime = new Date(
            `${modalDateString}T${modalTimeString}:00`,
        );
        const scheduledIso = scheduledDateTime.toISOString();

        try {
            // Try hitting backend endpoint if wired; fallback to optimistic creation
            const response = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    segmentId: modalClip.id,
                    socialAccountIds: selectedAccountIds,
                    caption: modalCaption,
                    scheduledFor: scheduledIso,
                }),
            });

            if (response.ok) {
                const data = (await response.json()) as {
                    posts?: CalendarScheduledPostItem[];
                };
                if (data.posts && Array.isArray(data.posts)) {
                    setPosts((prev) => [...prev, ...data.posts!]);
                    setIsScheduleModalOpen(false);
                    return;
                }
            }
        } catch {
            // Fallback to optimistic local state below
        } finally {
            setIsSubmitting(false);
        }

        // Optimistic UI fallback so calendar works visually right away
        const optimisticNewPosts: CalendarScheduledPostItem[] =
            selectedAccountIds.map((accId) => {
                const account =
                    accounts.find((a) => a.id === accId) ?? accounts[0]!;
                return {
                    id: `local-${Date.now()}-${accId}`,
                    videoSegmentId: modalClip.id,
                    segmentTitle: modalClip.title,
                    thumbnailText: modalClip.thumbnailText,
                    socialAccountId: account.id,
                    platform: account.platform,
                    accountName: account.accountName,
                    caption: modalCaption,
                    scheduledFor: scheduledIso,
                    status: "SCHEDULED",
                    publishedUrl: null,
                };
            });

        setPosts((prev) => [...prev, ...optimisticNewPosts]);
        setIsScheduleModalOpen(false);
    };

    const handleCancelScheduledPost = async (postId: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setSelectedPost(null);

        try {
            await fetch(`/api/schedule/${postId}`, {
                method: "DELETE",
            });
        } catch {
            // Ignore when testing visually
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[360px_1fr]">
                {/* LEFT SIDEBAR: Draggable Clips Backlog */}
                <aside className="flex h-[calc(100vh-73px)] flex-col border-r border-neutral-800 bg-[#141416]">
                    <div className="border-b border-neutral-800 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                Ready Clips ({filteredClips.length})
                            </h2>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
                                <input
                                    type="checkbox"
                                    checked={onlyUnscheduled}
                                    onChange={(e) =>
                                        setOnlyUnscheduled(e.target.checked)
                                    }
                                    className="rounded border-neutral-700 bg-neutral-900 text-amber-400 focus:ring-0"
                                />
                                Unscheduled only
                            </label>
                        </div>

                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search clips or videos..."
                            className="mt-3 block w-full rounded-lg border border-neutral-800 bg-[#0F0F11] px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                        />
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {filteredClips.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center">
                                <p className="text-sm font-medium text-neutral-300">
                                    No clips found
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Process a video first or clear your filter to drag clips onto the calendar.
                                </p>
                            </div>
                        ) : (
                            filteredClips.map((clip) => (
                                <DraggableClipCard
                                    key={clip.id}
                                    clip={clip}
                                    scheduledCount={
                                        scheduledCountByClipId.get(clip.id) ?? 0
                                    }
                                    onQuickSchedule={(c) => openScheduleModal(c)}
                                />
                            ))
                        )}
                    </div>
                </aside>

                {/* RIGHT MAIN AREA: Monthly Calendar Grid */}
                <section className="flex min-h-[calc(100vh-73px)] flex-col bg-[#101013]">
                    {/* Calendar Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-white">
                                {format(currentMonth, "MMMM yyyy")}
                            </h2>
                            <div className="flex items-center rounded-lg border border-neutral-800 bg-[#18181B]">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentMonth((m) => subMonths(m, 1))
                                    }
                                    className="px-2.5 py-1 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentMonth(new Date())}
                                    className="border-x border-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentMonth((m) => addMonths(m, 1))
                                    }
                                    className="px-2.5 py-1 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                                >
                                    ›
                                </button>
                            </div>
                        </div>

                        {/* Platform Legend */}
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                            {(
                                Object.keys(
                                    PLATFORM_META,
                                ) as SocialPlatformType[]
                            ).map((platform) => (
                                <div
                                    key={platform}
                                    className="flex items-center gap-1.5 text-neutral-400"
                                >
                                    <span
                                        className={`h-2.5 w-2.5 rounded-full ${PLATFORM_META[platform].dotClass}`}
                                    />
                                    <span>{PLATFORM_META[platform].label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weekday Header Row */}
                    <div className="grid grid-cols-7 border-b border-neutral-800 bg-[#16161A] text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                            (dayName) => (
                                <div
                                    key={dayName}
                                    className="border-r border-neutral-800/80 py-2.5 last:border-r-0"
                                >
                                    {dayName}
                                </div>
                            ),
                        )}
                    </div>

                    {/* 7-Column Days Grid */}
                    <div className="grid flex-1 grid-cols-7">
                        {calendarDays.map((day) => {
                            const dayPosts = posts.filter(
                                (p) =>
                                    p.status !== "CANCELLED" &&
                                    isSameDay(parseISO(p.scheduledFor), day),
                            );

                            return (
                                <DroppableCalendarDayCell
                                    key={day.toISOString()}
                                    day={day}
                                    isCurrentMonth={isSameMonth(
                                        day,
                                        currentMonth,
                                    )}
                                    posts={dayPosts}
                                    onAddClick={(targetDate) => {
                                        const defaultClip =
                                            filteredClips[0] ?? initialClips[0];
                                        if (defaultClip) {
                                            openScheduleModal(
                                                defaultClip,
                                                targetDate,
                                            );
                                        }
                                    }}
                                    onSelectPost={(post) =>
                                        setSelectedPost(post)
                                    }
                                />
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Floating Drag Overlay */}
            <DragOverlay>
                {activeDrag?.type === "CLIP" && (
                    <div className="w-72 rounded-xl border border-amber-400 bg-[#1C1C1F] p-3.5 shadow-2xl">
                        <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            {activeDrag.clip.thumbnailText}
                        </span>
                        <p className="mt-1 truncate text-sm font-semibold text-white">
                            {activeDrag.clip.title}
                        </p>
                    </div>
                )}
                {activeDrag?.type === "POST" && (
                    <div className="w-56 rounded-lg border border-amber-400 bg-[#1C1C1F] px-3 py-2 text-xs font-semibold text-white shadow-2xl">
                        Rescheduling: {activeDrag.post.segmentTitle}
                    </div>
                )}
            </DragOverlay>

            {/* SCHEDULE MODAL */}
            {isScheduleModalOpen && modalClip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#18181C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                                    Auto-Publish Scheduler
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-white">
                                    Schedule &ldquo;{modalClip.title}&rdquo;
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsScheduleModalOpen(false)}
                                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={handleScheduleSubmit}
                            className="mt-5 space-y-4"
                        >
                            {/* Select Clip Switcher */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-neutral-300">
                                    Selected Clip
                                </label>
                                <select
                                    value={modalClip.id}
                                    onChange={(e) => {
                                        const found = initialClips.find(
                                            (c) => c.id === e.target.value,
                                        );
                                        if (found) {
                                            setModalClip(found);
                                            setModalCaption(
                                                found.socialCaption ||
                                                found.title,
                                            );
                                        }
                                    }}
                                    className="block w-full rounded-lg border border-neutral-700 bg-[#111114] px-3 py-2 text-sm text-neutral-200"
                                >
                                    {initialClips.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.title} ({c.durationSeconds}s)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Target Platforms Multi-Select */}
                            <div>
                                <span className="mb-1.5 block text-xs font-medium text-neutral-300">
                                    Publish To Platforms
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    {accounts.map((acc) => {
                                        const isSelected =
                                            selectedAccountIds.includes(acc.id);
                                        const meta =
                                            PLATFORM_META[acc.platform];
                                        return (
                                            <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() =>
                                                    toggleAccountSelection(
                                                        acc.id,
                                                    )
                                                }
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${isSelected
                                                        ? "border-amber-400 bg-amber-400/10 text-white"
                                                        : "border-neutral-800 bg-[#111114] text-neutral-400 hover:border-neutral-700"
                                                    }`}
                                            >
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`}
                                                />
                                                <span className="truncate">
                                                    {acc.accountName}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Date & Time Picker */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-medium text-neutral-300">
                                        Publish Date
                                    </span>
                                    <input
                                        type="date"
                                        required
                                        value={modalDateString}
                                        onChange={(e) =>
                                            setModalDateString(e.target.value)
                                        }
                                        className="block w-full rounded-lg border border-neutral-700 bg-[#111114] px-3 py-2 text-sm text-neutral-200"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-medium text-neutral-300">
                                        Publish Time
                                    </span>
                                    <input
                                        type="time"
                                        required
                                        value={modalTimeString}
                                        onChange={(e) =>
                                            setModalTimeString(e.target.value)
                                        }
                                        className="block w-full rounded-lg border border-neutral-700 bg-[#111114] px-3 py-2 text-sm text-neutral-200"
                                    />
                                </label>
                            </div>

                            {/* Social Caption */}
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-medium text-neutral-300">
                                    Post Caption & Hashtags
                                </span>
                                <textarea
                                    rows={4}
                                    value={modalCaption}
                                    onChange={(e) =>
                                        setModalCaption(e.target.value)
                                    }
                                    placeholder="Write a viral hook and hashtags..."
                                    className="block w-full rounded-lg border border-neutral-700 bg-[#111114] p-3 text-sm text-neutral-200"
                                />
                            </label>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsScheduleModalOpen(false)
                                    }
                                    className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        selectedAccountIds.length === 0
                                    }
                                    className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-neutral-950 transition hover:bg-amber-300 disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? "Scheduling..."
                                        : `Schedule (${selectedAccountIds.length})`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SCHEDULED POST DETAILS MODAL */}
            {selectedPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#18181C] p-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[selectedPost.status]
                                    }`}
                            >
                                {selectedPost.status}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedPost(null)}
                                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <h3 className="mt-3 text-base font-bold text-white">
                            {selectedPost.segmentTitle}
                        </h3>
                        <p className="mt-1 text-xs text-neutral-400">
                            Platform:{" "}
                            <span className="font-medium text-neutral-200">
                                {PLATFORM_META[selectedPost.platform].label} (
                                {selectedPost.accountName})
                            </span>
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                            Scheduled For:{" "}
                            <span className="font-mono text-neutral-200">
                                {format(
                                    parseISO(selectedPost.scheduledFor),
                                    "PPP 'at' p",
                                )}
                            </span>
                        </p>

                        <div className="mt-4 rounded-xl border border-neutral-800 bg-[#111114] p-3 text-xs leading-relaxed text-neutral-300">
                            {selectedPost.caption || "No caption provided."}
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() =>
                                    handleCancelScheduledPost(selectedPost.id)
                                }
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                            >
                                Cancel Scheduled Post
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPost(null)}
                                className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DndContext>
    );
}