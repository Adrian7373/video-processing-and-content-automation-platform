"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    parseISO,
    setHours,
    setMinutes,
    startOfMonth,
    startOfWeek,
    subMonths,
} from "date-fns";
import AuthGateModal from "../components/AuthGateModal";
import PlatformIcon, { PLATFORM_LABEL } from "../components/PlatformIcon";
import { PLATFORM_COLOR, STATUS_BADGE, badgeBase, ui } from "@/lib/ui";

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
    isAnonymous: boolean;
}

const CLIPS_PER_PAGE = 10;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const PLATFORMS = Object.keys(PLATFORM_LABEL) as SocialPlatformType[];

type DragPayload =
    | { type: "CLIP"; clip: CalendarClipItem }
    | { type: "POST"; post: CalendarScheduledPostItem };

const QUICK_TIMES = [
    { time: "09:00", display: "9:00" },
    { time: "12:00", display: "12:00" },
    { time: "18:00", display: "18:00" },
    { time: "21:00", display: "21:00" },
] as const;

const RATIO_LABEL: Record<CalendarClipItem["aspectRatio"], string> = {
    VERTICAL_9_16: "9:16",
    SQUARE_1_1: "1:1",
    LANDSCAPE_16_9: "16:9",
};

function clipLength(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    return `${mins}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ClipThumb({ clip, className }: { clip: CalendarClipItem; className: string }) {
    return (
        <div className={`relative shrink-0 overflow-hidden rounded-md bg-frame ${className}`}>
            {clip.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
                <div className="grid h-full w-full place-items-center text-white/60">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                        <path d="M7 4.5v15l12-7.5z" />
                    </svg>
                </div>
            )}
        </div>
    );
}

function LibraryClip({
    clip,
    scheduledCount,
    onSchedule,
}: {
    clip: CalendarClipItem;
    scheduledCount: number;
    onSchedule: (clip: CalendarClipItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `clip-${clip.id}`,
        data: { type: "CLIP", clip } satisfies DragPayload,
    });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform) }}
            className={`group flex gap-3 rounded-lg p-2 transition hover:bg-surface ${isDragging ? "opacity-40" : ""}`}
        >
            <div
                {...listeners}
                {...attributes}
                aria-label={`Drag ${clip.title} onto a day`}
                className={`flex min-w-0 flex-1 cursor-grab gap-3 rounded-md active:cursor-grabbing ${ui.focusRing}`}
            >
                <ClipThumb clip={clip} className="h-[72px] w-[41px]" />
                <div className="min-w-0 flex-1 py-0.5">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{clip.title}</p>
                    <p className="mt-1 truncate text-[13px] text-muted">
                        <span className="tabular-nums">{clipLength(clip.durationSeconds)}</span>, {RATIO_LABEL[clip.aspectRatio]}
                        {clip.hasBurnedCaptions ? ", captions" : ""}
                    </p>
                    {scheduledCount > 0 && (
                        <p className="mt-0.5 text-[13px] text-info">Scheduled {scheduledCount}×</p>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={() => onSchedule(clip)}
                aria-label={`Schedule ${clip.title}`}
                title="Schedule"
                className={`${ui.btnIcon} self-center group-hover:text-ink`}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px]">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                    <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
                </svg>
            </button>
        </li>
    );
}

function PostChip({
    post,
    onSelect,
}: {
    post: CalendarScheduledPostItem;
    onSelect: (post: CalendarScheduledPostItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `post-${post.id}`,
        data: { type: "POST", post } satisfies DragPayload,
    });
    const time = format(parseISO(post.scheduledFor), "HH:mm");
    const failed = post.status === "FAILED";
    const published = post.status === "PUBLISHED";

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform) }}
            {...listeners}
            {...attributes}
            role="button"
            tabIndex={0}
            aria-label={`${PLATFORM_LABEL[post.platform].label}: ${post.segmentTitle} at ${time}, ${STATUS_BADGE[post.status].label}`}
            onClick={(event) => {
                event.stopPropagation();
                onSelect(post);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(post);
                }
            }}
            className={`flex h-7 cursor-grab items-center gap-1.5 rounded-md border px-1.5 text-[13px] transition active:cursor-grabbing ${ui.focusRing} ${failed
                ? "border-danger/40 bg-danger/10"
                : published
                    ? "border-transparent bg-success/10"
                    : "border-line bg-raised hover:border-line-strong"
                } ${isDragging ? "opacity-30" : ""}`}
        >
            <PlatformIcon platform={post.platform} className={`h-3.5 w-3.5 shrink-0 ${PLATFORM_COLOR[post.platform]}`} />
            <span className={`shrink-0 tabular-nums ${failed ? "text-danger" : "text-muted"}`}>{time}</span>
            <span className={`truncate font-medium ${published ? "text-muted" : "text-ink"}`}>
                {post.segmentTitle}
            </span>
        </div>
    );
}

function DayCell({
    day,
    inMonth,
    posts,
    canAdd,
    onAdd,
    onSelectPost,
}: {
    day: Date;
    inMonth: boolean;
    posts: CalendarScheduledPostItem[];
    canAdd: boolean;
    onAdd: (day: Date) => void;
    onSelectPost: (post: CalendarScheduledPostItem) => void;
}) {
    const key = format(day, "yyyy-MM-dd");
    const { isOver, setNodeRef } = useDroppable({ id: `day-${key}`, data: { dayKey: key, date: day } });
    const today = isToday(day);
    const visible = posts.slice(0, 3);
    const hidden = posts.length - visible.length;

    return (
        <div
            ref={setNodeRef}
            className={`group relative flex min-h-[124px] flex-col gap-1 border-b border-r border-line p-1.5 transition-colors ${isOver
                ? "bg-action/12 shadow-[inset_0_0_0_2px_var(--sm-action)]"
                : inMonth
                    ? "bg-page"
                    : "bg-surface/60"
                }`}
        >
            <div className="flex items-center justify-between">
                <span
                    className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1 text-[13px] tabular-nums ${today
                        ? "bg-action font-semibold text-action-ink"
                        : inMonth
                            ? "font-medium text-ink"
                            : "text-muted"
                        }`}
                >
                    {format(day, "d")}
                </span>
                {canAdd && (
                    <button
                        type="button"
                        onClick={() => onAdd(day)}
                        aria-label={`Schedule a clip on ${format(day, "MMMM d")}`}
                        className={`${ui.btnIcon} h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-3.5 w-3.5">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
                {visible.map((post) => (
                    <PostChip key={post.id} post={post} onSelect={onSelectPost} />
                ))}
                {hidden > 0 && (
                    <button
                        type="button"
                        onClick={() => onSelectPost(posts[3]!)}
                        className="h-6 rounded-md px-1.5 text-left text-[13px] font-medium text-muted hover:bg-surface hover:text-ink"
                    >
                        {hidden} more
                    </button>
                )}
            </div>
            {isOver && (
                <span className="pointer-events-none mt-auto rounded-md border border-dashed border-action px-1.5 py-1 text-center text-[13px] font-medium text-ink">
                    Drop to schedule
                </span>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CalendarClient({
    initialClips,
    initialPosts,
    initialAccounts,
    isAnonymous,
}: CalendarClientProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
    const [posts, setPosts] = useState<CalendarScheduledPostItem[]>(initialPosts);
    const [searchQuery, setSearchQuery] = useState("");
    const [clipPage, setClipPage] = useState(1);
    const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
    const [platformFilter, setPlatformFilter] = useState<SocialPlatformType | "ALL">("ALL");
    const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Schedule modal
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [modalClip, setModalClip] = useState<CalendarClipItem | null>(null);
    const [modalDateString, setModalDateString] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [modalTimeString, setModalTimeString] = useState<string>("18:00");
    const [modalCaption, setModalCaption] = useState<string>("");
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Post details modal
    const [selectedPost, setSelectedPost] = useState<CalendarScheduledPostItem | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(isAnonymous);

    const accounts = initialAccounts;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor),
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsScheduleModalOpen(false);
                setSelectedPost(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        return eachDayOfInterval({
            start: startOfWeek(monthStart, { weekStartsOn: 0 }),
            end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
        });
    }, [currentMonth]);

    const scheduledCountByClipId = useMemo(() => {
        const map = new Map<string, number>();
        for (const post of posts) {
            if (post.status !== "CANCELLED") {
                map.set(post.videoSegmentId, (map.get(post.videoSegmentId) ?? 0) + 1);
            }
        }
        return map;
    }, [posts]);

    const filteredClips = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return initialClips.filter((clip) => {
            const matches = clip.title.toLowerCase().includes(q) || clip.parentVideoTitle.toLowerCase().includes(q);
            if (!matches) return false;
            return onlyUnscheduled ? (scheduledCountByClipId.get(clip.id) ?? 0) === 0 : true;
        });
    }, [initialClips, searchQuery, onlyUnscheduled, scheduledCountByClipId]);

    const totalClipPages = Math.max(1, Math.ceil(filteredClips.length / CLIPS_PER_PAGE));
    const validClipPage = Math.min(clipPage, totalClipPages);
    const paginatedClips = filteredClips.slice((validClipPage - 1) * CLIPS_PER_PAGE, validClipPage * CLIPS_PER_PAGE);

    const visiblePosts = useMemo(
        () => posts.filter((p) => p.status !== "CANCELLED" && (platformFilter === "ALL" || p.platform === platformFilter)),
        [posts, platformFilter],
    );

    const postsByDay = useMemo(() => {
        const map = new Map<string, CalendarScheduledPostItem[]>();
        for (const post of visiblePosts) {
            const key = format(parseISO(post.scheduledFor), "yyyy-MM-dd");
            map.set(key, [...(map.get(key) ?? []), post]);
        }
        for (const list of map.values()) list.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
        return map;
    }, [visiblePosts]);

    const monthMetrics = useMemo(() => {
        const inMonth = posts.filter((p) => p.status !== "CANCELLED" && isSameMonth(parseISO(p.scheduledFor), currentMonth));
        return {
            scheduled: inMonth.filter((p) => p.status === "SCHEDULED" || p.status === "PUBLISHING").length,
            published: inMonth.filter((p) => p.status === "PUBLISHED").length,
            failed: inMonth.filter((p) => p.status === "FAILED").length,
        };
    }, [posts, currentMonth]);

    const monthAgenda = useMemo(
        () =>
            calendarDays
                .filter((day) => isSameMonth(day, currentMonth))
                .map((day) => ({ day, posts: postsByDay.get(format(day, "yyyy-MM-dd")) ?? [] }))
                .filter((entry) => entry.posts.length > 0),
        [calendarDays, currentMonth, postsByDay],
    );

    const openScheduleModal = (clip: CalendarClipItem, targetDate?: Date) => {
        if (isAnonymous) {
            setShowAuthModal(true);
            return;
        }
        setModalClip(clip);
        setModalDateString(format(targetDate ?? new Date(), "yyyy-MM-dd"));
        setModalTimeString("18:00");
        setModalCaption(clip.socialCaption || `${clip.title} #shorts #reels #tiktok`);
        setSelectedAccountIds(accounts[0] ? [accounts[0].id] : []);
        setFormError(null);
        setIsScheduleModalOpen(true);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const payload = event.active.data.current as DragPayload | undefined;
        if (payload) setActiveDrag(payload);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const payload = event.active.data.current as DragPayload | undefined;
        setActiveDrag(null);
        if (!payload || !event.over) return;
        if (!String(event.over.id).startsWith("day-")) return;
        const targetDate = event.over.data.current?.date as Date | undefined;
        if (!targetDate) return;

        if (payload.type === "CLIP") {
            openScheduleModal(payload.clip, targetDate);
            return;
        }

        const previous = payload.post.scheduledFor;
        const existingDate = parseISO(previous);
        if (isSameDay(existingDate, targetDate)) return;
        const newIso = setMinutes(setHours(targetDate, existingDate.getHours()), existingDate.getMinutes()).toISOString();

        setPosts((prev) => prev.map((item) => (item.id === payload.post.id ? { ...item, scheduledFor: newIso } : item)));
        try {
            const response = await fetch(`/api/schedule/${payload.post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scheduledFor: newIso }),
            });
            if (!response.ok) throw new Error();
            setNotice(`Moved to ${format(parseISO(newIso), "EEEE d MMMM")}.`);
        } catch {
            setPosts((prev) => prev.map((item) => (item.id === payload.post.id ? { ...item, scheduledFor: previous } : item)));
            setNotice("The post could not be moved. It is back on its original day.");
        }
    };

    const toggleAccountSelection = (accountId: string) => {
        setFormError(null);
        setSelectedAccountIds((prev) => (prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]));
    };

    const handleScheduleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!modalClip) return;
        if (selectedAccountIds.length === 0) {
            setFormError("Choose at least one account to post to.");
            return;
        }
        const scheduled = new Date(`${modalDateString}T${modalTimeString}:00`);
        if (Number.isNaN(scheduled.getTime())) {
            setFormError("Choose a valid date and time.");
            return;
        }

        setIsSubmitting(true);
        setFormError(null);
        try {
            const response = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    segmentId: modalClip.id,
                    socialAccountIds: selectedAccountIds,
                    caption: modalCaption,
                    scheduledFor: scheduled.toISOString(),
                }),
            });
            const data = (await response.json().catch(() => ({}))) as { posts?: CalendarScheduledPostItem[]; error?: string };
            if (!response.ok || !Array.isArray(data.posts)) {
                throw new Error(data.error ?? "The clip could not be scheduled. Try again.");
            }
            setPosts((prev) => [...prev, ...data.posts!]);
            setIsScheduleModalOpen(false);
            setNotice(`Scheduled for ${format(scheduled, "EEEE d MMMM 'at' HH:mm")}.`);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "The clip could not be scheduled. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelScheduledPost = async (post: CalendarScheduledPostItem) => {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setSelectedPost(null);
        try {
            const response = await fetch(`/api/schedule/${post.id}`, { method: "DELETE" });
            if (!response.ok) throw new Error();
            setNotice("Removed from the schedule.");
        } catch {
            setPosts((prev) => [...prev, post]);
            setNotice("The post could not be removed. Try again.");
        }
    };

    const firstClip = filteredClips[0] ?? initialClips[0];
    const summary = [
        `${monthMetrics.scheduled} scheduled`,
        `${monthMetrics.published} published`,
        ...(monthMetrics.failed > 0 ? [`${monthMetrics.failed} failed`] : []),
    ].join(", ");

    return (
        <DndContext id="calendar-dnd" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col bg-page text-ink lg:h-[calc(100vh-4rem)] lg:flex-row">
                {/* Clip library */}
                <aside
                    aria-label="Clip library"
                    className="flex max-h-[420px] flex-col border-b border-line lg:max-h-none lg:w-[300px] lg:shrink-0 lg:border-b-0 lg:border-r"
                >
                    <div className="space-y-3 border-b border-line p-4">
                        <div className="flex items-baseline justify-between gap-2">
                            <h2 className="font-display text-lg font-medium tracking-[-0.015em]">Clips</h2>
                            <span className="text-[13px] text-muted" aria-live="polite">
                                {filteredClips.length} {filteredClips.length === 1 ? "clip" : "clips"}
                            </span>
                        </div>
                        <div className="relative">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setClipPage(1);
                                }}
                                aria-label="Search clips"
                                placeholder="Search clips"
                                className={`${ui.input} h-10 pl-9 text-sm`}
                            />
                        </div>
                        <div className={ui.segTrack} role="radiogroup" aria-label="Which clips to show">
                            {([
                                [false, "All clips"],
                                [true, "Not scheduled"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={label}
                                    type="button"
                                    role="radio"
                                    aria-checked={onlyUnscheduled === value}
                                    onClick={() => {
                                        setOnlyUnscheduled(value);
                                        setClipPage(1);
                                    }}
                                    className={`${ui.segOption(onlyUnscheduled === value)} h-8`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {filteredClips.length === 0 ? (
                            <div className="px-3 py-10 text-center">
                                <p className="text-sm font-semibold">
                                    {initialClips.length === 0 ? "No clips yet" : "No clips match"}
                                </p>
                                <p className="mx-auto mt-1 max-w-[30ch] text-[13px] text-muted">
                                    {initialClips.length === 0
                                        ? "Clips appear here once a video finishes processing."
                                        : onlyUnscheduled
                                            ? "Every clip is already scheduled. Show all clips to reuse one."
                                            : "Try a different search."}
                                </p>
                                {initialClips.length === 0 && (
                                    <Link href="/" className={`${ui.btnSecondarySm} mt-4`}>
                                        Upload a video
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <ul className="space-y-0.5">
                                {paginatedClips.map((clip) => (
                                    <LibraryClip
                                        key={clip.id}
                                        clip={clip}
                                        scheduledCount={scheduledCountByClipId.get(clip.id) ?? 0}
                                        onSchedule={(c) => openScheduleModal(c)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>

                    {filteredClips.length > CLIPS_PER_PAGE && (
                        <div className="flex items-center justify-between border-t border-line px-3 py-2">
                            <button type="button" onClick={() => setClipPage((p) => Math.max(1, p - 1))} disabled={validClipPage === 1} className={ui.btnQuiet}>
                                Previous
                            </button>
                            <span className="text-[13px] tabular-nums text-muted" aria-live="polite">
                                {validClipPage} of {totalClipPages}
                            </span>
                            <button type="button" onClick={() => setClipPage((p) => Math.min(totalClipPages, p + 1))} disabled={validClipPage === totalClipPages} className={ui.btnQuiet}>
                                Next
                            </button>
                        </div>
                    )}
                    {filteredClips.length > 0 && (
                        <p className="hidden border-t border-line px-4 py-3 text-[13px] text-muted lg:block">
                            Drag a clip onto a day to schedule it.
                        </p>
                    )}
                </aside>

                {/* Month */}
                <section aria-label="Monthly posting schedule" className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
                    <header className="flex flex-wrap items-end justify-between gap-4 px-4 pb-4 pt-6 sm:px-6">
                        <div>
                            <h1 className={ui.h1}>{format(currentMonth, "MMMM yyyy")}</h1>
                            <p className="mt-1 text-base text-muted">{summary} this month.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center">
                                <button type="button" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} aria-label="Previous month" className={ui.btnIcon}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <button type="button" onClick={() => setCurrentMonth(new Date())} className={ui.btnSecondarySm}>
                                    Today
                                </button>
                                <button type="button" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month" className={ui.btnIcon}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>
                            <div role="radiogroup" aria-label="Show posts for" className={ui.segTrack}>
                                <button type="button" role="radio" aria-checked={platformFilter === "ALL"} onClick={() => setPlatformFilter("ALL")} className={`${ui.segOption(platformFilter === "ALL")} h-8 flex-none`}>
                                    All
                                </button>
                                {PLATFORMS.map((platform) => (
                                    <button
                                        key={platform}
                                        type="button"
                                        role="radio"
                                        aria-checked={platformFilter === platform}
                                        aria-label={PLATFORM_LABEL[platform].label}
                                        title={PLATFORM_LABEL[platform].label}
                                        onClick={() => setPlatformFilter(platform)}
                                        className={`${ui.segOption(platformFilter === platform)} h-8 flex-none px-2.5`}
                                    >
                                        <PlatformIcon platform={platform} className={`h-4 w-4 ${PLATFORM_COLOR[platform]}`} />
                                        <span className="hidden xl:inline">{PLATFORM_LABEL[platform].short}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    {notice && (
                        <div role="status" className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-sm sm:mx-6">
                            <span>{notice}</span>
                            <button type="button" onClick={() => setNotice(null)} className={`${ui.btnQuiet} h-7 px-2`}>
                                Dismiss
                            </button>
                        </div>
                    )}

                    {/* Grid (tablet and up) */}
                    <div className="hidden px-4 pb-6 sm:px-6 md:block">
                        <div className="overflow-hidden rounded-xl border border-line">
                            <div className="grid grid-cols-7 border-b border-line bg-surface">
                                {WEEKDAYS.map((name) => (
                                    <div key={name} className="px-2 py-2 text-[13px] font-medium text-muted">
                                        {name}
                                    </div>
                                ))}
                            </div>
                            <div className="-mb-px -mr-px grid grid-cols-7">
                                {calendarDays.map((day) => (
                                    <DayCell
                                        key={day.toISOString()}
                                        day={day}
                                        inMonth={isSameMonth(day, currentMonth)}
                                        posts={postsByDay.get(format(day, "yyyy-MM-dd")) ?? []}
                                        canAdd={Boolean(firstClip)}
                                        onAdd={(date) => firstClip && openScheduleModal(firstClip, date)}
                                        onSelectPost={setSelectedPost}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Agenda (phones) */}
                    <div className="px-4 pb-8 md:hidden">
                        {monthAgenda.length === 0 ? (
                            <div className="rounded-xl border border-line px-4 py-10 text-center">
                                <p className="text-sm font-semibold">Nothing scheduled in {format(currentMonth, "MMMM")}</p>
                                <p className="mt-1 text-[13px] text-muted">Pick a clip above and choose Schedule.</p>
                            </div>
                        ) : (
                            <ol className="space-y-5">
                                {monthAgenda.map(({ day, posts: dayPosts }) => (
                                    <li key={day.toISOString()}>
                                        <p className={`mb-2 text-sm font-semibold ${isToday(day) ? "text-link" : "text-ink"}`}>
                                            {format(day, "EEEE d MMMM")}
                                        </p>
                                        <div className="space-y-1.5">
                                            {dayPosts.map((post) => (
                                                <button
                                                    key={post.id}
                                                    type="button"
                                                    onClick={() => setSelectedPost(post)}
                                                    className={`flex w-full items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5 text-left ${ui.focusRing}`}
                                                >
                                                    <PlatformIcon platform={post.platform} className={`h-4 w-4 shrink-0 ${PLATFORM_COLOR[post.platform]}`} />
                                                    <span className="w-12 shrink-0 text-sm tabular-nums text-muted">{format(parseISO(post.scheduledFor), "HH:mm")}</span>
                                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{post.segmentTitle}</span>
                                                    <span className={`${badgeBase} ${STATUS_BADGE[post.status].className}`}>{STATUS_BADGE[post.status].label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            </div>

            <DragOverlay>
                {activeDrag?.type === "CLIP" && (
                    <div className="flex w-64 items-center gap-3 rounded-lg border border-action bg-raised p-2 shadow-[0_24px_48px_-24px_rgba(14,20,36,0.5)]">
                        <ClipThumb clip={activeDrag.clip} className="h-14 w-8" />
                        <p className="line-clamp-2 text-sm font-semibold">{activeDrag.clip.title}</p>
                    </div>
                )}
                {activeDrag?.type === "POST" && (
                    <div className="flex h-8 w-56 items-center gap-2 rounded-md border border-action bg-raised px-2 text-[13px] font-medium shadow-[0_24px_48px_-24px_rgba(14,20,36,0.5)]">
                        <PlatformIcon platform={activeDrag.post.platform} className={`h-3.5 w-3.5 ${PLATFORM_COLOR[activeDrag.post.platform]}`} />
                        <span className="truncate">{activeDrag.post.segmentTitle}</span>
                    </div>
                )}
            </DragOverlay>

            {/* Schedule modal */}
            {isScheduleModalOpen && modalClip && (
                <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className={ui.modalBackdrop}>
                    <div className={`${ui.modal} max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto`}>
                        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                            <div className="min-w-0">
                                <h2 id="schedule-title" className={ui.h2}>Schedule a clip</h2>
                                <p className="mt-0.5 truncate text-sm text-muted">{modalClip.parentVideoTitle}</p>
                            </div>
                            <button type="button" onClick={() => setIsScheduleModalOpen(false)} aria-label="Close" className={ui.btnIcon}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleScheduleSubmit} className="grid gap-6 p-6 sm:grid-cols-[168px_minmax(0,1fr)]">
                            <div className="hidden sm:block">
                                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-frame">
                                    {modalClip.previewVideoUrl ? (
                                        <video src={modalClip.previewVideoUrl} poster={modalClip.thumbnailUrl ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
                                    ) : (
                                        <ClipThumb clip={modalClip} className="h-full w-full rounded-none" />
                                    )}
                                </div>
                                <p className="mt-2 text-[13px] text-muted">
                                    <span className="tabular-nums">{clipLength(modalClip.durationSeconds)}</span>, {RATIO_LABEL[modalClip.aspectRatio]}
                                </p>
                            </div>

                            <div className="space-y-5">
                                <label className="block">
                                    <span className={ui.label}>Clip</span>
                                    <select
                                        value={modalClip.id}
                                        onChange={(e) => {
                                            const found = initialClips.find((c) => c.id === e.target.value);
                                            if (found) {
                                                setModalClip(found);
                                                setModalCaption(found.socialCaption || found.title);
                                            }
                                        }}
                                        className={ui.input}
                                    >
                                        {initialClips.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <fieldset>
                                    <legend className={ui.label}>Post to</legend>
                                    {accounts.length === 0 ? (
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
                                                <button
                                                    key={acc.id}
                                                    type="button"
                                                    aria-pressed={selectedAccountIds.includes(acc.id)}
                                                    onClick={() => toggleAccountSelection(acc.id)}
                                                    className={ui.chip(selectedAccountIds.includes(acc.id))}
                                                >
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
                                            <input type="date" required value={modalDateString} onChange={(e) => setModalDateString(e.target.value)} className={ui.input} />
                                        </label>
                                        <label className="block">
                                            <span className={ui.label}>Time</span>
                                            <input type="time" required value={modalTimeString} onChange={(e) => setModalTimeString(e.target.value)} className={ui.input} />
                                        </label>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common posting times">
                                        {QUICK_TIMES.map((preset) => (
                                            <button key={preset.time} type="button" onClick={() => setModalTimeString(preset.time)} aria-pressed={modalTimeString === preset.time} className={`${ui.chip(modalTimeString === preset.time)} h-8 px-2.5 tabular-nums`}>
                                                {preset.display}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label className="block">
                                    <span className="mb-1.5 flex items-baseline justify-between">
                                        <span className="text-[13px] font-medium">Caption</span>
                                        <span className="text-[13px] tabular-nums text-muted">{modalCaption.length} / 2200</span>
                                    </span>
                                    <textarea rows={4} maxLength={2200} value={modalCaption} onChange={(e) => setModalCaption(e.target.value)} className={ui.textarea} />
                                </label>

                                {formError && (
                                    <p role="alert" className="text-sm font-medium text-danger">
                                        {formError}
                                    </p>
                                )}

                                <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                                    <button type="button" onClick={() => setIsScheduleModalOpen(false)} className={ui.btnSecondary}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSubmitting || accounts.length === 0} className={ui.btnPrimary}>
                                        {isSubmitting
                                            ? "Scheduling"
                                            : selectedAccountIds.length > 1
                                                ? `Schedule to ${selectedAccountIds.length} accounts`
                                                : "Schedule post"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Post details */}
            {selectedPost && (
                <div role="dialog" aria-modal="true" aria-labelledby="post-title" className={ui.modalBackdrop}>
                    <div className={`${ui.modal} max-w-md p-6`}>
                        <div className="flex items-start justify-between gap-4">
                            <span className={`${badgeBase} ${STATUS_BADGE[selectedPost.status].className}`}>{STATUS_BADGE[selectedPost.status].label}</span>
                            <button type="button" onClick={() => setSelectedPost(null)} aria-label="Close" className={`${ui.btnIcon} -mr-2 -mt-1`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <h2 id="post-title" className={`${ui.h2} mt-3`}>{selectedPost.segmentTitle}</h2>

                        <dl className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
                            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                                <dt className="text-muted">Account</dt>
                                <dd className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                                    <PlatformIcon platform={selectedPost.platform} className={`h-4 w-4 shrink-0 ${PLATFORM_COLOR[selectedPost.platform]}`} />
                                    <span className="truncate">{selectedPost.accountName}</span>
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                                <dt className="text-muted">{selectedPost.status === "PUBLISHED" ? "Published" : "Posts on"}</dt>
                                <dd className="font-medium tabular-nums">{format(parseISO(selectedPost.scheduledFor), "EEE d MMM yyyy, HH:mm")}</dd>
                            </div>
                        </dl>

                        <p className="mt-4 text-[13px] font-medium">Caption</p>
                        <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm leading-relaxed">
                            {selectedPost.caption || "No caption"}
                        </p>

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                            {selectedPost.status !== "PUBLISHED" ? (
                                <button type="button" onClick={() => void handleCancelScheduledPost(selectedPost)} className={ui.btnDanger}>
                                    Remove from schedule
                                </button>
                            ) : (
                                <span />
                            )}
                            {selectedPost.status === "PUBLISHED" && selectedPost.publishedUrl ? (
                                <a href={selectedPost.publishedUrl} target="_blank" rel="noopener noreferrer" className={ui.btnPrimarySm}>
                                    View the post
                                </a>
                            ) : (
                                <button type="button" onClick={() => setSelectedPost(null)} className={ui.btnSecondarySm}>
                                    Done
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
        </DndContext>
    );
}
