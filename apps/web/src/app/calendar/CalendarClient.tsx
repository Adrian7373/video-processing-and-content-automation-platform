"use client";

import React, { useState, useMemo, useEffect } from "react";
import AuthGateModal from "../components/AuthGateModal";
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    PointerSensor,
    KeyboardSensor,
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
    isAnonymous: boolean;
}

const CLIPS_PER_PAGE = 10;

type DragPayload =
    | { type: "CLIP"; clip: CalendarClipItem }
    | { type: "POST"; post: CalendarScheduledPostItem };

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
            "bg-raised/95 border-line hover:border-danger/50 text-ink",
        accentBar: "bg-danger",
        iconColor: "text-danger",
        activeRing: "border-danger/60 bg-danger/10 text-page",
    },
    TIKTOK: {
        label: "TikTok",
        shortLabel: "TikTok",
        pillSurface:
            "bg-raised/95 border-line hover:border-cyan-400/50 text-ink",
        accentBar: "bg-cyan-400",
        iconColor: "text-cyan-700 dark:text-cyan-300",
        activeRing: "border-cyan-400/60 bg-cyan-400/10 text-ink",
    },
    INSTAGRAM_REELS: {
        label: "Instagram Reels",
        shortLabel: "Reels",
        pillSurface:
            "bg-raised/95 border-line hover:border-pink-500/50 text-ink",
        accentBar: "bg-pink-500",
        iconColor: "text-pink-700 dark:text-pink-400",
        activeRing: "border-pink-500/60 bg-pink-500/10 text-ink",
    },
    FACEBOOK_REELS: {
        label: "Facebook Reels",
        shortLabel: "FB Reels",
        pillSurface:
            "bg-raised/95 border-line hover:border-blue-500/50 text-ink",
        accentBar: "bg-blue-500",
        iconColor: "text-blue-700 dark:text-blue-400",
        activeRing: "border-blue-500/60 bg-blue-500/10 text-ink",
    },
};

const STATUS_META: Record<
    PublishStatusType,
    { label: string; badgeClass: string; dotClass: string }
