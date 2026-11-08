"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { LEGAL, LEGAL_VERSION, TERMS_CONSENT_COOKIE } from "@/lib/legal";

type AuthTab = "register" | "login";

interface AuthGateModalProps {
    reasonMessage?: string | null;
    onClose: () => void;
    onSuccess: () => Promise<void> | void;
}

export default function AuthGateModal({
    reasonMessage,
    onClose,
    onSuccess,
}: AuthGateModalProps) {
    const [tab, setTab] = useState<AuthTab>("register");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const consentGiven = agreedTerms && agreedPrivacy;
    const consentMissing = "Please accept the Terms of Service and the Privacy Policy to create an account.";

    const handleGoogleSignIn = async () => {
        setFormError(null);
        if (tab === "register") {
            if (!consentGiven) {
                setFormError(consentMissing);
                return;
            }
            // Short-lived cookie so the server can record consent if this creates a new account.
            document.cookie = `${TERMS_CONSENT_COOKIE}=${LEGAL_VERSION}; path=/; max-age=600; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
        }
        setSubmitting(true);
        await signIn("google", { callbackUrl: window.location.href });
    };

    const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);
        if (tab === "register" && !consentGiven) {
            setFormError(consentMissing);
            return;
        }
        setSubmitting(true);

        try {
            if (tab === "register") {
                const registerRes = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password, acceptedTerms: consentGiven }),
                });

                if (!registerRes.ok) {
                    const data = await registerRes.json().catch(() => ({}));
                    throw new Error(data.error ?? "Unable to create account.");
                }
            }

            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                throw new Error("Invalid email or password.");
            }

            await onSuccess();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Authentication failed.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4"
        >
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-raised p-6 text-ink shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-action/20 px-2.5 py-0.5 text-[13px] font-medium text-ink">
                            10 free credits
                        </span>
                        <h2 className="mt-2 font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
                            {tab === "register" ? "Create your account" : "Welcome back"}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {reasonMessage && (
                    <p className="mt-3 rounded-lg border border-action/40 bg-action/15 p-3 text-sm leading-relaxed text-ink">
                        {reasonMessage}
                    </p>
                )}

                <div className="mt-5 grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
                    <button type="button" onClick={() => { setTab("register"); setFormError(null); }} className={`h-9 rounded-md text-sm font-medium transition ${tab === "register" ? "bg-raised text-ink shadow-[0_0_0_1px_var(--sm-line-strong)]" : "text-muted hover:text-ink"}`}>Create account</button>
                    <button type="button" onClick={() => { setTab("login"); setFormError(null); }} className={`h-9 rounded-md text-sm font-medium transition ${tab === "login" ? "bg-raised text-ink shadow-[0_0_0_1px_var(--sm-line-strong)]" : "text-muted hover:text-ink"}`}>Sign in</button>
                </div>

                {tab === "register" ? (
                    <fieldset className="mt-4 space-y-3 rounded-lg border border-line bg-surface p-3.5">
                        <legend className="sr-only">Agreements</legend>
                        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-ink">
                            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--sm-action)]" />
                            <span>
                                I am at least {LEGAL.minimumAge} years old and I agree to the{" "}
                                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-2">Terms of Service</a>,{" "}
                                <a href="/acceptable-use" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-2">Acceptable Use Policy</a>, and{" "}
                                <a href="/refunds" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-2">Credits and Refund Policy</a>.
                            </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-ink">
                            <input type="checkbox" checked={agreedPrivacy} onChange={(e) => setAgreedPrivacy(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--sm-action)]" />
                            <span>
                                I have read the{" "}
                                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-2">Privacy Policy</a>{" "}
                                and consent to the collection and processing of my personal data as described there, in line with the Data Privacy Act of 2012.
                            </span>
                        </label>
                    </fieldset>
                ) : (
                    <p className="mt-4 text-[13px] leading-snug text-muted">
                        By signing in you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">Terms</a> and{" "}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">Privacy Policy</a>.
                    </p>
                )}

                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleGoogleSignIn()}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z" />
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
                        <path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z" />
                        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z" />
                    </svg>
                    Continue with Google
                </button>

                <div className="my-4 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" />
                    <span>or with email</span>
                    <span className="h-px flex-1 bg-line" />
                </div>


                <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                    {formError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs font-medium text-danger">{formError}</p>}
                    {tab === "register" && (
                        <label className="block">
                            <span className="mb-1.5 block text-[13px] font-medium text-ink">Name</span>
                            <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your creator name" className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35" />
                        </label>
                    )}
                    <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink">Email address</span>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35" />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink">Password</span>
                        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35" />
                    </label>
                    <button type="submit" disabled={submitting} className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-base font-medium text-action-ink active:translate-y-px transition hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">
                        {submitting ? "Signing you in" : tab === "register" ? "Create account and get 10 credits" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}