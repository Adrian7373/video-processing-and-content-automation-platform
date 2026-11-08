import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Copyright and Takedown Policy",
    description: "How to report copyright infringement on Scroll Maestro.",
};

const TOC = [
    { id: "policy", label: "Our policy" },
    { id: "notice", label: "Sending a notice" },
    { id: "counter", label: "Counter-notice" },
    { id: "repeat", label: "Repeat infringers" },
] as const;

export default function CopyrightPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Copyright and Takedown Policy"
            description="We respect intellectual property rights under the Intellectual Property Code of the Philippines (RA 8293, as amended). Here is how to report a problem."
            toc={TOC}
        >
            <section id="policy">
                <h2>1. Our policy</h2>
                <p>
                    Users may only upload content they own or have permission to use. We do not review every
                    upload in advance, but we act quickly on valid reports by removing or disabling access
                    to the content we host, and we may suspend the account that uploaded it. We cannot remove
                    a post already published on YouTube or TikTok; contact that platform for that.
                </p>
            </section>

            <section id="notice">
                <h2>2. Sending a notice</h2>
                <p>
                    Email <a href={`mailto:${LEGAL.copyrightEmail}`}>{LEGAL.copyrightEmail}</a> with:
                </p>
                <ul>
                    <li>your name, address, phone number, and email;</li>
                    <li>a description of the copyrighted work you say was infringed, and where we can see it;</li>
                    <li>the link, video title, or other detail that lets us find the infringing content on {LEGAL.productName};</li>
                    <li>a statement that you have a good-faith belief the use is not authorized by the owner, its agent, or the law;</li>
                    <li>a statement, made under penalty of perjury, that the information is accurate and that you are the owner or authorized to act for the owner; and</li>
                    <li>your physical or electronic signature.</li>
                </ul>
                <p>
                    Sending a knowingly false notice can make you liable for damages. We will tell the
                    uploader about the notice and may share it with them.
                </p>
            </section>

            <section id="counter">
                <h2>3. Counter-notice</h2>
                <p>
                    If your content was removed and you believe that was a mistake, or you have permission
                    or a legal right to use it, email{" "}
                    <a href={`mailto:${LEGAL.copyrightEmail}`}>{LEGAL.copyrightEmail}</a> with the same
                    details and a statement explaining why. If the original complainant does not tell us
                    they have started legal action within 14 days, we may restore the content.
                </p>
            </section>

            <section id="repeat">
                <h2>4. Repeat infringers</h2>
                <p>
                    We will close the accounts of users who are repeatedly the subject of valid copyright
                    notices.
                </p>
            </section>
        </LegalPageShell>
    );
}
