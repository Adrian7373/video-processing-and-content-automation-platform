import type { Metadata } from "next";
import { DM_Mono, Funnel_Display, Funnel_Sans } from "next/font/google";
import "./globals.css";
import AppChrome from "./components/AppChrome";
import { ThemeSync } from "@/lib/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/themeScript";

const funnelDisplay = Funnel_Display({
    subsets: ["latin"],
    variable: "--ds-font-display",
    display: "swap",
});

const funnelSans = Funnel_Sans({
    subsets: ["latin"],
    variable: "--ds-font-text",
    display: "swap",
});

const dmMono = DM_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--ds-font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Scroll Maestro",
        template: "%s | Scroll Maestro",
    },
    description:
        "Process, repurpose, and publish video content with Scroll Maestro.",
    other: {
        "tiktok-developers-site-verification": "oQVLUiaDkPt4VJ6abyWy10kO1y8Hrqbu",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        // data-theme is set before paint by THEME_BOOT_SCRIPT, so the server
        // and client attributes legitimately differ.
        <html
            lang="en"
            data-theme="system"
            suppressHydrationWarning
            className={`${funnelDisplay.variable} ${funnelSans.variable} ${dmMono.variable}`}
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
            </head>
            <body className="bg-page text-ink antialiased">
                <ThemeSync />
                <AppChrome>{children}</AppChrome>
            </body>
        </html>
    );
}
