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
            "Post vertical clips straight to your YouTube channel as Shorts.",
        available: true,
        accentBorder: "hover:border-line-strong",
        badgeBg: "bg-danger/10 text-danger border-danger/30",
        iconColor: "text-[#FF0033]",
    },
    {
        platform: "TIKTOK",
        slug: "tiktok",
        name: "TikTok",
        description:
            "Post clips to your TikTok account, or send them to your drafts to finish in the app.",
        available: true,
        accentBorder: "hover:border-line-strong",
        badgeBg: "bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 border-cyan-400/30",
        iconColor: "text-ink",
    },
    {
        platform: "INSTAGRAM_REELS",
        slug: "instagram",
        name: "Instagram Reels",
        description:
            "Post clips as Reels to Instagram creator and business accounts.",
        available: false,
        accentBorder: "hover:border-line-strong",
        badgeBg: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
        iconColor: "text-[#E1306C]",
    },
    {
        platform: "FACEBOOK_REELS",
        slug: "facebook",
        name: "Facebook Reels",
        description:
            "Post clips as Reels to your Facebook Pages.",
        available: false,
        accentBorder: "hover:border-line-strong",
        badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
        iconColor: "text-[#1877F2]",
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
        <main className="bg-page text-ink">

            <div className="mx-auto max-w-5xl px-6 py-10">
                <header className="mb-8 max-w-[62ch]">
                    <h1 className="font-display text-[32px] font-medium leading-tight tracking-[-0.025em] text-ink">Social accounts</h1>
                    <p className="mt-2 text-base text-muted">Connect the accounts you post to. Scheduled clips publish to them automatically.</p>
                </header>
                {/* OAuth Status Banners */}
                {connectedParam && (
                    <div
                        role="status"
                        className="mb-6 flex items-center justify-between rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-xs text-success"
                    >
                        <span className="font-semibold">
                            Your {connectedParam} account is connected. You can now schedule posts to it.
                        </span>
                    </div>
                )}

                {errorParam && (
                    <div
                        role="alert"
                        className="mb-6 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger"
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
                                className={`flex flex-col justify-between rounded-xl border border-line bg-raised p-6 transition ${item.accentBorder}`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-page ${item.iconColor}`}
                                            >
                                                <PlatformIcon
                                                    platform={item.platform}
                                                    className="h-5 w-5"
                                                />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-ink">
                                                    {item.name}
                                                </h2>
                                                <span
                                                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${connectedForPlatform.length >
                                                        0
                                                        ? "border-success/30 bg-success/10 text-success"
                                                        : item.available
                                                            ? "border-line-strong bg-surface text-ink"
                                                            : "border-line bg-surface text-muted"
                                                        }`}
                                                >
                                                    {connectedForPlatform.length >
                                                        0
                                                        ? `${connectedForPlatform.length} connected`
                                                        : item.available
                                                            ? "Not connected"
                                                            : "Coming soon"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-4 text-sm leading-relaxed text-muted">
                                        {item.description}
                                    </p>

                                    {/* Connected Account List */}
                                    <div className="mt-5 space-y-2">
                                        {loading ? (
                                            <div className="h-12 animate-pulse rounded-xl bg-surface" />
                                        ) : connectedForPlatform.length > 0 ? (
                                            connectedForPlatform.map((acc) => (
                                                <div
                                                    key={acc.id}
                                                    className={`flex items-center justify-between gap-3 rounded-xl border bg-page/90 px-3.5 py-2.5 text-xs ${acc.needsReauth ? "border-danger/40" : "border-line"}`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-ink">
                                                            {acc.accountName}
                                                        </p>
                                                        <p className="truncate tabular-nums text-xs text-muted">
                                                            ID:{" "}
                                                            {
                                                                acc.platformAccountId
                                                            }
                                                        </p>
                                                        {acc.needsReauth && (
                                                            <p role="alert" className="mt-1 text-xs text-danger">
                                                                {acc.reauthReason ?? "Sign-in expired. Reconnect to keep publishing."}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {acc.needsReauth && (
                                                        <a
                                                            href={`/api/integrations/${item.slug}/connect?returnTo=/channels`}
                                                            className="shrink-0 rounded-lg border border-line-strong bg-raised px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface"
                                                        >
                                                            Reconnect
                                                        </a>
                                                    )}

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
                                                        className="shrink-0 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                                                    >
                                                        {disconnectingId ===
                                                            acc.id
                                                            ? "Removing..."
                                                            : "Disconnect"}
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-line bg-surface px-3.5 py-3 text-center text-xs text-muted">
                                                No account connected yet
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-line pt-4">
                                    {item.available ? (
                                        <a
                                            href={`/api/integrations/${item.slug}/connect?returnTo=/channels`}
                                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition hover:border-ink hover:bg-surface active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                                                ? `Connect another ${item.name} account`
                                                : `Connect ${item.name}`}
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled
                                            className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-muted"
                                        >
                                            Available soon
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