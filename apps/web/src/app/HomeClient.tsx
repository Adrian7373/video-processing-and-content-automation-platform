"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VideoUploader from "./components/VideoUploader";
import type { VideoCard } from "./videos/VideosLibrary";

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

export default function HomeClient({
    recentVideos,
}: {
    recentVideos: VideoCard[];
}) {
    const router = useRouter();
    const [videos, setVideos] = useState<VideoCard[]>(recentVideos);
    const [retrying, setRetrying] = useState<string | null>(null);

    useEffect(() => {
        setVideos(recentVideos);
    }, [recentVideos]);

    // Poll for status updates if any video is active
    useEffect(() => {
        const hasActiveJobs = videos.some(
            (video) =>
                video.status === "UPLOADING" || video.status === "PROCESSING",
        );
        if (!hasActiveJobs) return;

        const interval = window.setInterval(() => {
            router.refresh();
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

    // STATE 1: NO PROJECTS
    // Mirrors the perfect centered look from your "before" screenshot
    if (videos.length === 0) {
        return (
            <div className="flex min-h-full w-full items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-[520px]">
                    <VideoUploader />
                </div>
            </div>
        );
    }

    // STATE 2: HAS PROJECTS
    // Strict 2-column layout preventing the Uploader from overlapping the grid
    return (
        <div className="min-h-full w-full bg-slate-950 p-6 lg:p-8 xl:p-10">
            {/* max-w-[1400px] ensures it doesn't stretch awkwardly on ultra-wide screens */}
            <div className="mx-auto max-w-[1400px]">

                {/* The Flex row creates strict Left/Right columns on desktop */}
                <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-10 xl:gap-14">

                    {/* LEFT COLUMN: Main Video Uploader (Fixed Width & Sticky) */}
                    <div className="w-full shrink-0 lg:sticky lg:top-8 lg:w-[420px] xl:w-[460px]">
                        <VideoUploader />
                    </div>

                    {/* RIGHT COLUMN: Recent Projects Grid */}
                    <div className="flex-1 min-w-0">
                        {/* Header constrained strictly inside the right column */}
                        <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <h2 className="text-base font-semibold text-slate-200">
                                Recent Projects
                            </h2>
                            <Link
                                href="/videos"
                                className="text-sm font-medium text-sky-400 transition hover:text-sky-300 focus-visible:outline-none focus-visible:underline"
                            >
                                View all &rarr;
                            </Link>
                        </div>

                        {/* Project Cards Grid */}
                        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
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
                                        {/* 16:9 Thumbnail Stage (Enforces Aspect Ratio) */}
                                        <div
                                            role={isCompleted ? "button" : undefined}
                                            tabIndex={isCompleted ? 0 : undefined}
                                            aria-label={
                                                isCompleted
                                                    ? `Open ${displayTitle} in studio`
                                                    : `${displayTitle} (${video.status.toLowerCase()})`
                                            }
                                            onClick={() => {
                                                if (isCompleted) router.push(`/videos/${video.id}`);
                                            }}
                                            onKeyDown={(e) => {
                                                if (isCompleted && (e.key === "Enter" || e.key === " ")) {
                                                    e.preventDefault();
                                                    router.push(`/videos/${video.id}`);
                                                }
                                            }}
                                            className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0E111A] transition duration-200 ${isCompleted
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

                                            {/* Status Overlays */}
                                            {isProcessing && (
                                                <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-amber-300 backdrop-blur-sm">
                                                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
                                                    <span>{video.status === "UPLOADING" ? "Uploading video..." : "Extracting clips..."}</span>
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

                                        {/* Metadata */}
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
                                        </div>

                                        <div className="mt-1 flex items-center gap-2 px-0.5 text-[11px] text-slate-400 tabular-nums">
                                            <span>{clipCount} {clipCount === 1 ? "clip" : "clips"}</span>
                                            <span aria-hidden="true" className="text-slate-700">|</span>
                                            <span>{formattedDate}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}