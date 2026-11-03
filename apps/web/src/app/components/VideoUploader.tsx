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
import {
    MAX_UPLOAD_DURATION_SECONDS,
    MAX_UPLOAD_FILE_SIZE_BYTES,
} from "../../../../../packages/database/uploadLimits";
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
    requesting: "Checking your credits and preparing the upload",
    uploading: "Uploading your video",
    processing: "Video queued. 1 credit used.",
    error: "Upload failed. Check your connection and try again.",
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

    const [isDragOver, setIsDragOver] = useState(false);

    const selectFile = (nextFile: File | null) => {
        setFile(nextFile);
        setStatus("idle");
        setErrorMessage(null);
        setLastQueuedVideoId(null);
        setProgress(0);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] ?? null);
        setStatus("idle");
        setErrorMessage(null);
        setLastQueuedVideoId(null);
        setProgress(0);
    };

    const validateSelectedFile = async (selectedFile: File): Promise<void> => {
        if (selectedFile.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
            throw new Error("Video files must not exceed 300 MB.");
        }

        if (selectedFile.size === 0) {
            throw new Error("The selected video file is empty.");
        }

        const objectUrl = URL.createObjectURL(selectedFile);
        try {
            // Resolves to null when the browser cannot read the metadata (e.g. an
            // HEVC .mov in Chrome) or never answers. Those files are still valid,
            // and the worker enforces the 45-minute limit itself with ffprobe.
            const duration = await new Promise<number | null>((resolve) => {
                const video = document.createElement("video");
                const timer = window.setTimeout(() => resolve(null), 10_000);
                video.preload = "metadata";
                video.muted = true;
                video.onloadedmetadata = () => {
                    window.clearTimeout(timer);
                    resolve(video.duration);
                };
                video.onerror = () => {
                    window.clearTimeout(timer);
                    resolve(null);
                };
                video.src = objectUrl;
            });

            // MediaRecorder WebM reports Infinity until fully scanned; treat that as unknown.
            if (
                duration !== null &&
                Number.isFinite(duration) &&
                duration > MAX_UPLOAD_DURATION_SECONDS
            ) {
                throw new Error("Videos must not exceed 45 minutes.");
            }
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
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

        // Some browsers (notably on Windows) report an empty MIME type for .mov/.mp4.
        const extension = file.name.split(".").pop()?.toLowerCase();
        const contentType =
            file.type ||
            (extension === "mov"
                ? "video/quicktime"
                : extension === "webm"
                    ? "video/webm"
                    : "video/mp4");

        try {
            await validateSelectedFile(file);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "The selected video does not meet the upload limits.",
            );
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
                    contentType: contentType,
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

            setLoadingMessage(pickRandomPhrase());
            setStatus("uploading");

            // Retry transient network/5xx failures with a fresh presigned URL,
            // so a brief connection drop does not cost the user their upload.
            const MAX_UPLOAD_ATTEMPTS = 3;
            for (let attempt = 1; ; attempt++) {
                const { uploadUrl } = await getPresignedUploadUrl(
                    {
                        filename: file.name,
                        contentType: contentType,
                        fileSize: file.size,
                    },
                    s3Key,
                );

                const outcome = await new Promise<"ok" | "retry" | "fatal">((resolve) => {
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
                        if (xhr.status >= 200 && xhr.status < 300) resolve("ok");
                        else if (xhr.status >= 500 || xhr.status === 408 || xhr.status === 429)
                            resolve("retry");
                        else resolve("fatal");
                    };
                    xhr.onerror = () => resolve("retry");
                    xhr.ontimeout = () => resolve("retry");

                    xhr.open("PUT", uploadUrl);
                    xhr.setRequestHeader("Content-Type", contentType);
                    xhr.send(file);
                });

                if (outcome === "ok") break;
                if (outcome === "fatal") {
                    throw new Error("The video could not be uploaded to storage.");
                }
                if (attempt >= MAX_UPLOAD_ATTEMPTS) {
                    throw new Error(
                        "Network error during upload. Check your connection and try again.",
                    );
                }
                setProgress(0);
                await new Promise((resolve) => window.setTimeout(resolve, 2000 * attempt));
            }

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
            <section className="w-full max-w-xl text-ink">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-balance font-display text-[clamp(32px,2.4vw+16px,44px)] font-medium leading-[1.08] tracking-[-0.03em] text-ink">
                        Turn a long video into short clips
                    </h1>
                    <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-muted">
                        We find the strongest moments, add captions and make thumbnails. Clips come back sized for TikTok and YouTube Shorts.
                    </p>
                </div>

                {/* Out of trial credits */}
                {isOutOfCredits && isGuest && (
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-action/40 bg-action/15 p-4">
                        <div>
                            <p className="text-sm font-semibold text-ink">You have used your 3 trial credits</p>
                            <p className="mt-0.5 text-sm text-muted">Create a free account to get 10 more.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setAuthModalReason(
                                    "Create a free account or sign in to get 10 more credits and keep processing videos.",
                                );
                                setIsAuthModalOpen(true);
                            }}
                            className="inline-flex h-10 shrink-0 items-center rounded-lg bg-action px-4 text-sm font-medium text-action-ink transition hover:bg-action-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                        >
                            Get 10 credits
                        </button>
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    {/* Mode */}
                    <div>
                        <span id="mode-label" className="mb-2 block text-[13px] font-medium text-ink">What should we make?</span>
                        <div
                            role="radiogroup"
                            aria-labelledby="mode-label"
                            className="grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-surface p-[3px]"
                        >
                            {([
                                ["CLIP", "Short clips"],
                                ["CAPTION_ONLY", "Captioned full video"],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === value}
                                    onClick={() => setMode(value)}
                                    disabled={isBusy}
                                    className={`h-9 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 ${mode === value
                                        ? "bg-raised text-ink shadow-[0_0_0_1px_var(--sm-line-strong)]"
                                        : "text-muted hover:text-ink"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Drop zone */}
                    <label
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (!isBusy) setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setIsDragOver(false);
                            if (isBusy) return;
                            const dropped = event.dataTransfer.files?.[0];
                            if (dropped) selectFile(dropped);
                        }}
                        className={`relative grid cursor-pointer justify-items-center gap-2 rounded-xl border-[1.5px] border-dashed px-6 py-10 text-center transition focus-within:ring-2 focus-within:ring-focus ${isDragOver
                            ? "border-action bg-action/15"
                            : "border-line-strong bg-surface hover:border-action hover:bg-action/12"
                            } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
                    >
                        <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm"
                            onChange={handleFileChange}
                            disabled={isBusy}
                            className="sr-only"
                        />
                        <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised text-ink">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                            </svg>
                        </span>
                        {file ? (
                            <>
                                <strong className="max-w-full truncate text-base font-semibold">{file.name}</strong>
                                <span className="text-[13px] text-muted">
                                    <span className="tabular-nums">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>. Choose another file to replace it.
                                </span>
                            </>
                        ) : (
                            <>
                                <strong className="text-base font-semibold">Drop a video or choose a file</strong>
                                <span className="text-[13px] text-muted">MP4, MOV or WebM, up to 300&nbsp;MB and 45&nbsp;minutes</span>
                            </>
                        )}
                    </label>

                    {mode === "CLIP" && (
                        <label className="block">
                            <span className="mb-2 block text-[13px] font-medium text-ink">Clip directive</span>
                            <textarea
                                value={userPrompt}
                                onChange={(event) => setUserPrompt(event.target.value)}
                                maxLength={1000}
                                rows={3}
                                placeholder="Find the moments where we talk about pricing"
                                disabled={isBusy}
                                className="block w-full resize-y rounded-lg border border-line-strong bg-raised px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <span className="mt-1.5 block text-[13px] text-muted">Optional. Leave it empty and we pick the strongest moments.</span>
                        </label>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-2 block text-[13px] font-medium text-ink">Aspect ratio</span>
                            <select
                                value={aspectRatio}
                                onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
                                disabled={isBusy}
                                className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35 disabled:opacity-50"
                            >
                                <option value="VERTICAL_9_16">Vertical 9:16</option>
                                <option value="LANDSCAPE_16_9">Landscape 16:9</option>
                                <option value="SQUARE_1_1">Square 1:1</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[13px] font-medium text-ink">Caption style</span>
                            <select
                                value={captionStyle}
                                onChange={(event) => setCaptionStyle(event.target.value as CaptionStyle)}
                                disabled={isBusy}
                                className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35 disabled:opacity-50"
                            >
                                <option value="KARAOKE">Karaoke</option>
                                <option value="HIGHLIGHT">Highlight</option>
                                <option value="MINIMAL">Minimal</option>
                                {mode === "CLIP" && <option value="NONE">No captions</option>}
                            </select>
                        </label>
                    </div>

                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={isBusy || !file}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-action px-6 text-base font-medium text-action-ink transition hover:bg-action-hover active:translate-y-px active:bg-action-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-surface disabled:text-muted"
                        >
                            {isBusy ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
                                    {status === "uploading" ? "Uploading" : "Preparing upload"}
                                </>
                            ) : isOutOfCredits && isGuest ? (
                                "Sign in to make clips"
                            ) : mode === "CLIP" ? (
                                "Make clips, 1 credit"
                            ) : (
                                "Caption video, 1 credit"
                            )}
                        </button>

                        {/* Status */}
                        <div className="space-y-2">
                            <div
                                className={`flex items-center justify-between gap-4 text-sm ${status === "error"
                                    ? "font-medium text-danger"
                                    : status === "processing"
                                        ? "text-success"
                                        : "text-muted"
                                    }`}
                            >
                                <span aria-live="polite" className="min-w-0">
                                    {status === "uploading"
                                        ? loadingMessage
                                        : status === "error" && errorMessage
                                            ? errorMessage
                                            : statusLabels[status]}
                                </span>
                                {status === "uploading" && (
                                    <span className="shrink-0 tabular-nums font-medium text-ink">{progress}%</span>
                                )}
                            </div>

                            {status !== "idle" && status !== "error" && (
                                <div className="h-1 w-full overflow-hidden rounded-full bg-line-strong">
                                    <div
                                        className="h-full rounded-full bg-action transition-[width] duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}

                            {status === "processing" && lastQueuedVideoId && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-ink">Processing started</p>
                                        <p className="text-sm text-muted">The studio updates as each clip finishes.</p>
                                    </div>
                                    <a
                                        href={`/videos/${lastQueuedVideoId}`}
                                        className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition hover:border-ink hover:bg-surface"
                                    >
                                        Open the studio
                                    </a>
                                </div>
                            )}
                        </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        >
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-raised p-6 text-ink shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-action/20 px-2.5 py-0.5 text-[13px] font-medium text-ink">
                            10 free credits
                        </span>
                        <h2
                            id="auth-modal-title"
                            className="mt-2 font-display text-[22px] font-medium tracking-[-0.02em] text-ink"
                        >
                            {tab === "register"
                                ? "Create your account"
                                : "Welcome back"}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close authentication modal"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                    <p className="mt-3 rounded-lg border border-action/40 bg-action/15 p-3 text-sm leading-relaxed text-ink">
                        {reasonMessage}
                    </p>
                )}

                {/* Google OAuth Primary CTA */}
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleGoogleSignIn()}
                    className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
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

                <div className="my-4 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" />
                    <span>or with email</span>
                    <span className="h-px flex-1 bg-line" />
                </div>

                {/* Mode Switcher */}
                <div className="mb-4 grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
                    <button
                        type="button"
                        onClick={() => {
                            setTab("register");
                            setFormError(null);
                        }}
                        className={`rounded-lg py-1.5 text-xs font-semibold transition ${tab === "register"
                            ? "bg-surface text-ink"
                            : "text-muted hover:text-ink"
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
                            ? "bg-surface text-ink"
                            : "text-muted hover:text-ink"
                            }`}
                    >
                        Sign In
                    </button>
                </div>

                <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                    {formError && (
                        <p
                            role="alert"
                            className="rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs font-medium text-danger"
                        >
                            {formError}
                        </p>
                    )}

                    {tab === "register" && (
                        <label className="block">
                            <span className="mb-1.5 block text-[13px] font-medium text-ink">
                                Name
                            </span>
                            <input
                                type="text"
                                required
                                minLength={2}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your creator name"
                                className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35"
                            />
                        </label>
                    )}

                    <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink">
                            Email address
                        </span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink">
                            Password
                        </span>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-base font-medium text-action-ink active:translate-y-px transition hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                    >
                        {submitting
                            ? "Signing you in"
                            : tab === "register"
                                ? "Create Account & Claim 10 Credits"
                                : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}