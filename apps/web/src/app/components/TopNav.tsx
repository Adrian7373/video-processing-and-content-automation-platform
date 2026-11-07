"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "./BrandMark";
import type { CreditsStatusResponse } from "@/app/api/credits/route";

export default function TopNav() {
    const [actor, setActor] = useState<CreditsStatusResponse | null>(null);
    const [creditsLoading, setCreditsLoading] = useState(true);

    const loadCredits = useCallback(async () => {
        try {
            const response = await fetch("/api/credits", { cache: "no-store" });
            if (!response.ok) return;
            const data = (await response.json()) as CreditsStatusResponse;
            setActor(data);
        } catch {
            // Ignore transient errors
        } finally {
            setCreditsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCredits();
    }, [loadCredits]);

    // Listen for custom events triggered by the Uploader to refresh credits instantly
    useEffect(() => {
        const handleCreditsUpdated = () => void loadCredits();
        window.addEventListener("vr:credits-updated", handleCreditsUpdated);
        return () =>
            window.removeEventListener("vr:credits-updated", handleCreditsUpdated);
    }, [loadCredits]);

    const creditsRemaining = actor?.credits ?? 0;
    const isGuest = actor?.isAnonymous ?? true;

    const label = creditsLoading
        ? "Checking credits"
        : `${creditsRemaining} ${isGuest ? "trial " : ""}${creditsRemaining === 1 ? "credit" : "credits"} left`;

    return (
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-3 border-b border-line bg-page px-4 md:justify-end md:px-6">
            <div className="flex items-center gap-3 md:hidden">
                <button
                    type="button"
                    aria-label="Open menu"
                    aria-controls="app-sidebar"
                    onClick={() => window.dispatchEvent(new Event("sm:toggle-nav"))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong bg-raised text-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
                        <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                </button>
                <Link href="/" className="flex items-center gap-2 font-display text-[17px] font-medium tracking-[-0.02em] text-ink">
                    <BrandMark />
                    <span className="sr-only sm:not-sr-only">Scroll Maestro</span>
                </Link>
            </div>
            <span
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium tabular-nums ${creditsLoading
                    ? "border-line text-muted"
                    : creditsRemaining > 0
                        ? "border-line text-ink"
                        : "border-danger/40 bg-danger/10 text-danger"
                    }`}
            >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`h-3.5 w-3.5 ${creditsRemaining > 0 ? "text-action" : ""}`}>
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {label}
            </span>
        </header>
    );
}
