"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

const linkClass = "font-medium text-link underline underline-offset-2";

/**
 * Asks signed-in users who have not accepted the current Terms and Privacy Policy to do so.
 * Covers accounts created through Google from the Sign in tab, accounts that pre-date the
 * policies, and re-consent after a material change (LEGAL_VERSION bump).
 */
export default function ConsentGate() {
    const pathname = usePathname();
    const [needsConsent, setNeedsConsent] = useState(false);
    const [terms, setTerms] = useState(false);
    const [privacy, setPrivacy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onLegalPage = LEGAL_LINKS.some((link) => link.href === pathname);

    useEffect(() => {
        let active = true;
        fetch("/api/account/consent", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { needsConsent?: boolean } | null) => {
                if (active) setNeedsConsent(Boolean(data?.needsConsent));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    if (!needsConsent || onLegalPage) return null;

    const accept = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/account/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ acceptedTerms: terms, acceptedPrivacy: privacy }),
            });
            if (!res.ok) throw new Error();
            setNeedsConsent(false);
        } catch {
            setError("We could not save your choice. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-overlay p-4">
            <div className="w-full max-w-md rounded-xl border border-line bg-raised p-6 text-ink shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                <h2 id="consent-title" className="font-display text-[22px] font-medium tracking-[-0.02em]">
                    Review our terms to continue
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                    Please confirm the following to keep using {LEGAL.productName}.
                </p>

                <fieldset className="mt-4 space-y-3 rounded-lg border border-line bg-surface p-3.5">
                    <legend className="sr-only">Agreements</legend>
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--sm-action)]" />
                        <span>
                            I am at least {LEGAL.minimumAge} years old and I agree to the{" "}
                            <a href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>Terms of Service</a>,{" "}
                            <a href="/acceptable-use" target="_blank" rel="noopener noreferrer" className={linkClass}>Acceptable Use Policy</a>, and{" "}
                            <a href="/refunds" target="_blank" rel="noopener noreferrer" className={linkClass}>Credits and Refund Policy</a>.
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                        <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--sm-action)]" />
                        <span>
                            I have read the{" "}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>Privacy Policy</a>{" "}
                            and consent to the collection and processing of my personal data as described there, in line with the Data Privacy Act of 2012.
                        </span>
                    </label>
                </fieldset>

                {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}

                <button
                    type="button"
                    disabled={!terms || !privacy || saving}
                    onClick={() => void accept()}
                    className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-base font-medium text-action-ink transition hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:translate-y-px disabled:opacity-50"
                >
                    {saving ? "Saving" : "Agree and continue"}
                </button>
                <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="mt-3 w-full rounded text-center text-sm text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                    I do not agree, sign me out
                </button>
            </div>
        </div>
    );
}
