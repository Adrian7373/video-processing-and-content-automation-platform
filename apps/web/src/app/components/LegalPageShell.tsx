import Link from "next/link";
import { LEGAL, LEGAL_EFFECTIVE_DATE, LEGAL_EFFECTIVE_ISO, LEGAL_LINKS } from "@/lib/legal";

type TocItem = { id: string; label: string };

type LegalPageShellProps = {
    eyebrow: string;
    title: string;
    description: string;
    /** Section anchors for the "On this page" list. */
    toc: readonly TocItem[];
    children: React.ReactNode;
};

export default function LegalPageShell({
    eyebrow,
    title,
    description,
    toc,
    children,
}: LegalPageShellProps) {
    return (
        <div className="bg-page px-6 py-12 text-ink sm:px-10 lg:px-16">
            <div className="mx-auto max-w-6xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-link transition hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                    <span aria-hidden="true">←</span>
                    Back to {LEGAL.productName}
                </Link>

                <header className="mt-10 max-w-3xl border-b border-line pb-10">
                    <p className="text-sm font-medium text-link">{eyebrow}</p>
                    <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
                        {title}
                    </h1>
                    <p className="mt-5 text-lg leading-8 text-muted">{description}</p>
                    <p className="mt-6 text-sm text-muted">
                        Effective date: <time dateTime={LEGAL_EFFECTIVE_ISO}>{LEGAL_EFFECTIVE_DATE}</time>
                    </p>
                </header>

                <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
                    <nav aria-label="On this page" className="h-fit lg:sticky lg:top-24">
                        <p className="text-sm font-medium text-muted">On this page</p>
                        <ul className="mt-4 space-y-3 text-sm text-muted">
                            {toc.map((item) => (
                                <li key={item.id}>
                                    <a className="transition hover:text-link" href={`#${item.id}`}>
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-8 text-sm font-medium text-muted">Other policies</p>
                        <ul className="mt-4 space-y-3 text-sm text-muted">
                            {LEGAL_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link className="transition hover:text-link" href={link.href}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <article className="legal-content min-w-0 max-w-3xl">{children}</article>
                </div>
            </div>
        </div>
    );
}
