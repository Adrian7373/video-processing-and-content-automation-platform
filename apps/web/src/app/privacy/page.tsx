import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";

export const metadata: Metadata = {
    title: "Privacy Policy | Scroll Maestro",
    description: "How Scroll Maestro collects, uses, shares, and protects information.",
};

export default function PrivacyPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Privacy Policy"
            description="This policy explains what Scroll Maestro collects, why we use it, and the choices available to you."
            effectiveDate="November 1, 2026"
        >
            <section id="overview">
                <h2>1. Scope and controller</h2>
                <p>
                    This Privacy Policy describes how Scroll Maestro (&quot;Scroll Maestro,&quot;
                    &quot;we,&quot; or &quot;us&quot;) handles information when you use our
                    video processing, content automation, scheduling, and publishing service.
                    Scroll Maestro is the controller or business responsible for your information
                    where applicable law uses those terms.
                </p>
                <p>
                    The service is not intended for children under 13, or a higher age where
                    required by local law. Do not use it or submit another person&apos;s
                    information without appropriate authorization.
                </p>
            </section>

            <section id="information">
                <h2>2. Information we collect</h2>
                <h3>Information you provide</h3>
                <ul>
                    <li>
                        Account details such as your name, email address, authentication
                        identifiers, and preferences.
                    </li>
                    <li>
                        Source videos, audio, transcripts, captions, thumbnails, titles,
                        descriptions, and other media or instructions you submit.
                    </li>
                    <li>
                        Connected-account information and OAuth access or refresh tokens for
                        YouTube, TikTok, and other platforms you authorize.
                    </li>
                    <li>
                        Support messages, feedback, and information you choose to include in a
                        request.
                    </li>
                </ul>
                <h3>Information collected automatically</h3>
                <ul>
                    <li>
                        Basic usage logs, such as sign-in events, job status, queue events,
                        timestamps, errors, feature usage, and device or browser information.
                    </li>
                    <li>
                        Security and diagnostic data, such as IP address, request identifiers, and
                        authentication or audit events, where needed to secure the service.
                    </li>
                </ul>
                <p>
                    We do not intentionally collect sensitive personal information unless you
                    choose to include it in content or a support request. Treat uploaded videos
                    as potentially containing personal information and obtain required consents.
                </p>
            </section>

            <section>
                <h2>3. How we use information</h2>
                <ul>
                    <li>Authenticate accounts, provide access, and prevent unauthorized use.</li>
                    <li>
                        Store source files and media assets in AWS S3 and run requested
                        transcription, AI analysis, FFmpeg clipping, formatting, and caption
                        rendering.
                    </li>
                    <li>
                        Schedule and execute publishing jobs through BullMQ and Upstash Redis,
                        using only the connected accounts and permissions you authorize.
                    </li>
                    <li>
                        Monitor reliability, troubleshoot failures, enforce limits, and protect
                        the service against fraud, abuse, and security threats.
                    </li>
                    <li>
                        Communicate with you about the service, account, security, and material
                        policy changes.
                    </li>
                    <li>
                        Comply with legal obligations and establish, exercise, or defend legal
                        claims.
                    </li>
                </ul>
                <p>
                    We use OAuth tokens only to maintain an authorized connection and perform the
                    publishing or account actions you request. We do not sell OAuth tokens or use
                    them to access unrelated information.
                </p>
            </section>

            <section>
                <h2>4. Service providers and sharing</h2>
                <p>
                    We share information with providers that process it for us under
                    confidentiality and security obligations, and with platforms you choose to
                    connect. These providers currently include:
                </p>
                <ul>
                    <li>
                        <strong>AWS S3</strong> for secure source video and media asset storage.
                    </li>
                    <li>
                        <strong>Supabase</strong> for authentication and hosted PostgreSQL
                        services, accessed through Prisma ORM.
                    </li>
                    <li>
                        <strong>Google/YouTube APIs</strong> and <strong>TikTok APIs</strong> for
                        authorized account connections and publishing.
                    </li>
                    <li>
                        <strong>Vercel</strong> for the web application and <strong>Render</strong>{" "}
                        for background processing infrastructure.
                    </li>
                    <li>
                        <strong>Upstash Redis</strong> for BullMQ queue management and scheduled
                        job coordination.
                    </li>
                </ul>
                <p>
                    We may also disclose information when required by law, to respond to lawful
                    requests, to protect rights and safety, or as part of a merger, acquisition,
                    financing, or sale of assets. We do not share uploaded media with a social
                    platform unless you request or authorize a connection or publication.
                </p>
            </section>

            <section>
                <h2>5. Security</h2>
                <p>
                    We use access controls, encrypted connections, signed storage URLs, and
                    provider security controls designed to protect information. OAuth credentials
                    are stored with restricted access and are used only for authorized
                    integrations. No service is completely secure, so keep your account
                    credentials private and notify us promptly about suspected unauthorized
                    access.
                </p>
            </section>

            <section>
                <h2>6. Retention and deletion</h2>
                <p>
                    We retain information only for as long as reasonably necessary for the
                    purposes described in this policy:
                </p>
                <ul>
                    <li>
                        Uploaded source videos and generated processing artifacts are normally
                        retained for 30 days after the related processing job completes, unless
                        you delete them sooner or the product explicitly states a different
                        period.
                    </li>
                    <li>
                        Account and billing-related records are retained while your account is
                        active and for the period needed for security, accounting, legal, or
                        dispute-resolution obligations.
                    </li>
                    <li>
                        OAuth tokens are retained while an integration is connected and are
                        deleted or invalidated when you disconnect it, when you request deletion,
                        or when they expire, subject to legally required records.
                    </li>
                    <li>
                        Operational logs are generally retained for up to 12 months, then deleted
                        or aggregated unless needed for security or legal purposes.
                    </li>
                </ul>
                <p>
                    To request account deletion, removal of uploaded content, or token revocation,
                    email{" "}
                    <a href="mailto:privacy@scrollmaestro.app">privacy@scrollmaestro.app</a>{" "}
                    from your account email. You should also revoke Scroll Maestro access in your
                    Google or TikTok account settings. Backups and legally required records may
                    take longer to cycle out.
                </p>
            </section>

            <section id="your-rights">
                <h2>7. Your privacy choices and rights</h2>
                <p>
                    Depending on where you live, you may have rights to access, correct, delete,
                    export, restrict, or object to certain processing of your information. You
                    may also withdraw consent where processing relies on consent. We may need to
                    verify your request and may retain information where the law requires or
                    permits it.
                </p>
                <p>
                    You can disconnect social accounts, delete eligible content in the product,
                    and contact us about rights requests. You may appeal a refusal by replying to
                    our response. You may also contact your local data protection authority.
                </p>
            </section>

            <section>
                <h2>8. International processing and third-party links</h2>
                <p>
                    Our providers may process information in countries other than where you live.
                    Where required, we use appropriate safeguards for cross-border transfers.
                    Connected platforms and external websites have their own privacy policies; we
                    are not responsible for their independent practices or content.
                </p>
            </section>

            <section>
                <h2>9. Changes to this policy</h2>
                <p>
                    We may update this policy as the service or legal requirements change. We will
                    post the updated version and change the effective date. If a change is
                    material, we will provide additional notice where required. Continued use
                    after the effective date means the updated policy applies.
                </p>
            </section>

            <section id="contact">
                <h2>10. Contact</h2>
                <p>
                    For privacy questions, rights requests, deletion requests, or token
                    revocation, contact{" "}
                    <a href="mailto:privacy@scrollmaestro.app">privacy@scrollmaestro.app</a>.
                    Replace this placeholder address with the designated privacy contact before
                    launch.
                </p>
            </section>
        </LegalPageShell>
    );
}
