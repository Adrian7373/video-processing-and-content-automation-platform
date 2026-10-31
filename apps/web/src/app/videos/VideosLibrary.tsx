"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type VideoCard = {
    id: string;
    title: string;
    status: "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";
    userPrompt: string | null;
    aspectRatio: string;
    captionStyle: string;
    errorMessage: string | null;
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
                video.status === "UPLOADING" || video.status === "PROCESSING",
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
            if (!response.ok) throw new Error("Retry failed.");
            router.refresh();
        } catch (error) {
            console.error("Unable to retry video.", error);
        } finally {
            setRetrying(null);
        }
    }

    return (
        <div className="min-h-full bg-[#0A0D14] px-6 py-10 text-slate-100 sm:px-10">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <header className="mb-7">
                    <h1 className="text-lg font-semibold tracking-tight text-slate-200">
                        Projects
                    </h1>
                </header>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {/* Tile 1: Upload New Video */}
                    <div className="flex flex-col">
                        <Link
                            href="/"
                            aria-label="Upload new video"
                            className="group relative flex aspect-video w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 text-slate-400 transition duration-200 hover:border-sky-400/50 hover:bg-slate-900 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-transform duration-200 group-hover:scale-105 group-hover:text-sky-400">
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
                                    className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950 transition duration-200 ${isCompleted
                                        ? "cursor-pointer hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-900/80 to-slate-950">
                                            <div className="flex h-36 w-20 flex-col items-center justify-center rounded-lg border border-slate-800/90 bg-slate-900/90 shadow-inner">
                                                {isProcessing ? (
                                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" aria-hidden="true" />
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-6 w-6 text-slate-500">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isProcessing && (
                                        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-amber-300 backdrop-blur-sm">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
                                            <span>
                                                {video.status === "UPLOADING" ? "Uploading video..." : "Extracting clips..."}
                                            </span>
                                        </div>
                                    )}

                                    {isFailed && (
                                        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-slate-950/95 px-3 py-1.5 text-xs backdrop-blur-sm">
                                            <span className="truncate font-medium text-rose-400" title={video.errorMessage ?? "Processing failed"}>
                                                Processing failed
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => void retry(e, video.id)}
                                                disabled={retrying === video.id}
                                                className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
                                            >
                                                {retrying === video.id ? "Retrying..." : "Retry"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Minimal Metadata Underneath */}
                                <div className="mt-3 flex items-start justify-between gap-2 px-0.5">
                                    <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-slate-100">
                                        {isCompleted ? (
                                            <Link href={`/videos/${video.id}`} className="hover:text-sky-400 focus-visible:outline-none focus-visible:underline" title={displayTitle}>
                                                {displayTitle}
                                            </Link>
                                        ) : (
                                            <span title={displayTitle}>{displayTitle}</span>
                                        )}
                                    </h2>

                                    {isCompleted && (
                                        <Link href={`/videos/${video.id}`} aria-label={`Open ${displayTitle} options`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-900 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                                                <circle cx="5" cy="12" r="1.75" />
                                                <circle cx="12" cy="12" r="1.75" />
                                                <circle cx="19" cy="12" r="1.75" />
                                            </svg>
                                        </Link>
                                    )}
                                </div>

                                <div className="mt-1 flex items-center gap-2 px-0.5 text-xs text-slate-400 tabular-nums">
                                    <span>{clipCount} {clipCount === 1 ? "clip" : "clips"}</span>
                                    <span aria-hidden="true" className="text-slate-700">|</span>
                                    <span>{formattedDate}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <nav aria-label="Pagination navigation" className="mt-12 flex items-center justify-between border-t border-slate-800/80 pt-6">
                        {currentPage > 1 ? (
                            <Link
                                href={`/videos?page=${currentPage - 1}`}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            >
                                <ChevronLeft className="h-4 w-4 text-slate-400" />
                                Previous
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-800/50 bg-transparent px-4 py-2 text-xs font-semibold text-slate-600 cursor-not-allowed">
                                <ChevronLeft className="h-4 w-4 text-slate-700" />
                                Previous
                            </span>
                        )}

                        <div className="text-[13px] font-medium text-slate-500">
                            Page <span className="text-slate-200">{currentPage}</span> of <span className="text-slate-200">{totalPages}</span>
                        </div>

                        {currentPage < totalPages ? (
                            <Link
                                href={`/videos?page=${currentPage + 1}`}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-800/50 bg-transparent px-4 py-2 text-xs font-semibold text-slate-600 cursor-not-allowed">
                                Next
                                <ChevronRight className="h-4 w-4 text-slate-700" />
                            </span>
                        )}
                    </nav>
                )}
            </div>
        </div>
    );
}