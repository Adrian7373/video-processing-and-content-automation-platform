"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    Calendar,
    ChevronDown,
    FolderKanban,
    Home,
    Link2,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    Sparkles,
    Zap,
    type LucideIcon,
} from "lucide-react";
import type { CreditsStatusResponse } from "@/app/api/credits/route";
import AuthGateModal from "./AuthGateModal";

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    matchPrefix?: string;
}

interface NavGroup {
    section: string;
    items: readonly NavItem[];
}

const NAV_GROUPS: readonly NavGroup[] = [
    {
        section: "Create",
        items: [
            { label: "Home", href: "/", icon: Home },
            { label: "My projects", href: "/videos", icon: FolderKanban, matchPrefix: "/videos" },
        ],
    },
    {
        section: "Post",
        items: [
            { label: "Calendar", href: "/calendar", icon: Calendar, matchPrefix: "/calendar" },
            { label: "Social accounts", href: "/channels", icon: Link2, matchPrefix: "/channels" },
        ],
    },
];

export default function AppSidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [actor, setActor] = useState<CreditsStatusResponse | null>(null);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);

    // Modal States
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);

    const loadActor = useCallback(async () => {
        try {
            const res = await fetch("/api/credits", { cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as CreditsStatusResponse;
            setActor(data);
        } catch {
            // Keep existing state on network blip
        }
    }, []);

    useEffect(() => {
        void loadActor();
    }, [loadActor, pathname]);

    useEffect(() => {
        const handleCreditsUpdated = () => void loadActor();
        window.addEventListener("vr:credits-updated", handleCreditsUpdated);
        return () => window.removeEventListener("vr:credits-updated", handleCreditsUpdated);
    }, [loadActor]);

    const displayName = actor?.name || (actor?.email ? actor.email.split("@")[0] : "Guest Creator");
    const initials = (displayName || "G").slice(0, 2).toUpperCase();
    const credits = actor?.credits ?? 0;
    const isGuest = actor?.isAnonymous ?? true;

    const isRouteActive = (item: NavItem): boolean => {
        if (item.href === "/") return pathname === "/";
        return pathname === item.href || (Boolean(item.matchPrefix) && pathname.startsWith(item.matchPrefix!));
    };

    return (
        <>
            <aside
                aria-label="Primary sidebar navigation"
                className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#0A0D14] text-slate-200 select-none transition-[width] duration-200 ease-out ${collapsed ? "w-[72px]" : "w-[252px]"
                    }`}
            >
                {/* Top Brand & Collapse Button */}
                <div className={`flex h-16 items-center px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
                    {!collapsed && (
                        <Link href="/" aria-label="Go to home" className="flex items-center gap-2.5 rounded-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-950 shadow-sm">
                                <Sparkles className="h-4 w-4 stroke-[2.2]" />
                            </span>
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={() => { setCollapsed((prev) => !prev); setProfileMenuOpen(false); }}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800/90 bg-[#121620] text-slate-400 transition hover:border-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                </div>

                {/* User Profile Card */}
                <div className="relative px-3 pb-2">
                    <button
                        type="button"
                        onClick={() => setProfileMenuOpen((prev) => !prev)}
                        aria-expanded={profileMenuOpen}
                        aria-label="Account menu"
                        className={`flex w-full items-center rounded-2xl border border-slate-800/90 bg-[#11151F] p-2.5 text-left transition hover:border-slate-700/90 hover:bg-[#151A26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${collapsed ? "justify-center" : "justify-between gap-2.5"
                            }`}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            {actor?.image ? (
                                <img src={actor.image} alt={displayName ?? "User avatar"} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-700" />
                            ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 ring-1 ring-slate-700">
                                    {initials}
                                </div>
                            )}

                            {!collapsed && (
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 tabular-nums" title={`${credits} credits remaining`}>
                                            <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                                            {credits}
                                        </span>
                                        <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                                            {isGuest ? "Trial" : "Free"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!collapsed && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${profileMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />}
                    </button>

                    {/* Dropdown Menu */}
                    {profileMenuOpen && !collapsed && (
                        <div className="absolute right-3 left-3 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-800 bg-[#121621] p-1.5 shadow-xl shadow-black/50">
                            <div className="border-b border-slate-800/80 px-2.5 py-2 text-xs text-slate-400">
                                <p className="truncate font-medium text-slate-200">{actor?.email || "Anonymous Trial Session"}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">{credits} {credits === 1 ? "credit" : "credits"} available</p>
                            </div>

                            {!isGuest ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileMenuOpen(false);
                                        setShowSignOutModal(true);
                                    }}
                                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    Sign out
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileMenuOpen(false);
                                        setShowAuthModal(true);
                                    }}
                                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/10"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    Sign in for +10 credits
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation Groups */}
                <nav aria-label="Workspace sections" className="mt-4 flex-1 space-y-6 overflow-y-auto px-3 pb-6">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.section}>
                            {!collapsed && <p className="mb-2 px-3 text-xs font-medium text-slate-500">{group.section}</p>}
                            <ul className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isRouteActive(item);

                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                title={collapsed ? item.label : undefined}
                                                aria-current={active ? "page" : undefined}
                                                className={`group flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${collapsed ? "justify-center" : ""
                                                    } ${active
                                                        ? "border border-slate-800/90 bg-[#161B26] text-white shadow-sm"
                                                        : "border border-transparent text-slate-300 hover:bg-slate-900/70 hover:text-white"
                                                    }`}
                                            >
                                                <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} aria-hidden="true" />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Global Modals */}
            {showAuthModal && (
                <AuthGateModal
                    onClose={() => setShowAuthModal(false)}
                    onSuccess={async () => {
                        setShowAuthModal(false);
                        await loadActor();
                        window.dispatchEvent(new Event("vr:credits-updated"));
                    }}
                />
            )}

            {showSignOutModal && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#11151F] p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-white">Sign out</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Are you sure you want to sign out? You will need to sign back in to access your projects and schedule posts.
                        </p>
                        <div className="mt-6 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSignOutModal(false)}
                                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void signOut({ callbackUrl: "/" })}
                                className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}