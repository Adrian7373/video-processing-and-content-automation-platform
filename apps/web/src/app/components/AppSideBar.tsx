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
    Monitor,
    Moon,
    PanelLeftOpen,
    Sun,
    Zap,
    type LucideIcon,
} from "lucide-react";
import type { CreditsStatusResponse } from "@/app/api/credits/route";
import AuthGateModal from "./AuthGateModal";
import BrandMark from "./BrandMark";
import { useTheme, type ThemeMode } from "@/lib/theme";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
];

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
    const { mode: themeMode, setMode: setThemeMode } = useTheme();
    // Workspace pages (calendar, studio) need the width, so they default to the
    // icon rail. An explicit expand/collapse by the user wins on each kind of page.
    const isWorkspace = pathname.startsWith("/calendar") || /^\/videos\/[^/]+/.test(pathname);
    const [collapsePref, setCollapsePref] = useState<{ workspace: boolean | null; page: boolean | null }>({ workspace: null, page: null });
    const railPreferred = (isWorkspace ? collapsePref.workspace : collapsePref.page) ?? isWorkspace;
    const setCollapsed = (update: (prev: boolean) => boolean) =>
        setCollapsePref((prev) => ({ ...prev, [isWorkspace ? "workspace" : "page"]: update(railPreferred) }));
    // Phone drawer: open only for the path it was opened on, so navigating closes it.
    const [drawerPath, setDrawerPath] = useState<string | null>(null);
    const drawerOpen = drawerPath === pathname;
    // The phone drawer always opens fully expanded.
    const collapsed = railPreferred && !drawerOpen;

    useEffect(() => {
        const toggle = () => setDrawerPath((current) => (current === null ? window.location.pathname : null));
        window.addEventListener("sm:toggle-nav", toggle);
        return () => window.removeEventListener("sm:toggle-nav", toggle);
    }, []);
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
            {drawerOpen && (
                <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setDrawerPath(null)}
                    className="fixed inset-0 z-40 bg-overlay md:hidden"
                />
            )}
            <aside
                id="app-sidebar"
                aria-label="Primary sidebar navigation"
                className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] shrink-0 flex-col border-r border-line bg-page text-ink select-none transition-[transform,width] duration-200 ease-out md:sticky md:top-0 md:z-30 md:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-[72px]" : "md:w-[252px]"}`}
            >
                {/* Top Brand & Collapse Button */}
                <div className={`flex h-16 items-center px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
                    {!collapsed && (
                        <Link href="/" aria-label="Scroll Maestro home" className="flex items-center gap-2.5 rounded-lg px-1 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                            <BrandMark />
                            <span className="font-display text-[17px] font-medium tracking-[-0.02em]">Scroll Maestro</span>
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={() => { setCollapsed((prev) => !prev); setProfileMenuOpen(false); }}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                        className={`flex w-full items-center rounded-xl border border-line bg-raised p-2.5 text-left transition hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${collapsed ? "justify-center" : "justify-between gap-2.5"
                            }`}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            {actor?.image ? (
                                <img src={actor.image} alt={displayName ?? "User avatar"} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line-strong" />
                            ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-ink ring-1 ring-line-strong">
                                    {initials}
                                </div>
                            )}

                            {!collapsed && (
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted tabular-nums" title={`${credits} credits remaining`}>
                                            <Zap className="h-3.5 w-3.5 text-link" aria-hidden="true" />
                                            {credits}
                                        </span>
                                        <span className="rounded-md bg-surface/90 px-2 py-0.5 text-xs font-medium text-ink">
                                            {isGuest ? "Trial" : "Free"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!collapsed && <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${profileMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />}
                    </button>

                    {/* Dropdown Menu */}
                    {profileMenuOpen && !collapsed && (
                        <div className="absolute right-3 left-3 z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-raised p-1.5 shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                            <div className="border-b border-line px-2.5 py-2 text-xs text-muted">
                                <p className="truncate font-medium text-ink">{actor?.email || "Trial session (not signed in)"}</p>
                                <p className="mt-0.5 text-xs text-muted">{credits} {credits === 1 ? "credit" : "credits"} available</p>
                            </div>

                            {!isGuest ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileMenuOpen(false);
                                        setShowSignOutModal(true);
                                    }}
                                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-danger transition hover:bg-danger/10"
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
                                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-link transition hover:bg-action/12"
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
                            {!collapsed && <p className="mb-1.5 px-3 text-xs font-semibold text-ink">{group.section}</p>}
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
                                                className={`group flex min-h-[42px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${collapsed ? "justify-center" : ""} ${active
                                                    ? "bg-surface text-ink shadow-[inset_2px_0_0_var(--sm-action)]"
                                                    : "text-muted hover:bg-surface hover:text-ink"
                                                    }`}
                                            >
                                                <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-ink" : "text-muted group-hover:text-ink"}`} aria-hidden="true" />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Theme switch */}
                <div className={`border-t border-line p-3 ${collapsed ? "flex justify-center" : ""}`}>
                    <div
                        role="radiogroup"
                        aria-label="Colour theme"
                        className={`flex gap-0.5 rounded-lg border border-line bg-surface p-[3px] ${collapsed ? "flex-col" : ""}`}
                    >
                        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                            const checked = themeMode === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    aria-label={label}
                                    title={label}
                                    onClick={() => setThemeMode(value)}
                                    className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${checked ? "bg-raised text-ink shadow-[0_0_0_1px_var(--sm-line-strong)]" : "text-muted hover:text-ink"}`}
                                >
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {!collapsed && label}
                                </button>
                            );
                        })}
                    </div>
                </div>
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
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
                    <div className="w-full max-w-sm rounded-xl border border-line bg-raised p-6 shadow-[0_24px_48px_-24px_rgba(14,20,36,0.4)]">
                        <h2 className="text-lg font-medium font-display text-ink">Sign out</h2>
                        <p className="mt-2 text-sm text-muted">
                            Are you sure you want to sign out? You will need to sign back in to access your projects and schedule posts.
                        </p>
                        <div className="mt-6 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSignOutModal(false)}
                                className="flex-1 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void signOut({ callbackUrl: "/" })}
                                className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-page transition hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
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