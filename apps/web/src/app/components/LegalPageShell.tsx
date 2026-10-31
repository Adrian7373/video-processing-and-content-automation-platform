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
        <main className="min-h-[calc(100vh-4rem)] bg-[#0A0D14] px-6 py-12 text-slate-100 sm:px-10 lg:px-16">
            <div className="mx-auto max-w-6xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                    <span aria-hidden="true">←</span>
                    Back to Scroll Maestro
                </Link>

                <header className="mt-10 max-w-3xl border-b border-slate-800 pb-10">
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
                        {eyebrow}
                    </p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                        {title}
                    </h1>
                    <p className="mt-5 text-lg leading-8 text-slate-400">{description}</p>
                    <p className="mt-6 text-sm text-slate-500">
                        Effective date: <time dateTime="2026-11-01">{effectiveDate}</time>
                    </p>
                </header>

                <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
                    <nav
                        aria-label="On this page"
                        className="h-fit lg:sticky lg:top-24"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            On this page
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-slate-400">
                            <li>
                                <a className="transition hover:text-sky-300" href="#overview">
                                    Overview
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-sky-300" href="#information">
                                    Information
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-sky-300" href="#your-rights">
                                    Your rights
                                </a>
                            </li>
                            <li>
                                <a className="transition hover:text-sky-300" href="#contact">
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
