"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import PlatformIcon, { type SocialPlatformType } from "./PlatformIcon";
import { PLATFORM_COLOR, STATUS_BADGE, badgeBase, ui } from "@/lib/ui";

export type PostDetails = {
    id: string;
    segmentTitle: string;
    platform: SocialPlatformType;
    accountName: string;
    caption: string;
    scheduledFor: string;
    status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";
    publishedUrl?: string | null;
    errorMessage?: string | null;
    failureCode?: string | null;
};

interface PostDetailsModalProps {
    post: PostDetails;
    busy?: boolean;
    error?: string | null;
    onClose: () => void;
    onRemove: (post: PostDetails) => void;
    onRetry: (post: PostDetails) => void;
}

/** Details of one scheduled post, with the failure reason and a retry action. Shared by the calendar and the studio. */
export default function PostDetailsModal({ post, busy = false, error, onClose, onRemove, onRetry }: PostDetailsModalProps) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const failed = post.status === "FAILED";
    const needsReconnect = failed && post.failureCode === "REAUTH_REQUIRED";

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="post-title" className={ui.modalBackdrop}>
            <div className={`${ui.modal} max-w-md p-6`}>
                <div className="flex items-start justify-between gap-4">
                    <span className={`${badgeBase} ${STATUS_BADGE[post.status].className}`}>{STATUS_BADGE[post.status].label}</span>
                    <button type="button" onClick={onClose} aria-label="Close" className={`${ui.btnIcon} -mr-2 -mt-1`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <h2 id="post-title" className={`${ui.h2} mt-3`}>{post.segmentTitle}</h2>

                {failed && (
                    <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
                        <p className="font-medium text-danger">Why it failed</p>
                        <p className="mt-1 text-ink">
                            {needsReconnect
                                ? `Your ${post.accountName} connection expired or was revoked. Reconnect it and this post will be retried automatically.`
                                : post.errorMessage || "The post could not be published."}
                        </p>
                    </div>
                )}

                <dl className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                        <dt className="text-muted">Account</dt>
                        <dd className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                            <PlatformIcon platform={post.platform} className={`h-4 w-4 shrink-0 ${PLATFORM_COLOR[post.platform]}`} />
                            <span className="truncate">{post.accountName}</span>
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                        <dt className="text-muted">{post.status === "PUBLISHED" ? "Published" : "Posts on"}</dt>
                        <dd className="font-medium tabular-nums">{format(parseISO(post.scheduledFor), "EEE d MMM yyyy, HH:mm")}</dd>
                    </div>
                </dl>

                <p className="mt-4 text-[13px] font-medium">Caption</p>
                <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm leading-relaxed">
                    {post.caption || "No caption"}
                </p>

                {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                    {post.status !== "PUBLISHED" ? (
                        <button type="button" disabled={busy} onClick={() => onRemove(post)} className={ui.btnDanger}>
                            Remove from schedule
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {post.status === "PUBLISHED" && post.publishedUrl ? (
                            <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" className={ui.btnPrimarySm}>
                                View the post
                            </a>
                        ) : failed ? (
                            <>
                                {needsReconnect && (
                                    <Link href="/channels" className={ui.btnSecondarySm}>
                                        Reconnect account
                                    </Link>
                                )}
                                <button type="button" disabled={busy} onClick={() => onRetry(post)} className={needsReconnect ? ui.btnSecondarySm : ui.btnPrimarySm}>
                                    {busy ? "Retrying..." : "Retry now"}
                                </button>
                            </>
                        ) : (
                            <button type="button" onClick={onClose} className={ui.btnSecondarySm}>
                                Done
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
