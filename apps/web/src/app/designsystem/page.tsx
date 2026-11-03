import type { Metadata } from "next";
import { DM_Mono, Funnel_Display, Funnel_Sans } from "next/font/google";
import DesignSystem from "./DesignSystem";
import "./designsystem.css";

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
    title: "Design system",
    description:
        "Colours, type and components for Scroll Maestro, in light and dark mode.",
};

export default function DesignSystemPage() {
    return (
        <DesignSystem
            fontClassName={`${funnelDisplay.variable} ${funnelSans.variable} ${dmMono.variable}`}
        />
    );
}
