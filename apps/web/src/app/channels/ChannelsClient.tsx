"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ConnectedSocialAccountDTO } from "@/app/api/integrations/accounts/route";

type SocialPlatformType =
    | "YOUTUBE_SHORTS"
    | "TIKTOK"
    | "INSTAGRAM_REELS"
    | "FACEBOOK_REELS";

interface PlatformConfig {
    platform: SocialPlatformType;
    slug: string;
    name: string;
    description: string;
    available: boolean;
    accentBorder: string;
    badgeBg: string;
    iconColor: string;
}

const PLATFORMS: readonly PlatformConfig[] = [
    {
        platform: "YOUTUBE_SHORTS",
        slug: "youtube",
        name: "YouTube Shorts",
        description:
            "Publish vertical 9:16 clips directly to your YouTube channel via YouTube Data API v3.",
        available: true,
        accentBorder: "hover:border-white/50",
        badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        iconColor: "text-rose-400",
    },
    {
        platform: "TIKTOK",
        slug: "tiktok",
        name: "TikTok",
        description:
            "Direct video publishing to TikTok creator accounts via TikTok Content Posting API.",
        available: true,
        accentBorder: "hover:border-white/50",
        badgeBg: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
        iconColor: "text-cyan-300",
    },
    {
        platform: "INSTAGRAM_REELS",
        slug: "instagram",
        name: "Instagram Reels",
        description:
            "Automated Reels publishing for Instagram Creator & Business accounts via Meta Graph API.",
        available: false,
        accentBorder: "hover:border-white/50",
        badgeBg: "bg-pink-500/10 text-pink-300 border-pink-500/30",
        iconColor: "text-pink-400",
    },
    {
        platform: "FACEBOOK_REELS",
        slug: "facebook",
        name: "Facebook Reels",
        description:
            "Distribute short-form video clips to Facebook Pages via Meta Graph API.",
        available: false,
        accentBorder: "hover:border-white/50",
        badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
        iconColor: "text-blue-400",
    },
];

function PlatformIcon({
    platform,
    className = "h-5 w-5",
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

export default function ChannelsClient() {
    const searchParams = useSearchParams();
    const connectedParam = searchParams.get("connected");
    const errorParam = searchParams.get("error");

    const [accounts, setAccounts] = useState<ConnectedSocialAccountDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            const res = await fetch("/api/integrations/accounts", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
                accounts: ConnectedSocialAccountDTO[];
            };
            setAccounts(data.accounts);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccounts();
    }, [loadAccounts]);

    const handleDisconnect = async (accountId: string) => {
        setDisconnectingId(accountId);
        try {
            const res = await fetch(
                `/api/integrations/accounts?accountId=${encodeURIComponent(accountId)}`,
                { method: "DELETE" },
            );
            if (res.ok) {
                setAccounts((prev) => prev.filter((a) => a.id !== accountId));
            }
        } finally {
            setDisconnectingId(null);
        }
    };

    return (
        <main className="bg-[#0A0D14] text-slate-100">

            <div className="mx-auto max-w-5xl px-6 py-8">
                {/* OAuth Status Banners */}
                {connectedParam && (
                    <div
                        role="status"
                        className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200"
                    >
                        <span className="font-semibold">
                            Successfully connected your{" "}
                            <span className="uppercase">{connectedParam}</span>{" "}
                            channel! You can now schedule live video posts.
                        </span>
                    </div>
                )}

                {errorParam && (
                    <div
                        role="alert"
                        className="mb-6 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
                    >
                        <span className="font-medium">{errorParam}</span>
                    </div>
                )}

                {/* Platform Cards Grid */}
                <div className="grid gap-5 md:grid-cols-2">
                    {PLATFORMS.map((item) => {
                        const connectedForPlatform = accounts.filter(
                            (acc) => acc.platform === item.platform,
                        );

                        return (
                            <section
                                key={item.platform}
                                className={`flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0E111A] p-6 shadow-lg transition ${item.accentBorder}`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 ${item.iconColor}`}
                                            >
                                                <PlatformIcon
                                                    platform={item.platform}
                                                    className="h-5 w-5"
                                                />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-bold text-white">
                                                    {item.name}
                                                </h2>
                                                <span
                                                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${connectedForPlatform.length >
                                                        0
                                                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                                        : item.available
                                                            ? "border-slate-700 bg-slate-800 text-slate-300"
                                                            : "border-slate-800 bg-slate-950 text-slate-500"
                                                        }`}
                                                >
                                                    {connectedForPlatform.length >
                                                        0
                                                        ? `${connectedForPlatform.length} Connected`
                                                        : item.available
                                                            ? "Ready to Connect"
                                                            : "Phase 2 Roadmap"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                        {item.description}
                                    </p>

                                    {/* Connected Account List */}
                                    <div className="mt-5 space-y-2">
                                        {loading ? (
                                            <div className="h-12 animate-pulse rounded-xl bg-slate-800/60" />
                                        ) : connectedForPlatform.length > 0 ? (
                                            connectedForPlatform.map((acc) => (
                                                <div
                                                    key={acc.id}
                                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/90 px-3.5 py-2.5 text-xs"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-slate-100">
                                                            {acc.accountName}
                                                        </p>
                                                        <p className="truncate font-mono text-[10px] text-slate-500">
                                                            ID:{" "}
                                                            {
                                                                acc.platformAccountId
                                                            }
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            disconnectingId ===
                                                            acc.id
                                                        }
                                                        onClick={() =>
                                                            void handleDisconnect(
                                                                acc.id,
                                                            )
                                                        }
                                                        className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                                                    >
                                                        {disconnectingId ===
                                                            acc.id
                                                            ? "Removing..."
                                                            : "Disconnect"}
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 px-3.5 py-3 text-center text-xs text-slate-500">
                                                No {item.name} account linked
                                                yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-slate-800/80 pt-4">
                                    {item.available ? (
                                        <a
                                            href={`/api/integrations/${item.slug}/connect?returnTo=/channels`}
                                            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.2"
                                                aria-hidden="true"
                                                className="h-3.5 w-3.5"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="5"
                                                    x2="12"
                                                    y2="19"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="12"
                                                    x2="19"
                                                    y2="12"
                                                />
                                            </svg>
                                            {connectedForPlatform.length > 0
                                                ? `Connect Another ${item.name} Channel`
                                                : `Connect ${item.name}`}
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled
                                            className="flex min-h-[42px] w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-500"
                                        >
                                            OAuth Adapter Coming Next
                                        </button>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}