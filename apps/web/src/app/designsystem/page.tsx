import type { Metadata } from "next";
import DesignSystem from "./DesignSystem";
import "./designsystem.css";

export const metadata: Metadata = {
    title: "Design system",
    description:
        "Colours, type and components for Scroll Maestro, in light and dark mode.",
};

export default function DesignSystemPage() {
    return <DesignSystem />;
}
