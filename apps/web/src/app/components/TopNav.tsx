"use client";

import React, { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
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

    return (
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-end border-b border-slate-800/80 bg-[#0A0D14] px-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${creditsLoading
                            ? "border-slate-800 bg-slate-900 text-slate-400"
                            : creditsRemaining > 0
                                ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                            }`}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                        >
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        {creditsLoading
                            ? "Loading..."
                            : `${creditsRemaining} ${isGuest ? "Trial" : ""
                            } ${creditsRemaining === 1 ? "Credit" : "Credits"}`}
                    </span>
                </div>
            </div>
        </header>
    );
}