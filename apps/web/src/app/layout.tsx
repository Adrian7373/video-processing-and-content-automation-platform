import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppSidebar from "./components/AppSideBar";
import TopNav from "./components/TopNav";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Video Repurposer Studio",
    description:
        "Extract viral clips, burn dynamic captions, and schedule across social channels.",
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
                <div className="flex min-h-screen w-full bg-[#0A0D14]">
                    <AppSidebar />
                    {/* Main Workspace Column */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <TopNav />
                        <main className="flex-1">
                            {children}
                        </main>
                    </div>
                </div>
            </body>
        </html>
    );
}