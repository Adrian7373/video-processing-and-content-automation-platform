import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Acceptable Use Policy",
    description: "What you may and may not do with Scroll Maestro.",
};

const TOC = [
    { id: "rules", label: "The rules" },
    { id: "content", label: "Content you may not upload" },
    { id: "conduct", label: "Conduct" },
    { id: "enforcement", label: "Enforcement" },
    { id: "report", label: "Reporting" },
] as const;

export default function AcceptableUsePage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Acceptable Use Policy"
            description="The limits on what you can upload, process, and publish with Scroll Maestro. They are part of our Terms of Service."
            toc={TOC}
        >
            <section id="rules">
                <h2>1. The basics</h2>
                <p>
                    Use {LEGAL.productName} lawfully and respectfully. You are responsible for Your Content
                    and for what you publish to YouTube, TikTok, or any other connected platform.
                </p>
            </section>

            <section id="content">
                <h2>2. Content you may not upload or publish</h2>
                <ul>
                    <li>Content you do not have the right to use: pirated films, shows, music, or other people&apos;s videos without permission. See our <a href="/copyright">Copyright and Takedown Policy</a>.</li>
                    <li>Any sexual content involving minors, or content that exploits or endangers children, which is a serious crime in the Philippines (including under RA 9775 and RA 11930). We will report it to the authorities.</li>
                    <li>Intimate images or videos of a person made or shared without their consent (RA 9995, the Anti-Photo and Video Voyeurism Act), and gender-based online harassment (RA 11313, the Safe Spaces Act).</li>
                    <li>Content that is defamatory, harasses or threatens people, promotes violence or terrorism, or incites hatred against a person or group.</li>
                    <li>Scams, fraud, phishing, fake giveaways, or impersonation of a person, brand, or government agency, including deceptive deepfakes.</li>
                    <li>Other people&apos;s personal data, such as private videos or documents, shared without a lawful basis or consent.</li>
                    <li>Content that is illegal in the Philippines, or that violates the rules of the platform you publish to.</li>
                    <li>Malware, or files designed to damage or overload our systems.</li>
                </ul>
            </section>

            <section id="conduct">
                <h2>3. Conduct</h2>
                <ul>
                    <li>Do not bypass upload, credit, or rate limits, or use bots to flood the queue.</li>
                    <li>Do not probe, scrape, reverse engineer, or try to access accounts, data, or systems that are not yours.</li>
                    <li>Do not create multiple accounts to farm free credits.</li>
                    <li>Do not use the Service to mislead audiences about who made or said something, or to spam platforms with repetitive or low-value posts.</li>
                    <li>Do not resell or give others access to the Service except as we allow.</li>
                </ul>
            </section>

            <section id="enforcement">
                <h2>4. Enforcement</h2>
                <p>
                    We may remove content, cancel jobs, suspend or close accounts, and cooperate with law
                    enforcement when we reasonably believe this policy or the law has been broken. Where
                    possible we will tell you why first. Credits on a suspended account may be forfeited
                    if the suspension was for abuse.
                </p>
            </section>

            <section id="report">
                <h2>5. Reporting a problem</h2>
                <p>
                    To report content or behavior that breaks this policy, email{" "}
                    <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> with the link or video
                    title and what is wrong. For copyright, use the process in our{" "}
                    <a href="/copyright">Copyright and Takedown Policy</a>.
                </p>
            </section>
        </LegalPageShell>
    );
}
