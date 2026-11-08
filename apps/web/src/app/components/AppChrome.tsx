"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "./AppSideBar";
import TopNav from "./TopNav";
import LegalFooter from "./LegalFooter";
import ConsentGate from "./ConsentGate";

/** Routes that render their own full-page chrome instead of the app shell. */
const STANDALONE_ROUTES = ["/designsystem"];

export default function AppChrome({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isStandalone = STANDALONE_ROUTES.some(
        (route) => pathname === route || pathname?.startsWith(`${route}/`),
    );

    if (isStandalone) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen w-full bg-page">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <TopNav />
                <main className="flex-1">{children}</main>
                <LegalFooter />
                <ConsentGate />
            </div>
        </div>
    );
}
