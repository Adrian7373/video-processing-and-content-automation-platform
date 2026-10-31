"use client";

import React, {
    type ChangeEvent,
    type FormEvent,
    useCallback,
    useEffect,
    useState,
} from "react";
import { signIn, signOut } from "next-auth/react";
import { getPresignedUploadUrl } from "../../../actions/upload";
import type {
    AspectRatio,
    CaptionStyle,
} from "@/../../packages/database/index";
import type { CreditsStatusResponse } from "@/app/api/credits/route";

type UploadStatus = "idle" | "requesting" | "uploading" | "processing" | "error";
type ProcessingMode = "CLIP" | "CAPTION_ONLY";
type AuthTab = "register" | "login";

interface InitVideoSuccessResponse {
    videoId: string;
    s3Key: string;
    userId: string;
    creditsRemaining: number;
    isAnonymous: boolean;
}

interface ProcessVideoSuccessResponse {
    jobId: string | undefined;
    queued: boolean;
    creditsRemaining: number;
    isAnonymous: boolean;
}

interface ApiErrorPayload {
    error?: string;
    code?: "TRIAL_CREDITS_EXHAUSTED" | "INSUFFICIENT_CREDITS" | string;
    requiresAuth?: boolean;
    creditsRemaining?: number;
}

const statusLabels: Record<UploadStatus, string> = {
    idle: "Ready to upload",
    requesting: "Verifying credits & preparing secure upload...",
    uploading: "Uploading video to storage...",
    processing: "Video queued! 1 credit deducted.",
    error: "Upload failed. Please try again.",
};

const funPhrases: readonly string[] = [
    "Cooking...",
    "Let's hope it's worth the wait",
    "Feel free to spin in your chair",
    "Pretending to care...",
    "Waiting for motivation...",
    "Please wait while the minions do their work",
    "Please wait while the little elves draw your map",
    "Don't worry - a few bits tried to escape, but we caught them",
    "The server is powered by a lemon and two electrodes.",
    "We're testing your patience",
    "The bits are flowing slowly today",
    "Are we there yet?",
    "Just count to 10",
    "Counting backwards from Infinity",
    "We're making you a cookie.",
    "Spinning the wheel of fortune...",
    "Computing chance of success",
    "I feel like im supposed to be loading something. . .",
    "What do you call 8 Hobbits? A Hobbyte.",
    "Should have used a compiled language...",
    "Adjusting flux capacitor...",
    "Please wait until the sloth starts moving.",
    "Don't break your screen yet!",
    "I swear it's almost done.",
    "Let's take a mindfulness minute...",
    "Unicorns are at the end of this road, I promise.",
    "Connecting Neurotoxin Storage Tank...",
    "Time flies when you’re having fun.",
    "Get some coffee and come back in ten minutes..",
    "Spinning the hamster…",
    "Convincing AI not to turn evil..",
    "If I’m not back in five minutes, just wait longer.",
    "Laughing at your pictures-i mean, loading...",
    "Looking for sense of humour, please hold on.",
    "Please wait while the intern refills his coffee.",
    "Please hold on as we reheat our coffee",
    "Kindly hold on as we convert this bug to a feature...",
    "Distracted by cat gifs",
    "Loading funny message...",
    "Mining some bitcoins...",
    "Downloading more RAM..",
    "Updating to Windows Vista...",
    "Deleting System32 folder",
    "Never let a computer know you're in a hurry.",
    "Discovering new ways of making you wait...",
    "Your time is very important to us. Please wait while we ignore you...",
    "Sorry we are busy catching em' all, we're done soon",
    "Still faster than Windows update",
];

function pickRandomPhrase(): string {
    return (
        funPhrases[Math.floor(Math.random() * funPhrases.length)] ??
        "Uploading video..."
    );
}

