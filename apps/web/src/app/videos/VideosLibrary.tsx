"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type VideoCard = {
    id: string;
    title: string;
    status: "UPLOADING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    userPrompt: string | null;
    aspectRatio: string;
    captionStyle: string;
    errorMessage: string | null;
    errorCode?: string | null;
    lastHeartbeatAt?: Date | string | null;
    createdAt: Date | string;
    thumbnailUrl?: string | null;
    _count: { segments: number };
};

function formatProjectDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
}

function cleanVideoTitle(rawTitle: string): string {
    return rawTitle.replace(/\.(mp4|mov|webm|mkv)$/i, "");
}

export default function VideosLibrary({
    initialVideos,
    currentPage,
    totalPages,
}: {
    initialVideos: VideoCard[];
    currentPage: number;
    totalPages: number;
}) {
    const router = useRouter();
    const [videos, setVideos] = useState<VideoCard[]>(initialVideos);
    const [retrying, setRetrying] = useState<string | null>(null);

    useEffect(() => {
        setVideos(initialVideos);
    }, [initialVideos]);

    useEffect(() => {
        const hasActiveJobs = videos.some(
            (video) =>
                video.status === "UPLOADING" ||
                video.status === "QUEUED" ||
                video.status === "PROCESSING",
        );
        if (!hasActiveJobs) return;

        const interval = window.setInterval(() => {
            router.refresh(); // Automatically preserves ?page=N
        }, 4000);

        return () => window.clearInterval(interval);
    }, [router, videos]);

    async function retry(event: React.MouseEvent, videoId: string) {
        event.stopPropagation();
        setRetrying(videoId);
        try {
            const response = await fetch(`/api/videos/${videoId}/retry`, {
                method: "POST",
            });
            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as {
                    error?: string;
                };
                throw new Error(payload.error ?? "Retry failed. Please try again.");
            }
            router.refresh();
        } catch (error) {
            console.error("Unable to retry video.", error);
            window.alert(
                error instanceof Error ? error.message : "Retry failed. Please try again.",
            );
        } finally {
            setRetrying(null);
        }
    }

    return (
        <div className="min-h-full bg-page px-6 py-10 text-ink sm:px-10">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-[62ch]">
                        <h1 className="font-display text-[32px] font-medium leading-tight tracking-[-0.025em] text-ink">
                            My projects
                        </h1>
                        <p className="mt-2 text-base text-muted">
                            Every video you upload and the clips made from it. Open one to review, edit and schedule its clips.
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex h-11 items-center gap-2 rounded-lg bg-action px-5 text-base font-medium text-action-ink transition hover:bg-action-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                    >
                        Upload a video
                    </Link>
                </header>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {/* Tile 1: Upload New Video */}
                    <div className="flex flex-col">
                        <Link
                            href="/"
                            aria-label="Upload new video"
                            className="group relative flex aspect-video w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line bg-surface text-muted transition duration-200 hover:border-action hover:bg-action/12 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-transform duration-200 group-hover:scale-105 group-hover:text-link">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </span>
                            <span className="text-sm font-medium tracking-tight">
                                Upload new video
                            </span>
                        </Link>
                    </div>

                    {/* Project Cards */}
                    {videos.map((video) => {
                        const isCompleted = video.status === "COMPLETED";
                        const isProcessing =
                            video.status === "UPLOADING" ||
                            video.status === "QUEUED" ||
                            video.status === "PROCESSING";
                        const isFailed = video.status === "FAILED";
                        const clipCount = video._count.segments;
                        const formattedDate = formatProjectDate(video.createdAt);
                        const displayTitle = cleanVideoTitle(video.title);

                        return (
                            <article key={video.id} className="group flex flex-col">
                                {/* 16:9 Thumbnail Stage */}
                                <div
                                    role={isCompleted ? "button" : undefined}
                                    tabIndex={isCompleted ? 0 : undefined}
                                    aria-label={
                                        isCompleted
                                            ? `Open ${displayTitle} in studio`
                                            : `${displayTitle} (${video.status.toLowerCase()})`
                                    }
                                    onClick={() => {
                                        if (isCompleted) {
                                            router.push(`/videos/${video.id}`);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (isCompleted && (e.key === "Enter" || e.key === " ")) {
                                            e.preventDefault();
                                            router.push(`/videos/${video.id}`);
                                        }
                                    }}
                                    className={`relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-page transition duration-200 ${isCompleted
                                        ? "cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                        : "cursor-default"
                                        }`}
                                >
                                    {video.thumbnailUrl ? (
                                        <>
                                            <img
                                                src={video.thumbnailUrl}
                                                alt=""
                                                aria-hidden="true"
                                                loading="lazy"
                                                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-xl"
                                            />
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={displayTitle}
                                                loading="lazy"
                                                className="relative z-10 mx-auto h-full w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                                            />
                                        </>
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-raised/80 to-page">
                                            <div className="flex h-36 w-20 flex-col items-center justify-center rounded-lg border border-line bg-raised/90 shadow-inner">
                                                {isProcessing ? (
                                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-action border-t-transparent" aria-hidden="true" />
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-6 w-6 text-muted">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isProcessing && (
                                        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-page/90 px-3 py-1.5 text-xs font-medium text-link">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-action" aria-hidden="true" />
                                            <span>
                                                {video.status === "UPLOADING"
                                                    ? "Uploading video..."
                                                    : video.status === "QUEUED"
                                                        ? "Queued for processing..."
                                                        : "Extracting clips..."}
                                            </span>
                                        </div>
                                    )}

                                    {isFailed && (
                                        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-page/95 px-3 py-1.5 text-xs">
                                            <span className="truncate font-medium text-danger" title={video.errorMessage ?? "Processing failed"}>
                                                Processing failed
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => void retry(e, video.id)}
                                                disabled={retrying === video.id}
                                                className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-page transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                                            >
                                                {retrying === video.id ? "Retrying..." : "Retry"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Minimal Metadata Underneath */}
                                <div className="mt-3 flex items-start justify-between gap-2 px-0.5">
                                    <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-ink">
                                        {isCompleted ? (
                                            <Link href={`/videos/${video.id}`} className="hover:text-link focus-visible:outline-none focus-visible:underline" title={displayTitle}>
                                                {displayTitle}
                                            </Link>
                                        ) : (
                                            <span title={displayTitle}>{displayTitle}</span>
                                        )}
                                    </h2>

                                    {isCompleted && (
                                        <Link href={`/videos/${video.id}`} aria-label={`Open ${displayTitle} options`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                                                <circle cx="5" cy="12" r="1.75" />
                                                <circle cx="12" cy="12" r="1.75" />
                                                <circle cx="19" cy="12" r="1.75" />
                                            </svg>
                                        </Link>
                                    )}
                                </div>

                                <div className="mt-1 flex items-center gap-2 px-0.5 text-xs text-muted tabular-nums">
                                    <span>{clipCount} {clipCount === 1 ? "clip" : "clips"}</span>
                                    <span aria-hidden="true" className="text-muted">|</span>
                                    <span>{formattedDate}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <nav aria-label="Pagination navigation" className="mt-12 flex items-center justify-between border-t border-line pt-6">
                        {currentPage > 1 ? (
                            <Link
                                href={`/videos?page=${currentPage - 1}`}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                                <ChevronLeft className="h-4 w-4 text-muted" />
                                Previous
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-xs font-semibold text-muted cursor-not-allowed">
                                <ChevronLeft className="h-4 w-4 text-muted" />
                                Previous
                            </span>
                        )}

                        <div className="text-[13px] font-medium text-muted">
                            Page <span className="text-ink">{currentPage}</span> of <span className="text-ink">{totalPages}</span>
                        </div>

                        {currentPage < totalPages ? (
                            <Link
                                href={`/videos?page=${currentPage + 1}`}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 text-muted" />
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-xs font-semibold text-muted cursor-not-allowed">
                                Next
                                <ChevronRight className="h-4 w-4 text-muted" />
                            </span>
                        )}
                    </nav>
                )}
            </div>
        </div>
    );
}