"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";

import { DARK_QUERY, THEME_KEY } from "./themeScript";

const THEME_EVENT = "sm-theme-change";

function readTheme(): ThemeMode {
    try {
        const stored = window.localStorage.getItem(THEME_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
        // Storage can be blocked (private mode); fall back to the system setting.
    }
    return "system";
}

function applyTheme(mode: ThemeMode) {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle("system-dark", window.matchMedia(DARK_QUERY).matches);
}

export function setTheme(mode: ThemeMode) {
    try {
        window.localStorage.setItem(THEME_KEY, mode);
    } catch {
        // Ignore: the choice still applies for this visit.
    }
    applyTheme(mode);
    window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribeTheme(callback: () => void) {
    const onStorage = () => {
        applyTheme(readTheme());
        callback();
    };
    window.addEventListener(THEME_EVENT, callback);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(THEME_EVENT, callback);
        window.removeEventListener("storage", onStorage);
    };
}

function subscribeSystemDark(callback: () => void) {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => {
        document.documentElement.classList.toggle("system-dark", query.matches);
        callback();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

export function useTheme() {
    const mode = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeMode);
    const systemDark = useSyncExternalStore(
        subscribeSystemDark,
        () => window.matchMedia(DARK_QUERY).matches,
        () => false,
    );
    const resolved: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    return { mode, resolved, setMode: setTheme };
}

/** Keeps <html> in sync with the stored theme and the OS setting. Mount once. */
export function ThemeSync() {
    const { mode } = useTheme();
    useEffect(() => {
        applyTheme(mode);
    }, [mode]);
    return null;
}
