export type SocialPlatformType =
    | "YOUTUBE_SHORTS"
    | "TIKTOK"
    | "INSTAGRAM_REELS"
    | "FACEBOOK_REELS";

export const PLATFORM_LABEL: Record<SocialPlatformType, { label: string; short: string }> = {
    YOUTUBE_SHORTS: { label: "YouTube Shorts", short: "Shorts" },
    TIKTOK: { label: "TikTok", short: "TikTok" },
    INSTAGRAM_REELS: { label: "Instagram Reels", short: "Reels" },
    FACEBOOK_REELS: { label: "Facebook Reels", short: "Facebook" },
};

export default function PlatformIcon({
    platform,
    className = "h-3.5 w-3.5",
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
