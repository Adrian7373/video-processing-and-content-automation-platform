import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppChrome from "./components/AppChrome";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
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
        <html lang="en" className="dark">
            <body
                className={`${geistSans.variable} ${geistMono.variable} bg-[#0A0D14] text-slate-100 antialiased`}
            >
                <AppChrome>{children}</AppChrome>
            </body>
        </html>
    );
}