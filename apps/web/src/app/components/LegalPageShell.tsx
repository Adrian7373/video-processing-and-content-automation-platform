import Link from "next/link";

type LegalPageShellProps = {
    eyebrow: string;
    title: string;
    description: string;
    effectiveDate: string;
    children: React.ReactNode;
};

export default function LegalPageShell({
    eyebrow,
    title,
    description,
    effectiveDate,
    children,
}: LegalPageShellProps) {
    return (
        <main className="min-h-[calc(100vh-4rem)] bg-page px-6 py-12 text-ink sm:px-10 lg:px-16">
            <div className="mx-auto max-w-6xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-link transition hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                    <span aria-hidden="true">←</span>
                    Back to Scroll Maestro
                </Link>

                <header className="mt-10 max-w-3xl border-b border-line pb-10">
                    <p className="tabular-nums text-xs font-semibold text-link">
                        {eyebrow}
                    </p>
                    <h1 className="mt-4 text-4xl font-medium font-display tracking-tight text-ink sm:text-5xl">
                        {title}
                    </h1>
                    <p className="mt-5 text-lg leading-8 text-muted">{description}</p>
                    <p className="mt-6 text-sm text-muted">
                        Effective date: <time dateTime="2026-11-01">{effectiveDate}</time>
                    </p>
                </header>

                <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
                    <nav
                        aria-label="On this page"
                        className="h-fit lg:sticky lg:top-24"
                    >
                        <p className="text-xs font-semibold text-muted">
                            On this page
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-muted">
                            <li>
                                <a className="transition hover:text-link" href="#overview">
                                    Overview
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-link" href="#information">
                                    Information
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-link" href="#your-rights">
                                    Your rights
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-link" href="#contact">
                                    Contact
                                </a>
                            </li>
                        </ul>
                    </nav>
                    <article className="legal-content min-w-0 max-w-3xl">{children}</article>
                </div>
            </div>
        </main>
    );
}
