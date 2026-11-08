import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "How Scroll Maestro collects, uses, shares, and protects personal data under the Philippine Data Privacy Act of 2012.",
};

const TOC = [
    { id: "who-we-are", label: "Who we are" },
    { id: "data-we-collect", label: "Data we collect" },
    { id: "why-we-use-it", label: "Why we use it" },
    { id: "sharing", label: "Who we share it with" },
    { id: "transfers", label: "Transfers outside the Philippines" },
    { id: "retention", label: "Retention and deletion" },
    { id: "security", label: "Security and breaches" },
    { id: "your-rights", label: "Your rights" },
    { id: "children", label: "Age limit" },
    { id: "changes", label: "Changes" },
    { id: "contact", label: "Contact and complaints" },
] as const;

export default function PrivacyPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Privacy Policy"
            description="What personal data we collect, why, who sees it, and how you can control it. This policy follows the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations."
            toc={TOC}
        >
            <section id="who-we-are">
                <h2>1. Who we are</h2>
                <p>
                    {LEGAL.productName} is operated by <strong>{LEGAL.operatorName}</strong>, located at{" "}
                    {LEGAL.address} (&quot;we,&quot; &quot;us&quot;). We are the{" "}
                    <strong>personal information controller</strong> for the personal data described in
                    this policy. You are the <strong>data subject</strong>.
                </p>
                <p>
                    Our Data Protection Officer is {LEGAL.dpoName}, reachable at{" "}
                    <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>.
                </p>
                <p>
                    By creating an account and ticking the consent box at sign-up, you consent to the
                    processing described here. Where we rely on another lawful basis, such as performing
                    our contract with you or complying with the law, we say so below.
                </p>
            </section>

            <section id="data-we-collect">
                <h2>2. Data we collect</h2>
                <h3>What you give us</h3>
                <ul>
                    <li>Account details: your name, email address, and a hashed password (we never store your password in readable form). If you sign in with Google, we receive your name, email, and profile picture from Google.</li>
                    <li>Your content: the videos and audio you upload, the transcripts, clips, captions, thumbnails, titles, and descriptions we generate from them, and any instructions you type. Videos may show or mention other people; see section 9 about your responsibilities.</li>
                    <li>Connected accounts: the account or channel name and ID of YouTube and TikTok accounts you connect, and the access and refresh tokens that let us post on your behalf.</li>
                    <li>Messages you send us for support or privacy requests.</li>
                </ul>
                <h3>What we collect automatically</h3>
                <ul>
                    <li>Session and security data: sign-in events, IP address, browser and device type, and request identifiers.</li>
                    <li>Service data: job status, errors, credit balance and credit transactions, scheduled posts and their results.</li>
                    <li>Cookies and similar storage that keep you signed in and remember your settings. See our <a href="/cookies">Cookie Policy</a>.</li>
                </ul>
                <p>
                    We do not ask for sensitive personal information (for example health, government ID
                    numbers, or financial account details). If you include such information in a video,
                    you are giving it to us voluntarily, and it is processed only to produce the clips
                    you asked for.
                </p>
            </section>

            <section id="why-we-use-it">
                <h2>3. Why we use your data</h2>
                <ul>
                    <li><strong>To provide the service you asked for.</strong> Store your uploads, transcribe the audio, pick highlights, cut and caption clips, and publish or schedule them to the accounts you connect.</li>
                    <li><strong>To run your account.</strong> Sign you in, track credits, and send service messages such as security notices and failed-publish alerts.</li>
                    <li><strong>To keep the service safe and working.</strong> Detect abuse, enforce our <a href="/acceptable-use">Acceptable Use Policy</a>, fix errors, and keep records of consent.</li>
                    <li><strong>To meet legal obligations</strong> and to establish, exercise, or defend legal claims.</li>
                </ul>
                <p>
                    We use your OAuth tokens only to perform the publishing and account actions you
                    request. We do not sell your personal data, and we do not use your videos to train
                    our own AI models. Our AI providers handle data under their own terms; see section 4. We do not send marketing emails unless you separately
                    opt in to them.
                </p>
                <p>
                    Automated tools help us choose clips and write captions. A person does not review each
                    result, so please check the output before you publish it.
                </p>
            </section>

            <section id="sharing">
                <h2>4. Who we share it with</h2>
                <p>
                    We share personal data only with service providers acting for us (personal information
                    processors) and with the platforms you choose. We require our processors to protect the
                    data and to use it only for our instructions.
                </p>
                <ul>
                    <li><strong>Amazon Web Services (S3)</strong>: stores your videos, clips, and thumbnails.</li>
                    <li><strong>Supabase</strong>: hosts our PostgreSQL database (accounts, credits, schedules).</li>
                    <li><strong>Groq</strong>: receives audio extracted from your videos to produce transcripts.</li>
                    <li><strong>Google (Gemini API)</strong>: receives transcript text to select highlight clips.</li>
                    <li><strong>Vercel</strong> and <strong>Render</strong>: host the website and our background processing.</li>
                    <li><strong>Upstash</strong>: runs the job queue (job identifiers, not your videos).</li>
                    <li><strong>Google/YouTube and TikTok</strong>: receive your clip, title, and caption when you publish, under the permissions you approve. Their own privacy policies apply to what they do with it.</li>
                </ul>
                <p>
                    We may also disclose data when a law, court order, or government authority requires it,
                    to protect rights and safety, or in a merger or sale of the business, in which case the
                    buyer must honor this policy.
                </p>
            </section>

            <section id="transfers">
                <h2>5. Transfers outside the Philippines</h2>
                <p>
                    Our providers run servers in other countries, including the United States and
                    Singapore. When your data is transferred abroad, we remain accountable for it under
                    Section 21 of the Data Privacy Act and use contracts and provider security commitments
                    to give it a comparable level of protection.
                </p>
            </section>

            <section id="retention">
                <h2>6. Retention and deletion</h2>
                <ul>
                    <li><strong>Uploaded videos and generated clips:</strong> kept until you delete them, and in any case no longer than 30 days after processing unless the product says otherwise.</li>
                    <li><strong>Account data:</strong> kept while your account is active. When you ask us to delete your account we delete or anonymize it within 30 days, except records we must keep by law.</li>
                    <li><strong>Credit and transaction records:</strong> kept for up to 5 years for accounting and dispute purposes.</li>
                    <li><strong>OAuth tokens:</strong> kept while the account is connected, and deleted when you disconnect it or delete your account. You should also remove our access in your Google or TikTok security settings.</li>
                    <li><strong>Security and operational logs:</strong> up to 12 months.</li>
                    <li><strong>Consent records:</strong> kept for as long as your account exists plus 3 years, as evidence of what you agreed to.</li>
                </ul>
                <p>
                    Backups may take up to 90 days to cycle out. To start a deletion, email{" "}
                    <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a> from your account email.
                </p>
            </section>

            <section id="security">
                <h2>7. Security and data breaches</h2>
                <p>
                    We use reasonable organizational, physical, and technical safeguards: encrypted
                    connections, hashed passwords, access controls, signed and expiring storage links, and
                    least-privilege access for staff and providers. No system is perfectly secure, so keep
                    your password private.
                </p>
                <p>
                    If a personal data breach involves information that could enable identity fraud or
                    harm you, we will notify the National Privacy Commission and the affected users within
                    72 hours of knowing of it, as the law requires, and tell you what happened and what you
                    can do.
                </p>
            </section>

            <section id="your-rights">
                <h2>8. Your rights as a data subject</h2>
                <p>Under the Data Privacy Act you have the right to:</p>
                <ul>
                    <li><strong>Be informed</strong> about how your data is processed (this policy).</li>
                    <li><strong>Object</strong> to processing, and to withdraw your consent at any time. Withdrawing does not affect processing done before, and may mean we can no longer provide the service.</li>
                    <li><strong>Access</strong> your personal data and get a copy.</li>
                    <li><strong>Rectify</strong> data that is wrong or out of date.</li>
                    <li><strong>Erasure or blocking</strong> of data that is incomplete, outdated, false, unlawfully obtained, or no longer needed.</li>
                    <li><strong>Data portability</strong>: get your data in an electronic, structured, commonly used format.</li>
                    <li><strong>Be indemnified</strong> for damages caused by inaccurate, unlawfully obtained, or unauthorized use of your data.</li>
                    <li><strong>File a complaint</strong> with the National Privacy Commission.</li>
                </ul>
                <p>
                    To use these rights, email <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>. We
                    may ask you to confirm your identity first, and we will respond within 30 days. You can
                    disconnect social accounts and delete your clips directly inside the app.
                </p>
            </section>

            <section id="children">
                <h2>9. Age limit and other people&apos;s data</h2>
                <p>
                    The service is for people aged {LEGAL.minimumAge} and over. We do not knowingly collect
                    data from minors. If you think a minor has given us data, contact us and we will delete
                    it.
                </p>
                <p>
                    If your videos show or identify other people, you are responsible for having their
                    permission to upload and publish them, and for any consent required from parents or
                    guardians for minors who appear in your content.
                </p>
            </section>

            <section id="changes">
                <h2>10. Changes to this policy</h2>
                <p>
                    When we change this policy we update the date at the top. For material changes we will
                    notify you in the app or by email, and ask for your consent again where the law
                    requires it.
                </p>
            </section>

            <section id="contact">
                <h2>11. Contact and complaints</h2>
                <p>
                    Questions or requests: <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a> or{" "}
                    <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>, or by post to{" "}
                    {LEGAL.address}.
                </p>
                <p>
                    If you are not satisfied with our response, you can complain to the{" "}
                    <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">National Privacy Commission</a>{" "}
                    (privacy.gov.ph).
                </p>
            </section>
        </LegalPageShell>
    );
}
