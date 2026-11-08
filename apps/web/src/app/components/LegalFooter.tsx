import Link from "next/link";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

export default function LegalFooter() {
    return (
        <footer className="border-t border-line px-6 py-6 text-sm text-muted sm:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    &copy; {new Date().getFullYear()} {LEGAL.productName}. Made in the Philippines.
                </p>
                <nav aria-label="Legal">
                    <ul className="flex flex-wrap gap-x-5 gap-y-2">
                        {LEGAL_LINKS.map((link) => (
                            <li key={link.href}>
                                <Link href={link.href} className="transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </footer>
    );
}
