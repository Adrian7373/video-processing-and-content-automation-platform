/**
 * Shared class recipes for the Scroll Maestro design system (see /designsystem).
 * Use these instead of re-typing control styles so every screen matches.
 */

const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page";

const btnBase = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 ${focusRing}`;

export const ui = {
    focusRing,
    /** The one main action in a view. */
    btnPrimary: `${btnBase} h-11 px-5 text-base bg-action text-action-ink hover:bg-action-hover active:bg-action-press`,
    btnPrimarySm: `${btnBase} h-9 px-4 text-sm bg-action text-action-ink hover:bg-action-hover active:bg-action-press`,
    btnSecondary: `${btnBase} h-11 px-5 text-base border border-line-strong bg-raised text-ink hover:border-ink hover:bg-surface`,
    btnSecondarySm: `${btnBase} h-9 px-3.5 text-sm border border-line-strong bg-raised text-ink hover:border-ink hover:bg-surface`,
    btnQuiet: `${btnBase} h-9 px-3 text-sm text-ink hover:bg-surface`,
    btnDanger: `${btnBase} h-9 px-3.5 text-sm border border-danger/45 text-danger hover:border-danger hover:bg-danger/10`,
    btnIcon: `${btnBase} h-9 w-9 shrink-0 text-muted hover:bg-surface hover:text-ink`,

    label: "mb-1.5 block text-[13px] font-medium text-ink",
    hint: "mt-1.5 block text-[13px] text-muted",
    input: "block h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-base text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35 disabled:opacity-50",
    textarea: "block w-full resize-y rounded-lg border border-line-strong bg-raised px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-muted hover:border-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-action/35 disabled:opacity-50",

    /** Segmented control track and its options. */
    segTrack: "flex gap-0.5 rounded-lg border border-line bg-surface p-[3px]",
    segOption: (selected: boolean) =>
        `inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${focusRing} ${selected ? "bg-raised text-ink shadow-[0_0_0_1px_var(--sm-line-strong)]" : "text-muted hover:text-ink"}`,

    /** Toggle chip (multi-select, e.g. accounts or filters). */
    chip: (selected: boolean) =>
        `inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${focusRing} ${selected ? "border-ink bg-raised text-ink shadow-[inset_0_0_0_1px_var(--sm-ink)]" : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink"}`,

    panel: "rounded-xl border border-line bg-raised",
    modalBackdrop: "fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4",
    modal: "w-full overflow-hidden rounded-xl border border-line bg-raised shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]",
    h1: "font-display text-[32px] font-medium leading-tight tracking-[-0.025em] text-ink",
    h2: "font-display text-[22px] font-medium leading-snug tracking-[-0.02em] text-ink",
};

export const STATUS_BADGE: Record<
    "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED",
    { label: string; className: string }
> = {
    SCHEDULED: { label: "Scheduled", className: "bg-info/12 text-info" },
    PUBLISHING: { label: "Publishing", className: "bg-action/18 text-ink" },
    PUBLISHED: { label: "Published", className: "bg-success/12 text-success" },
    FAILED: { label: "Failed", className: "bg-danger/12 text-danger" },
    CANCELLED: { label: "Cancelled", className: "bg-surface text-muted" },
};

export const badgeBase =
    "inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-['']";

/** Real brand colours for platform marks (icons only, never text). */
export const PLATFORM_COLOR: Record<
    "YOUTUBE_SHORTS" | "TIKTOK" | "INSTAGRAM_REELS" | "FACEBOOK_REELS",
    string
> = {
    YOUTUBE_SHORTS: "text-[#FF0033]",
    TIKTOK: "text-ink",
    INSTAGRAM_REELS: "text-[#E1306C]",
    FACEBOOK_REELS: "text-[#1877F2]",
};
