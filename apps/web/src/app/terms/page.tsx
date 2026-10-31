import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";

export const metadata: Metadata = {
    title: "Terms of Service | Scroll Maestro",
    description: "The terms that govern use of the Scroll Maestro platform.",
};

export default function TermsPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Terms of Service"
            description="These terms explain the rules for using Scroll Maestro to process, transform, and publish video content."
            effectiveDate="November 1, 2026"
        >
            <section id="overview">
                <h2>1. Agreement and service description</h2>
                <p>
                    These Terms of Service (&quot;Terms&quot;) are an agreement between you and
                    Scroll Maestro (&quot;Scroll Maestro,&quot; &quot;we,&quot; or &quot;us&quot;).
                    By creating an account or using the service, you agree to these Terms. If you
                    do not agree, do not use Scroll Maestro.
                </p>
                <p>
                    Scroll Maestro is a video processing and content automation platform. It can
                    accept your source videos, use automated processing and artificial intelligence
                    to create clips and captions, and send content to social media accounts that
                    you connect and authorize.
                </p>
            </section>

            <section>
                <h2>2. Accounts and security</h2>
                <ul>
                    <li>You must provide accurate account information and keep it current.</li>
                    <li>
                        You are responsible for your password, authentication methods, and all
                        activity under your account.
                    </li>
                    <li>
                        Notify us promptly at{" "}
                        <a href="mailto:support@scrollmaestro.app">support@scrollmaestro.app</a>{" "}
                        if you believe your account or connected credentials were compromised.
                    </li>
                    <li>
                        You may not sell, share, transfer, or let another person use your account
                        in a way that violates these Terms.
                    </li>
                </ul>
            </section>

            <section>
                <h2>3. Acceptable use and content rules</h2>
                <p>You may use Scroll Maestro only for lawful purposes. You must not:</p>
                <ul>
                    <li>
                        upload or distribute content that infringes copyright, trademark,
                        publicity, privacy, or other rights;
                    </li>
                    <li>
                        upload illegal, fraudulent, defamatory, exploitative, hateful, or
                        sexually exploitative content, or content that promotes violence;
                    </li>
                    <li>
                        upload malware, corrupted files, or material designed to disrupt our
                        systems, queues, storage, or third-party services;
                    </li>
                    <li>
                        use automated requests to abuse the processing queue, evade limits, or
                        interfere with another user&apos;s service;
                    </li>
                    <li>
                        attempt to reverse engineer, probe, bypass access controls, or access
                        accounts, APIs, or data without authorization; or
                    </li>
                    <li>
                        use generated clips, captions, or scheduled posts to mislead, impersonate,
                        harass, or violate a platform&apos;s rules.
                    </li>
                </ul>
                <p>
                    We may remove content, pause processing, cancel queued jobs, or suspend an
                    account when reasonably necessary to protect users, our systems, or third
                    parties, or to comply with law.
                </p>
            </section>

            <section>
                <h2>4. Your content and our limited license</h2>
                <p>
                    You retain ownership of the videos, audio, text, captions, and other material
                    you submit (&quot;Your Content&quot;). You are responsible for obtaining all
                    permissions, releases, and licenses needed to upload and publish Your Content.
                </p>
                <p>
                    You grant Scroll Maestro a non-exclusive, worldwide, limited, royalty-free
                    license to host, copy, transmit, analyze, modify, transcode, create requested
                    derivatives, and otherwise process Your Content only as needed to provide,
                    secure, maintain, and improve the service for you. This includes transmitting
                    content to a social platform you select for a scheduled or immediate
                    publication. This license ends when Your Content is deleted, except where
                    retention is required by law or needed for legitimate security, backup, or
                    dispute-resolution purposes.
                </p>
                <p>
                    We do not claim ownership of Your Content and do not sell it as an advertising
                    asset. You grant us no broader license than the one described here.
                </p>
            </section>

            <section>
                <h2>5. AI processing and output</h2>
                <p>
                    Automated processing can produce inaccurate transcripts, clips, captions,
                    titles, or descriptions. You are responsible for reviewing all output before
                    publishing it, including factual claims, names, subtitles, and rights
                    clearances. Scroll Maestro does not guarantee that generated output is
                    original, accurate, suitable, or available for a particular purpose.
                </p>
            </section>

            <section>
                <h2>6. Connected platforms and publishing</h2>
                <p>
                    Connecting YouTube, TikTok, or another supported platform authorizes Scroll
                    Maestro to use the permissions you approve to perform the publishing actions
                    you request. You must comply with the applicable platform terms, community
                    guidelines, advertising rules, copyright policies, and developer policies,
                    including the{" "}
                    <a
                        href="https://www.youtube.com/t/terms"
                        target="_blank"
                        rel="noreferrer"
                    >
                        YouTube Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                        href="https://www.tiktok.com/legal/terms-of-service"
                        target="_blank"
                        rel="noreferrer"
                    >
                        TikTok Terms of Service
                    </a>
                    .
                </p>
                <p>
                    Third-party platforms control their own APIs and decisions. We are not
                    responsible for account bans, content removal, rejected videos, API quota
                    limits, changing requirements, delays, or outages caused by a connected
                    platform. You can disconnect an integration from Scroll Maestro, and you
                    should also revoke access directly with the platform when appropriate.
                </p>
            </section>

            <section>
                <h2>7. Fees, limits, and queue operation</h2>
                <p>
                    Any credits, limits, or paid features shown in the product apply as described
                    at the time of use. Processing jobs may be delayed, retried, reordered, or
                    fail because of capacity, file characteristics, third-party dependencies, or
                    other technical conditions. Do not rely on a queued job as your only copy of
                    important content.
                </p>
            </section>

            <section>
                <h2>8. Disclaimer and limitation of liability</h2>
                <p className="uppercase">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCROLL MAESTRO IS PROVIDED
                    &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
                    KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE UNINTERRUPTED, SECURE, OR
                    ERROR-FREE OPERATION, PARTICULAR PROCESSING RESULTS, PRESERVATION OF
                    CONTENT, OR AVAILABILITY OF ANY API, STORAGE PROVIDER, QUEUE, OR SOCIAL
                    PLATFORM.
                </p>
                <p>
                    To the maximum extent permitted by law, Scroll Maestro and its providers will
                    not be liable for indirect, incidental, special, consequential, exemplary, or
                    punitive damages, or for lost profits, revenue, data, goodwill, or
                    opportunities. This includes losses arising from video processing failures,
                    caption or transcription errors, missed schedules, API downtime, account
                    restrictions, or rejected publications. Our total liability for claims
                    relating to the service will not exceed the amount you paid us for the
                    service in the three months before the event giving rise to the claim, or
                    $100 if you paid nothing, except where applicable law does not allow that
                    limitation.
                </p>
            </section>

            <section>
                <h2>9. Suspension, termination, and changes</h2>
                <p>
                    You may stop using the service at any time. We may suspend or terminate access
                    for a material breach, unlawful activity, security risk, or discontinuation of
                    the service. Sections concerning content rights, disclaimers, limitations,
                    disputes, and any terms that by their nature should survive will continue
                    after termination.
                </p>
                <p>
                    We may update these Terms by posting a revised version and changing the
                    effective date. If a change materially affects your rights, we will provide
                    reasonable notice where required by law. Your continued use after the
                    effective date means you accept the revised Terms.
                </p>
            </section>

            <section>
                <h2>10. General terms</h2>
                <p>
                    These Terms are governed by the laws of the jurisdiction where Scroll Maestro
                    is established, without regard to conflict-of-law rules. Courts located in
                    that jurisdiction will have exclusive authority over disputes, unless
                    applicable law requires otherwise. If any provision is unenforceable, the
                    remaining provisions remain in effect. These Terms, together with the Privacy
                    Policy, are the entire agreement about the service.
                </p>
            </section>

            <section id="contact">
                <h2>11. Contact</h2>
                <p>
                    Questions about these Terms can be sent to{" "}
                    <a href="mailto:legal@scrollmaestro.app">legal@scrollmaestro.app</a>.
                </p>
            </section>
        </LegalPageShell>
    );
}
