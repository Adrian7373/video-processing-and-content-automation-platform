"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";

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
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleGoogleSignIn = async () => {
        setSubmitting(true);
        setFormError(null);
        await signIn("google", { callbackUrl: window.location.href });
    };

    const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);

        try {
            if (tab === "register") {
                const registerRes = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-[#11151F] p-6 text-slate-100 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                            +10 Bonus Credits
                        </span>
                        <h2 className="mt-2 text-lg font-bold text-white">
                            {tab === "register" ? "Create your creator account" : "Welcome back"}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {reasonMessage && (
                    <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
                        {reasonMessage}
                    </p>
                )}

                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleGoogleSignIn()}
                    className="mt-5 flex min-h-[42px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z" />
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
                        <path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z" />
                        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z" />
                    </svg>
                    Continue with Google
                </button>

                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
                    <span className="h-px flex-1 bg-slate-800" />
                    <span>or with email</span>
                    <span className="h-px flex-1 bg-slate-800" />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
                    <button type="button" onClick={() => { setTab("register"); setFormError(null); }} className={`rounded-lg py-1.5 text-xs font-semibold transition ${tab === "register" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>Create Account</button>
                    <button type="button" onClick={() => { setTab("login"); setFormError(null); }} className={`rounded-lg py-1.5 text-xs font-semibold transition ${tab === "login" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>Sign In</button>
                </div>

                <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                    {formError && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-300">{formError}</p>}
                    {tab === "register" && (
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-300">Name</span>
                            <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your creator name" className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                        </label>
                    )}
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-300">Email address</span>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-300">Password</span>
                        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                    </label>
                    <button type="submit" disabled={submitting} className="mt-2 flex min-h-[42px] w-full items-center justify-center rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50">
                        {submitting ? "Please wait..." : tab === "register" ? "Create Account & Claim 10 Credits" : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}