import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "The terms that govern use of Scroll Maestro.",
};

const TOC = [
    { id: "agreement", label: "Agreement" },
    { id: "accounts", label: "Accounts" },
    { id: "your-content", label: "Your content" },
    { id: "ai-output", label: "AI output" },
    { id: "platforms", label: "Connected platforms" },
    { id: "credits", label: "Credits and fees" },
    { id: "prohibited", label: "What you may not do" },
    { id: "disclaimers", label: "Disclaimers and liability" },
    { id: "termination", label: "Suspension and termination" },
    { id: "law", label: "Governing law" },
    { id: "contact", label: "Contact" },
] as const;

export default function TermsPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Terms of Service"
            description="The rules for using Scroll Maestro to turn long videos into short clips and publish them. Please read them before you create an account."
            toc={TOC}
        >
            <section id="agreement">
                <h2>1. Agreement</h2>
                <p>
                    These Terms are a contract between you and <strong>{LEGAL.operatorName}</strong>, of{" "}
                    {LEGAL.address} (&quot;we,&quot; &quot;us&quot;), for your use of {LEGAL.productName} (the
                    &quot;Service&quot;). You accept them by ticking the box at sign-up or by using the
                    Service. This is an electronic contract and is valid under the Electronic Commerce Act
                    (Republic Act No. 8792).
                </p>
                <p>
                    These Terms include our <a href="/privacy">Privacy Policy</a>,{" "}
                    <a href="/cookies">Cookie Policy</a>, <a href="/acceptable-use">Acceptable Use Policy</a>,{" "}
                    <a href="/refunds">Credits and Refund Policy</a>, and{" "}
                    <a href="/copyright">Copyright and Takedown Policy</a>. If you do not agree, do not use
                    the Service.
                </p>
                <p>
                    The Service turns your long videos into short clips with captions using automated
                    tools, and can publish or schedule them to YouTube and TikTok accounts you connect.
                </p>
            </section>

            <section id="accounts">
                <h2>2. Accounts</h2>
                <ul>
                    <li>You must be at least {LEGAL.minimumAge} years old and able to enter a binding contract. If you sign up for a business, you confirm you can bind it.</li>
                    <li>Give accurate information and keep it up to date.</li>
                    <li>You are responsible for your password and for everything done under your account. Tell us right away at <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> if you suspect someone else has access.</li>
                    <li>One person or business per account. Do not sell, share, or transfer it.</li>
                </ul>
            </section>

            <section id="your-content">
                <h2>3. Your content</h2>
                <p>
                    You own your videos and the other material you upload (&quot;Your Content&quot;). We
                    do not claim ownership of it. You are responsible for it, and you promise that you own it
                    or have every right, license, release, and consent needed to upload it, have us process
                    it, and publish it, including consent from people who appear in it or whose personal
                    data it contains, and from parents or guardians for minors.
                </p>
                <p>
                    You give us a limited, non-exclusive, worldwide, royalty-free license to store, copy,
                    transcribe, analyze, edit, caption, and transmit Your Content, including to the
                    platforms you choose, only so far as needed to provide and secure the Service for you.
                    The license ends when Your Content is deleted, except for copies we must keep by law or
                    that remain briefly in backups.
                </p>
                <p>
                    The clips, captions, and text generated from Your Content are yours to use, subject to
                    the rights of anyone whose material is in your source video.
                </p>
            </section>

            <section id="ai-output">
                <h2>4. AI output</h2>
                <p>
                    Transcripts, clip selections, captions, titles, and descriptions are produced by
                    automated tools and can be wrong, incomplete, or unsuitable. You must review everything
                    before you publish it. You are responsible for what you publish, including factual
                    claims and rights clearances. We do not guarantee that output is accurate, original, or
                    will perform in any way.
                </p>
            </section>

            <section id="platforms">
                <h2>5. Connected platforms</h2>
                <p>
                    When you connect YouTube or TikTok, you authorize us to use the permissions you approve
                    to publish what you ask us to publish. You must follow each platform&apos;s own terms
                    and rules, including the{" "}
                    <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>,
                    the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>, and the{" "}
                    <a href="https://www.tiktok.com/legal/terms-of-service" target="_blank" rel="noreferrer">TikTok Terms of Service</a>.
                    By using the YouTube connection you also agree to be bound by the YouTube Terms of
                    Service.
                </p>
                <p>
                    Platforms control their own accounts and APIs. We are not responsible for a platform
                    rejecting, restricting, or removing a post or account, for API limits or outages, or for
                    a connection that expires or is revoked. If a connection stops working we will ask you to
                    reconnect it, and will retry affected posts once you do. You can disconnect an account
                    at any time and should also revoke our access in the platform&apos;s own settings.
                </p>
            </section>

            <section id="credits">
                <h2>6. Credits and fees</h2>
                <p>
                    The Service runs on credits. New accounts receive free credits, and processing a video
                    uses credits as shown in the app. See our <a href="/refunds">Credits and Refund Policy</a>{" "}
                    for when credits are refunded. Free credits have no cash value and cannot be sold or
                    transferred.
                </p>
                <p>
                    If we offer paid plans, we will show the price, what it includes, and whether it
                    includes taxes before you pay. Prices are in Philippine pesos unless stated otherwise,
                    and applicable taxes, including VAT where it applies, are shown or added at checkout.
                    Upload limits (currently 300 MB and 45 minutes per video) and other limits may change.
                </p>
            </section>

            <section id="prohibited">
                <h2>7. What you may not do</h2>
                <p>
                    You must follow our <a href="/acceptable-use">Acceptable Use Policy</a>. In short: no
                    unlawful content, no infringing or harmful content, no abusing the Service or other
                    people, and no using the Service to break a platform&apos;s rules or any Philippine law,
                    including the Cybercrime Prevention Act of 2012 (RA 10175).
                </p>
            </section>

            <section id="disclaimers">
                <h2>8. Disclaimers and limit of liability</h2>
                <p>
                    The Service is provided &quot;as is&quot; and &quot;as available.&quot; We do not promise
                    it will be uninterrupted, error-free, or that scheduled posts will publish at an exact
                    time, and we are not responsible for delays caused by providers or platforms. Nothing
                    in these Terms limits rights you have under the Consumer Act of the Philippines (RA
                    7394), the Internet Transactions Act (RA 11967), or other laws that cannot be waived.
                </p>
                <p>
                    To the extent the law allows, we are not liable for indirect, incidental, special, or
                    consequential losses, lost profits, lost audience, or lost data, and our total liability
                    for any claim is limited to the amount you paid us in the 12 months before the claim,
                    or PHP 5,000 if you paid nothing. This does not limit liability for fraud, gross
                    negligence, willful misconduct, or anything the law does not allow us to limit.
                </p>
                <p>
                    You agree to defend and compensate us against third-party claims, and related
                    reasonable costs, arising from Your Content or your breach of these Terms.
                </p>
            </section>

            <section id="termination">
                <h2>9. Suspension and termination</h2>
                <p>
                    You can stop using the Service and delete your account at any time (see the{" "}
                    <a href="/privacy">Privacy Policy</a>). We may suspend or end your access, remove
                    content, or cancel queued jobs if you break these Terms, create risk or legal exposure
                    for us or others, or if we have to discontinue the Service. Where reasonable, we will
                    tell you why and give you a chance to fix the problem or download your clips. Sections
                    that by nature should survive, including ownership, liability, and governing law, will
                    survive termination.
                </p>
            </section>

            <section>
                <h2>10. Changes</h2>
                <p>
                    We may update these Terms. We will post the new version with a new date and, for material
                    changes, notify you in the app or by email. If you keep using the Service after the
                    effective date, the new Terms apply; if you do not agree, you can close your account.
                </p>
            </section>

            <section id="law">
                <h2>11. Governing law and disputes</h2>
                <p>
                    These Terms are governed by the laws of the Republic of the Philippines. Please contact
                    us first so we can try to settle any dispute in good faith. If we cannot, the courts of{" "}
                    {LEGAL.venueCity}, Philippines have exclusive jurisdiction, and you and we waive any
                    other venue, except where the law gives you the right to sue where you live. If a
                    provision is found unenforceable, the rest stays in effect. These Terms are the whole
                    agreement between you and us about the Service.
                </p>
            </section>

            <section id="contact">
                <h2>12. Contact</h2>
                <p>
                    {LEGAL.operatorName}, {LEGAL.address}.{" "}
                    <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
                </p>
            </section>
        </LegalPageShell>
    );
}