export default function VideoUploader() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastQueuedVideoId, setLastQueuedVideoId] = useState<string | null>(
        null,
    );

    const [mode, setMode] = useState<ProcessingMode>("CLIP");
    const [userPrompt, setUserPrompt] = useState("");
    const [aspectRatio, setAspectRatio] =
        useState<AspectRatio>("VERTICAL_9_16");
    const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("KARAOKE");
    const [loadingMessage, setLoadingMessage] = useState<string>(
        funPhrases[0] ?? "Cooking...",
    );

    // Credit & Auth State
    const [actor, setActor] = useState<CreditsStatusResponse | null>(null);
    const [creditsLoading, setCreditsLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalReason, setAuthModalReason] = useState<string | null>(null);

    const isBusy = status === "requesting" || status === "uploading";

    const loadCredits = useCallback(async () => {
        try {
            const response = await fetch("/api/credits", { cache: "no-store" });
            if (!response.ok) return;
            const data = (await response.json()) as CreditsStatusResponse;
            setActor(data);
        } catch {
            // Keep existing actor state on transient network failure
        } finally {
            setCreditsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCredits();
    }, [loadCredits]);

    useEffect(() => {
        if (status !== "uploading") return;
        const interval = window.setInterval(() => {
            setLoadingMessage(pickRandomPhrase());
        }, 3500);
        return () => window.clearInterval(interval);
    }, [status]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] ?? null);
        setStatus("idle");
        setErrorMessage(null);
        setLastQueuedVideoId(null);
        setProgress(0);
    };

    const handleOutOfCredits = (payload?: ApiErrorPayload) => {
        setActor((prev) =>
            prev
                ? {
                    ...prev,
                    credits: payload?.creditsRemaining ?? 0,
                }
                : prev,
        );

        const isGuest = payload?.requiresAuth ?? actor?.isAnonymous ?? true;
        if (isGuest) {
            setAuthModalReason(
                payload?.error ??
                "You've used all 3 free trial credits. Create an account or sign in to unlock 10 bonus credits and keep all your clips.",
            );
            setIsAuthModalOpen(true);
            setStatus("idle");
        } else {
            setErrorMessage(
                payload?.error ??
                "You have 0 credits remaining on your account.",
            );
            setStatus("error");
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        setErrorMessage(null);

        if (!file) {
            setErrorMessage("Please select a video file first.");
            setStatus("error");
            return;
        }

        // Pre-flight check if credits are already known to be 0
        if (actor && actor.credits < 1) {
            handleOutOfCredits({
                requiresAuth: actor.isAnonymous,
                creditsRemaining: 0,
            });
            return;
        }

        try {
            setStatus("requesting");
            setProgress(0);

            const initializationResponse = await fetch("/api/videos/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                    fileSize: file.size,
                    userId: actor?.userId,
                    userPrompt: mode === "CLIP" ? userPrompt : "",
                    processingMode: mode,
                    aspectRatio,
                    captionStyle,
                }),
            });

            if (initializationResponse.status === 402) {
                const errPayload =
                    (await initializationResponse
                        .json()
                        .catch(() => ({}))) as ApiErrorPayload;
                handleOutOfCredits(errPayload);
                return;
            }

            if (!initializationResponse.ok) {
                const errPayload =
                    (await initializationResponse
                        .json()
                        .catch(() => ({}))) as ApiErrorPayload;
                throw new Error(
                    errPayload.error ??
                    "The video upload could not be initialized.",
                );
            }

            const { videoId, s3Key, userId } =
                (await initializationResponse.json()) as InitVideoSuccessResponse;

            const { uploadUrl } = await getPresignedUploadUrl(
                {
                    filename: file.name,
                    contentType: file.type,
                    fileSize: file.size,
                },
                s3Key,
            );

            setLoadingMessage(pickRandomPhrase());
            setStatus("uploading");

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (progressEvent) => {
                    if (progressEvent.lengthComputable) {
                        const percentComplete = Math.round(
                            (progressEvent.loaded / progressEvent.total) * 95,
                        );
                        setProgress(percentComplete);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                "The video could not be uploaded to storage.",
                            ),
                        );
                    }
                };

                xhr.onerror = () =>
                    reject(new Error("Network error during upload."));

                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.send(file);
            });

            setProgress(98);

            const processResponse = await fetch("/api/videos/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    s3Key,
                    videoId,
                    userId,
                    userPrompt: mode === "CLIP" ? userPrompt : "",
                    processingMode: mode,
                    aspectRatio,
                    captionStyle,
                }),
            });

            if (processResponse.status === 402) {
                const errPayload =
                    (await processResponse
                        .json()
                        .catch(() => ({}))) as ApiErrorPayload;
                handleOutOfCredits(errPayload);
                return;
            }

            if (!processResponse.ok) {
                const errPayload =
                    (await processResponse
                        .json()
                        .catch(() => ({}))) as ApiErrorPayload;
                throw new Error(
                    errPayload.error ??
                    "The video could not be queued for processing.",
                );
            }

            const processData =
                (await processResponse.json()) as ProcessVideoSuccessResponse;

            setActor((prev) =>
                prev
                    ? {
                        ...prev,
                        credits: processData.creditsRemaining,
                        isAnonymous: processData.isAnonymous,
                    }
                    : prev,
            );

            setStatus("processing");
            setLastQueuedVideoId(videoId);
            setProgress(100);
            setFile(null);
            form.reset();
        } catch (error) {
            console.error("Video upload failed.", error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : statusLabels.error,
            );
            setStatus("error");
            setProgress(0);
        }
    };

    const creditsRemaining = actor?.credits ?? 0;
    const isGuest = actor?.isAnonymous ?? true;
    const isOutOfCredits = !creditsLoading && actor !== null && creditsRemaining < 1;

    return (
        <>
            <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0A0D14] p-6 text-slate-100 shadow-2xl shadow-black/40">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        Upload a video
                    </h1>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        Automatically extract viral 9:16 highlights, burn dynamic
                        captions, and generate thumbnails.
                    </p>
                </div>

                {/* Exhausted Trial Credits Banner */}
                {isOutOfCredits && isGuest && (
                    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs">
                        <div className="text-amber-200">
                            <p className="font-semibold text-amber-300">
                                Free trial credits used (0 / 3 left)
                            </p>
                            <p className="mt-0.5 text-amber-200/80">
                                Sign in or create a free account to unlock 10
                                bonus credits immediately.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setAuthModalReason(
                                    "Create a free account or sign in to claim 10 bonus credits and continue processing videos.",
                                );
                                setIsAuthModalOpen(true);
                            }}
                            className="shrink-0 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            Unlock +10 Credits
                        </button>
                    </div>
                )}

                {/* Mode Selection Tabs */}
                <div
                    role="tablist"
                    aria-label="Processing mode"
                    className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "CLIP"}
                        onClick={() => setMode("CLIP")}
                        disabled={isBusy}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${mode === "CLIP"
                            ? "bg-slate-800 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                            } disabled:opacity-50`}
                    >
                        Extract Viral Clips
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "CAPTION_ONLY"}
                        onClick={() => setMode("CAPTION_ONLY")}
                        disabled={isBusy}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${mode === "CAPTION_ONLY"
                            ? "bg-slate-800 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                            } disabled:opacity-50`}
                    >
                        Caption Full Video
                    </button>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-300">
                            Video file (MP4, MOV, WebM)
                        </span>
                        <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm"
                            onChange={handleFileChange}
                            disabled={isBusy}
                            className="block w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-400 file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-slate-800 file:bg-slate-900 file:px-4 file:py-3 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </label>

                    {mode === "CLIP" && (
                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold text-slate-300">
                                AI clipping directive (optional)
                            </span>
                            <textarea
                                value={userPrompt}
                                onChange={(event) =>
                                    setUserPrompt(event.target.value)
                                }
                                maxLength={1000}
                                rows={3}
                                placeholder="Find the funniest moments, punchlines, or key technical takeaways..."
                                disabled={isBusy}
                                className="block w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </label>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold text-slate-300">
                                Aspect ratio
                            </span>
                            <select
                                value={aspectRatio}
                                onChange={(event) =>
                                    setAspectRatio(
                                        event.target.value as AspectRatio,
                                    )
                                }
                                disabled={isBusy}
                                className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-50"
                            >
                                <option value="VERTICAL_9_16">
                                    9:16 Vertical (Shorts / Reels / TikTok)
                                </option>
                                <option value="LANDSCAPE_16_9">
                                    16:9 Landscape
                                </option>
                                <option value="SQUARE_1_1">1:1 Square</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold text-slate-300">
                                Caption style
                            </span>
                            <select
                                value={captionStyle}
                                onChange={(event) =>
                                    setCaptionStyle(
                                        event.target.value as CaptionStyle,
                                    )
                                }
                                disabled={isBusy}
                                className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-50"
                            >
                                <option value="KARAOKE">Karaoke</option>
                                <option value="HIGHLIGHT">
                                    Highlight (Hormozi Style)
                                </option>
                                <option value="MINIMAL">Minimal</option>
                                {mode === "CLIP" && (
                                    <option value="NONE">None</option>
                                )}
                            </select>
                        </label>
                    </div>

                    {file && (
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 px-3.5 py-2.5 text-xs">
                            <span className="truncate font-medium text-slate-200">
                                Selected: {file.name}
                            </span>
                            <span className="ml-2 shrink-0 font-mono text-[11px] text-slate-400">
                                {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isBusy || !file}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                        {isBusy ? (
                            <>
                                <span
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"
                                    aria-hidden="true"
                                />
                                Working...
                            </>
                        ) : isOutOfCredits && isGuest ? (
                            "Sign In to Process Video (0 Trial Credits Left)"
                        ) : (
                            "Upload & Process (1 Credit)"
                        )}
                    </button>

                    {/* Status & Progress Bar */}
                    <div className="space-y-2">
                        <div
                            className={`flex items-center justify-between text-xs ${status === "error"
                                ? "text-rose-400"
                                : status === "processing"
                                    ? "text-emerald-300"
                                    : "text-slate-400"
                                }`}
                        >
                            <span aria-live="polite" className="truncate pr-4">
                                {status === "uploading"
                                    ? loadingMessage
                                    : status === "error" && errorMessage
                                        ? errorMessage
                                        : statusLabels[status]}
                            </span>
                            {status === "uploading" && (
                                <span className="whitespace-nowrap font-mono font-semibold text-sky-400">
                                    {progress}%
                                </span>
                            )}
                        </div>

                        {status !== "idle" && status !== "error" && (
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                    className="relative h-full bg-sky-400 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}

                        {status === "processing" && lastQueuedVideoId && (
                            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2.5 text-xs text-emerald-200">
                                <span>
                                    Processing started! Your studio will update
                                    live.
                                </span>
                                <a
                                    href={`/videos/${lastQueuedVideoId}`}
                                    className="shrink-0 font-bold text-emerald-300 underline hover:text-white"
                                >
                                    Open Studio →
                                </a>
                            </div>
                        )}
                    </div>
                </form>
            </section>

            {/* AUTH GATE MODAL (Google OAuth + Email/Password) */}
            {isAuthModalOpen && (
                <AuthGateModal
                    reasonMessage={authModalReason}
                    onClose={() => setIsAuthModalOpen(false)}
                    onSuccess={async () => {
                        setIsAuthModalOpen(false);
                        await loadCredits();
                    }}
                />
            )}
        </>
    );
}

function AuthGateModal({
    reasonMessage,
    onClose,
    onSuccess,
}: {
    reasonMessage: string | null;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}) {
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

    const handleCredentialsSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
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
                    const data = (await registerRes
                        .json()
                        .catch(() => ({}))) as { error?: string };
                    throw new Error(
                        data.error ?? "Unable to create account.",
                    );
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
            setFormError(
                err instanceof Error ? err.message : "Authentication failed.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                            +10 Bonus Credits
                        </span>
                        <h2
                            id="auth-modal-title"
                            className="mt-2 text-lg font-bold text-white"
                        >
                            {tab === "register"
                                ? "Create your creator account"
                                : "Welcome back"}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close authentication modal"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                            className="h-4 w-4"
                        >
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

                {/* Google OAuth Primary CTA */}
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleGoogleSignIn()}
                    className="mt-5 flex min-h-[42px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                    >
                        <path
                            fill="#EA4335"
                            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                        />
                        <path
                            fill="#4285F4"
                            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                        />
                    </svg>
                    Continue with Google
                </button>

                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
                    <span className="h-px flex-1 bg-slate-800" />
                    <span>or with email</span>
                    <span className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Mode Switcher */}
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
                    <button
                        type="button"
                        onClick={() => {
                            setTab("register");
                            setFormError(null);
                        }}
                        className={`rounded-lg py-1.5 text-xs font-semibold transition ${tab === "register"
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:text-slate-200"
                            }`}
                    >
                        Create Account
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setTab("login");
                            setFormError(null);
                        }}
                        className={`rounded-lg py-1.5 text-xs font-semibold transition ${tab === "login"
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:text-slate-200"
                            }`}
                    >
                        Sign In
                    </button>
                </div>

                <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                    {formError && (
                        <p
                            role="alert"
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-300"
                        >
                            {formError}
                        </p>
                    )}

                    {tab === "register" && (
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-300">
                                Name
                            </span>
                            <input
                                type="text"
                                required
                                minLength={2}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your creator name"
                                className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                            />
                        </label>
                    )}

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-300">
                            Email address
                        </span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-300">
                            Password
                        </span>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 flex min-h-[42px] w-full items-center justify-center rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
                    >
                        {submitting
                            ? "Please wait..."
                            : tab === "register"
                                ? "Create Account & Claim 10 Credits"
                                : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}