> = {
    SCHEDULED: {
        label: "Scheduled",
        badgeClass: "border-action/30 bg-action/15 text-link",
        dotClass: "bg-action",
    },
    PUBLISHING: {
        label: "Publishing",
        badgeClass: "border-action/30 bg-action/12 text-link",
        dotClass: "bg-action animate-ping",
    },
    PUBLISHED: {
        label: "Published",
        badgeClass: "border-success/30 bg-success/10 text-success",
        dotClass: "bg-success",
    },
    FAILED: {
        label: "Failed",
        badgeClass: "border-danger/30 bg-danger/10 text-danger",
        dotClass: "bg-danger",
    },
    CANCELLED: {
        label: "Cancelled",
        badgeClass: "border-line-strong bg-surface text-muted",
        dotClass: "bg-muted",
    },
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

function formatDurationBadge(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
        ? `${mins}:${String(secs).padStart(2, "0")}`
        : `0:${String(secs).padStart(2, "0")}`;
}

function DraggableClipCard({
    clip,
    scheduledCount,
    onQuickSchedule,
}: {
    clip: CalendarClipItem;
    scheduledCount: number;
    onQuickSchedule: (clip: CalendarClipItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: `clip-${clip.id}`,
            data: { type: "CLIP", clip } satisfies DragPayload,
        });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
    };

    const ratioLabel =
        clip.aspectRatio === "VERTICAL_9_16"
            ? "9:16"
            : clip.aspectRatio === "SQUARE_1_1"
                ? "1:1"
                : "16:9";

    return (
        <article
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            aria-label={`Draggable clip: ${clip.title}`}
            className={`group relative flex cursor-grab gap-3.5 rounded-xl border border-line bg-page p-3 transition-all duration-150 hover:border-line-strong hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "opacity-100"
                }`}
        >
            {/* Reserved 9:16 Media Thumbnail Container (Prevents CLS) */}
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-page">
                {clip.thumbnailUrl ? (
                    <img
                        src={clip.thumbnailUrl}
                        alt={clip.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-page from-raised to-page p-1.5 text-center">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            aria-hidden="true"
                            className="h-5 w-5 text-muted transition-colors group-hover:text-link"
                        >
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                    </div>
                )}

                {/* Duration Overlay */}
                <span className="absolute bottom-1 right-1 rounded bg-page/90 px-1 py-0.5 tabular-nums text-xs font-medium text-ink">
                    {formatDurationBadge(clip.durationSeconds)}
                </span>
            </div>

            {/* Card Content */}
            <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate rounded bg-action/12 px-1.5 py-0.5 text-xs font-semibold text-link">
                            {clip.thumbnailText || "HIGHLIGHT"}
                        </span>

                        {/* Subtle Drag Grip Indicator */}
                        <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-muted"
                        >
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                        </svg>
                    </div>

                    <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold leading-snug text-ink">
                        {clip.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                        {clip.parentVideoTitle}
                    </p>
                </div>

                {/* Metadata & Action Row */}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="rounded bg-surface px-1.5 py-0.5 tabular-nums text-ink">
                            {ratioLabel}
                        </span>
                        {clip.hasBurnedCaptions && (
                            <span
                                title="Burned-in subtitles included"
                                className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success"
                            >
                                CC
                            </span>
                        )}
                        {scheduledCount > 0 && (
                            <span className="rounded bg-action/15 px-1.5 py-0.5 font-medium text-link">
                                {scheduledCount}× queued
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onQuickSchedule(clip)}
                        aria-label={`Schedule ${clip.title}`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-line-strong bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink transition hover:border-action/60 hover:bg-action-press hover:text-action-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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

function DraggableScheduledPostPill({
    post,
    onSelectPost,
}: {
    post: CalendarScheduledPostItem;
    onSelectPost: (post: CalendarScheduledPostItem) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: `post-${post.id}`,
            data: { type: "POST", post } satisfies DragPayload,
        });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
    };

    const platformMeta = PLATFORM_META[post.platform];
    const statusMeta = STATUS_META[post.status];
    const timeFormatted = format(parseISO(post.scheduledFor), "h:mm a");

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            role="button"
            tabIndex={0}
            aria-label={`${platformMeta.label} post: ${post.segmentTitle} scheduled at ${timeFormatted}`}
            onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post);
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPost(post);
                }
            }}
            className={`group relative flex cursor-grab items-center justify-between gap-2 overflow-hidden rounded-lg border py-1.5 pl-2.5 pr-2 text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing ${platformMeta.pillSurface
                } ${isDragging ? "scale-95 opacity-30" : "opacity-100"}`}
        >
            {/* Left Platform Accent Bar */}
            <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${platformMeta.accentBar}`}
            />

            <div className="flex min-w-0 items-center gap-1.5">
                <span className={`shrink-0 ${platformMeta.iconColor}`}>
                    <PlatformIcon
                        platform={post.platform}
                        className="h-3.5 w-3.5"
                    />
                </span>
                <span className="truncate font-medium text-ink">
                    {post.segmentTitle}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <span className="tabular-nums text-xs text-muted">
                    {timeFormatted}
                </span>
                <span
                    title={`Status: ${statusMeta.label}`}
                    className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                />
            </div>
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
            className={`group relative flex min-h-[148px] flex-col justify-between border-b border-r border-line p-2.5 transition-colors duration-150 ${isCurrentMonth
                ? "bg-page"
                : "bg-page"
                } ${isOver
                    ? "bg-action/12 ring-2 ring-inset ring-focus"
                    : today
                        ? "bg-surface"
                        : ""
                }`}
        >
            <div>
                {/* Day Header */}
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${today
                                ? "bg-action font-semibold text-action-ink "
                                : isCurrentMonth
                                    ? "text-ink"
                                    : "text-muted"
                                }`}
                        >
                            {format(day, "d")}
                        </span>
                        {today && (
                            <span className="rounded bg-action/15 px-1.5 py-0.5 text-xs font-semibold text-link">
                                Today
                            </span>
                        )}
                    </div>

                    {/* Accessible Add Button (Always Keyboard-Focusable, Visible on Subtle Contrast) */}
                    <button
                        type="button"
                        onClick={() => onAddClick(day)}
                        aria-label={`Schedule clip on ${format(day, "MMMM d, yyyy")}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted transition hover:border-line-strong hover:bg-surface hover:text-ink focus-visible:border-action focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>

                {/* Scheduled Posts List */}
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

            {/* Active Drop Zone Feedback */}
            {isOver && (
                <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-action/70 bg-action/12 py-1.5 text-xs font-semibold text-link">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
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
    isAnonymous,
}: CalendarClientProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
    const [posts, setPosts] =
        useState<CalendarScheduledPostItem[]>(initialPosts);
    const [searchQuery, setSearchQuery] = useState("");
    const [clipPage, setClipPage] = useState(1);
    const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
    const [platformFilter, setPlatformFilter] = useState<
        SocialPlatformType | "ALL"
    >("ALL");

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
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Post Details Modal state
    const [selectedPost, setSelectedPost] =
        useState<CalendarScheduledPostItem | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(isAnonymous);

    const accounts = initialAccounts;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor),
    );

    // Close modals on Escape key for keyboard accessibility
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
        const monthEnd = endOfMonth(monthStart);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [currentMonth]);

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

    const totalClipPages = Math.max(
        1,
        Math.ceil(filteredClips.length / CLIPS_PER_PAGE),
    );
    const validClipPage = Math.min(clipPage, totalClipPages);
    const paginatedClips = filteredClips.slice(
        (validClipPage - 1) * CLIPS_PER_PAGE,
        validClipPage * CLIPS_PER_PAGE,
    );

    // Monthly KPI Summary
    const monthMetrics = useMemo(() => {
        const activeMonthPosts = posts.filter(
            (p) =>
                p.status !== "CANCELLED" &&
                isSameMonth(parseISO(p.scheduledFor), currentMonth),
        );
        return {
            total: activeMonthPosts.length,
            scheduled: activeMonthPosts.filter((p) => p.status === "SCHEDULED")
                .length,
            published: activeMonthPosts.filter((p) => p.status === "PUBLISHED")
                .length,
        };
    }, [posts, currentMonth]);

    const openScheduleModal = (clip: CalendarClipItem, targetDate?: Date) => {
        if (isAnonymous) {
            setShowAuthModal(true);
            return;
        }
        setModalClip(clip);
        setModalDateString(format(targetDate ?? new Date(), "yyyy-MM-dd"));
        setModalTimeString("18:00");
        setModalCaption(
            clip.socialCaption || `${clip.title} #shorts #reels #tiktok`,
        );
        setSelectedAccountIds(accounts[0] ? [accounts[0].id] : []);
        setFormError(null);
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

            setPosts((prev) =>
                prev.map((item) =>
                    item.id === payload.post.id
                        ? { ...item, scheduledFor: newIso }
                        : item,
                ),
            );

            try {
                await fetch(`/api/schedule/${payload.post.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scheduledFor: newIso }),
                });
            } catch {
                // Keep optimistic UI state
            }
        }
    };

    const toggleAccountSelection = (accountId: string) => {
        setFormError(null);
        setSelectedAccountIds((prev) =>
            prev.includes(accountId)
                ? prev.filter((id) => id !== accountId)
                : [...prev, accountId],
        );
    };

    const handleScheduleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!modalClip) return;

        if (selectedAccountIds.length === 0) {
            setFormError("Select at least one target platform to schedule.");
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        const scheduledDateTime = new Date(
            `${modalDateString}T${modalTimeString}:00`,
        );
        const scheduledIso = scheduledDateTime.toISOString();

        try {
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
            <div className="grid max-w-[1600px] grid-cols-1 bg-page text-ink lg:grid-cols-[380px_1fr]">
                {/* LEFT SIDEBAR: Ready Clips Backlog */}
                <aside
                    aria-label="Clip library"
                    className="flex h-[calc(100vh-73px)] flex-col border-r border-line bg-page"
                >
                    <div className="border-b border-line p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold tracking-tight text-ink">
                                    Clip library
                                </h2>
                                <span
                                    aria-live="polite"
                                    className="rounded-full border border-line-strong bg-surface px-2 py-0.5 tabular-nums text-xs font-medium text-ink"
                                >
                                    {filteredClips.length}
                                </span>
                            </div>

                            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-ink hover:text-ink">
                                <input
                                    type="checkbox"
                                    checked={onlyUnscheduled}
                                    onChange={(e) => {
                                        setOnlyUnscheduled(e.target.checked);
                                        setClipPage(1);
                                    }}
                                    className="h-4 w-4 rounded border-line-strong bg-raised text-link focus:ring-2 focus:ring-focus focus:ring-offset-0"
                                />
                                Unscheduled only
                            </label>
                        </div>

                        {/* Search Field with SVG Icon */}
                        <div className="relative mt-3">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setClipPage(1);
                                }}
                                aria-label="Search clips by title"
                                placeholder="Search clips or source video..."
                                className="block w-full rounded-xl border border-line bg-page/90 py-2 pl-9 pr-3 text-xs text-ink placeholder:text-muted transition focus:border-action focus:outline-none focus:ring-1 focus:ring-focus"
                            />
                        </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {filteredClips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-page px-5 py-10 text-center">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface/80 text-muted">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        aria-hidden="true"
                                        className="h-5 w-5"
                                    >
                                        <rect
                                            x="2"
                                            y="2"
                                            width="20"
                                            height="20"
                                            rx="2.18"
                                            ry="2.18"
                                        />
                                        <line x1="7" y1="2" x2="7" y2="22" />
                                        <line x1="17" y1="2" x2="17" y2="22" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                    </svg>
                                </div>
                                <p className="mt-3 text-sm font-semibold text-ink">
                                    No matching clips
                                </p>
                                <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted">
                                    {onlyUnscheduled
                                        ? "All available clips have been scheduled. Uncheck the filter to re-queue."
                                        : "Process a video in the studio or clear your search query."}
                                </p>
                            </div>
                        ) : (
                            paginatedClips.map((clip) => (
                                <DraggableClipCard
                                    key={clip.id}
                                    clip={clip}
                                    scheduledCount={
                                        scheduledCountByClipId.get(clip.id) ?? 0
                                    }
                                    onQuickSchedule={(c) =>
                                        openScheduleModal(c)
                                    }
                                />
                            ))
                        )}
                    </div>
                    {filteredClips.length > CLIPS_PER_PAGE && (
                        <div className="flex items-center justify-between border-t border-line px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setClipPage((page) => Math.max(1, page - 1))}
                                disabled={validClipPage === 1}
                                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-muted" aria-live="polite">
                                Page {validClipPage} of {totalClipPages}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setClipPage((page) =>
                                        Math.min(totalClipPages, page + 1),
                                    )
                                }
                                disabled={validClipPage === totalClipPages}
                                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </aside>

                {/* RIGHT MAIN WORKSPACE: Calendar */}
                <section
                    aria-label="Monthly posting schedule"
                    className="flex min-h-[calc(100vh-73px)] flex-col bg-page"
                >
                    {/* Calendar Top Control Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-page px-6 py-3.5">
                        {/* Left: Month Title & 44px Touch-Friendly Navigation */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center rounded-xl border border-line bg-raised p-0.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentMonth((m) => subMonths(m, 1))
                                    }
                                    aria-label="Previous month"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                    >
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentMonth(new Date())}
                                    className="px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentMonth((m) => addMonths(m, 1))
                                    }
                                    aria-label="Next month"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>
                            </div>

                            <div>
                                <h2 className="text-lg font-medium font-display tracking-tight text-ink">
                                    {format(currentMonth, "MMMM yyyy")}
                                </h2>
                                <p className="text-xs text-muted">
                                    <span className="font-semibold text-ink">
                                        {monthMetrics.scheduled}
                                    </span>{" "}
                                    queued,{" "}
                                    <span className="font-semibold text-success">
                                        {monthMetrics.published}
                                    </span>{" "}
                                    published this month
                                </p>
                            </div>
                        </div>

                        {/* Right: Interactive Platform Filter Pills */}
                        <div
                            role="group"
                            aria-label="Filter calendar by platform"
                            className="flex flex-wrap items-center gap-1.5"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setPlatformFilter("ALL");
                                    setClipPage(1);
                                }}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${platformFilter === "ALL"
                                    ? "border-action/60 bg-action/15 text-link"
                                    : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink"
                                    }`}
                            >
                                All Channels
                            </button>

                            {(
                                Object.keys(
                                    PLATFORM_META,
                                ) as SocialPlatformType[]
                            ).map((platform) => {
                                const meta = PLATFORM_META[platform];
                                const active = platformFilter === platform;
                                return (
                                    <button
                                        key={platform}
                                        type="button"
                                        onClick={() => {
                                            setPlatformFilter(
                                                active ? "ALL" : platform,
                                            );
                                            setClipPage(1);
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${active
                                            ? meta.activeRing
                                            : "border-line bg-raised/90 text-muted hover:border-line-strong hover:text-ink"
                                            }`}
                                    >
                                        <span className={meta.iconColor}>
                                            <PlatformIcon
                                                platform={platform}
                                                className="h-3.5 w-3.5"
                                            />
                                        </span>
                                        <span>{meta.shortLabel}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Weekday Column Headers */}
                    <div className="grid grid-cols-7 border-b border-line bg-raised/80 text-center text-xs font-semibold text-muted">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                            (dayName) => (
                                <div
                                    key={dayName}
                                    className="border-r border-line py-2.5 last:border-r-0"
                                >
                                    {dayName}
                                </div>
                            ),
                        )}
                    </div>

                    {/* 7-Column Calendar Grid */}
                    <div className="grid flex-1 grid-cols-7">
                        {calendarDays.map((day) => {
                            const dayPosts = posts.filter(
                                (p) =>
                                    p.status !== "CANCELLED" &&
                                    (platformFilter === "ALL" ||
                                        p.platform === platformFilter) &&
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

            {/* Drag Overlay with Spatial Continuity */}
            <DragOverlay>
                {activeDrag?.type === "CLIP" && (
                    <div className="flex w-72 items-center gap-3 rounded-xl border border-action bg-raised/95 p-3 shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)] ring-4 ring-action/20">
                        <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-page tabular-nums text-xs font-semibold text-link">
                            {formatDurationBadge(
                                activeDrag.clip.durationSeconds,
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="inline-block rounded bg-action/20 px-1.5 py-0.5 text-xs font-semibold text-link">
                                {activeDrag.clip.thumbnailText}
                            </span>
                            <p className="mt-1 truncate text-xs font-semibold text-ink">
                                {activeDrag.clip.title}
                            </p>
                        </div>
                    </div>
                )}
                {activeDrag?.type === "POST" && (
                    <div className="flex w-60 items-center gap-2 rounded-lg border border-action bg-raised px-3 py-2 text-xs font-semibold text-ink shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)] ring-4 ring-action/20">
                        <span
                            className={
                                PLATFORM_META[activeDrag.post.platform]
                                    .iconColor
                            }
                        >
                            <PlatformIcon
                                platform={activeDrag.post.platform}
                                className="h-4 w-4"
                            />
                        </span>
                        <span className="truncate">
                            Move: {activeDrag.post.segmentTitle}
                        </span>
                    </div>
                )}
            </DragOverlay>

            {/* SCHEDULE POST MODAL */}
            {isScheduleModalOpen && modalClip && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="schedule-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
                >
                    <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-page shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-line px-6 py-4">
                            <div>
                                <span className="text-xs font-semibold text-link">
                                    Schedule Distribution
                                </span>
                                <h3
                                    id="schedule-modal-title"
                                    className="mt-0.5 text-base font-semibold text-ink"
                                >
                                    {modalClip.title}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsScheduleModalOpen(false)}
                                aria-label="Close schedule modal"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
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
                            <div className="flex flex-col justify-between rounded-xl border border-line bg-page p-3">
                                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-raised">
                                    {modalClip.previewVideoUrl ? (
                                        <video src={modalClip.previewVideoUrl} poster={modalClip.thumbnailUrl ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
                                    ) : modalClip.thumbnailUrl ? (
                                        <img src={modalClip.thumbnailUrl} alt={modalClip.title} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                                            <span className="rounded bg-action/15 px-2 py-1 text-xs font-semibold text-link">
                                                {modalClip.thumbnailText}
                                            </span>
                                            <p className="mt-2 text-xs text-muted">{modalClip.title}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                                    <span>Duration</span>
                                    <span className="tabular-nums font-semibold text-ink">
                                        {formatDurationBadge(modalClip.durationSeconds)}
                                    </span>
                                </div>
                            </div>

                            {/* Right Column: Form Controls */}
                            <div className="space-y-4">
                                {/* Clip Selector */}
                                <div>
                                    <label htmlFor="schedule-clip-select" className="mb-1.5 block text-xs font-semibold text-ink">Active clip</label>
                                    <select
                                        id="schedule-clip-select"
                                        value={modalClip.id}
                                        onChange={(e) => {
                                            const found = initialClips.find((c) => c.id === e.target.value);
                                            if (found) {
                                                setModalClip(found);
                                                setModalCaption(found.socialCaption || found.title);
                                            }
                                        }}
                                        className="block w-full rounded-xl border border-line-strong bg-page px-3 py-2 text-xs text-ink focus:border-action focus:outline-none focus:ring-1 focus:ring-focus"
                                    >
                                        {initialClips.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.title} ({formatDurationBadge(c.durationSeconds)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Post to */}
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-ink">Post to</span>
                                        <span className="text-xs text-muted">{selectedAccountIds.length} selected</span>
                                    </div>
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
                                                    className={`flex min-h-[42px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isSelected ? meta.activeRing : "border-line bg-page text-muted hover:border-line-strong hover:text-ink"}`}
                                                >
                                                    <span className={meta.iconColor}>
                                                        <PlatformIcon platform={acc.platform} className="h-4 w-4" />
                                                    </span>
                                                    <span className="truncate">{acc.accountName}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {formError && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{formError}</p>}
                                </div>

                                {/* Date & Time + Quick Presets */}
                                <div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-semibold text-ink">Date</span>
                                            <input type="date" required value={modalDateString} onChange={(e) => setModalDateString(e.target.value)} className="block w-full rounded-xl border border-line-strong bg-page px-3 py-2 text-xs text-ink focus:border-action focus:outline-none focus:ring-1 focus:ring-focus" />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-semibold text-ink">Time</span>
                                            <input type="time" required value={modalTimeString} onChange={(e) => setModalTimeString(e.target.value)} className="block w-full rounded-xl border border-line-strong bg-page px-3 py-2 text-xs text-ink focus:border-action focus:outline-none focus:ring-1 focus:ring-focus" />
                                        </label>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span className="mr-1 text-xs text-muted">Quick slots:</span>
                                        {QUICK_TIME_PRESETS.map((preset) => (
                                            <button key={preset.time} type="button" onClick={() => setModalTimeString(preset.time)} className={`rounded-md border px-2 py-0.5 tabular-nums text-xs transition ${modalTimeString === preset.time ?"border-sky-400/60 bg-sky-400/15 text-sky-300" : "border-line bg-page text-muted hover:border-line-strong hover:text-ink"}`}>
                                                {preset.display}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Caption */}
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <label htmlFor="schedule-caption-input" className="text-xs font-semibold text-ink">Caption and hashtags</label>
                                        <span className="tabular-nums text-xs text-muted">{modalCaption.length} / 2200</span>
                                    </div>
                                    <textarea
                                        id="schedule-caption-input"
                                        rows={3}
                                        maxLength={2200}
                                        value={modalCaption}
                                        onChange={(e) => setModalCaption(e.target.value)}
                                        placeholder="Write a hook and relevant hashtags (#shorts #reels #tiktok)..."
                                        className="block w-full rounded-xl border border-line-strong bg-page p-3 text-xs leading-relaxed text-ink placeholder:text-muted focus:border-action focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Submit Actions */}
                                <div className="flex items-center justify-end gap-2.5 border-t border-line pt-4">
                                    <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="min-h-[40px] rounded-lg border border-line-strong px-4 py-2 text-xs font-semibold text-ink transition hover:bg-surface hover:text-ink">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="min-h-[40px] rounded-lg bg-action px-5 py-2 text-xs font-semibold text-action-ink transition hover:bg-action-hover disabled:opacity-50">
                                        {isSubmitting ? "Scheduling post" : `Confirm Schedule (${selectedAccountIds.length})`}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* POST DETAILS MODAL */}
            {selectedPost && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="post-detail-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
                >
                    <div className="w-full max-w-md rounded-xl border border-line bg-raised p-6 shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                        <div className="flex items-center justify-between">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[selectedPost.status].badgeClass
                                    }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${STATUS_META[selectedPost.status].dotClass
                                        }`}
                                />
                                {STATUS_META[selectedPost.status].label}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedPost(null)}
                                aria-label="Close post details"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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

                        <h3
                            id="post-detail-title"
                            className="mt-3 text-base font-semibold text-ink"
                        >
                            {selectedPost.segmentTitle}
                        </h3>

                        {/* NEW: LIVE VIDEO LINK BLOCK */}
                        {selectedPost.status === "PUBLISHED" && selectedPost.publishedUrl && (
                            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-action/20 bg-action/12 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2.5 w-2.5 rounded-full bg-action shadow-[0_0_8px_rgba(56,189,248,0.8)]" aria-hidden="true"></span>
                                    <span className="text-sm font-medium text-link">Published</span>
                                </div>
                                <a
                                    href={selectedPost.publishedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-action-ink transition-colors hover:bg-action-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                                >
                                    View Live Video
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                </a>
                            </div>
                        )}

                        <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-page/70 p-3 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-muted">Channel</span>
                                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                                    <span
                                        className={
                                            PLATFORM_META[selectedPost.platform].iconColor
                                        }
                                    >
                                        <PlatformIcon
                                            platform={selectedPost.platform}
                                            className="h-3.5 w-3.5"
                                        />
                                    </span>
                                    {PLATFORM_META[selectedPost.platform].label}{" "}
                                    ({selectedPost.accountName})
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted">
                                    Publish Slot
                                </span>
                                <span className="tabular-nums font-medium text-ink">
                                    {format(
                                        parseISO(selectedPost.scheduledFor),
                                        "MMM d, yyyy · h:mm a",
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4">
                            <span className="mb-1 block text-xs font-semibold text-muted">
                                Scheduled Caption
                            </span>
                            <div className="max-h-32 overflow-y-auto rounded-xl border border-line bg-page p-3 text-xs leading-relaxed text-ink">
                                {selectedPost.caption || "No caption provided."}
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-3">
                            {/* Hide cancel button if it's already published */}
                            {selectedPost.status !== "PUBLISHED" ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleCancelScheduledPost(selectedPost.id)
                                    }
                                    className="min-h-[38px] rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2 text-xs font-semibold text-danger transition hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                                >
                                    Remove from Queue
                                </button>
                            ) : (
                                <div></div> /* Spacer to push 'Done' to the right */
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedPost(null)}
                                className="min-h-[38px] rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-ink transition hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAuthModal && (
                <AuthGateModal
                    reasonMessage="Sign in or create an account before scheduling posts. You will also need to connect a social account."
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