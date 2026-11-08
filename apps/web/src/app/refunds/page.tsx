import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Credits and Refund Policy",
    description: "How credits work and when they are refunded.",
};

const TOC = [
    { id: "credits", label: "How credits work" },
    { id: "refunds", label: "Automatic refunds" },
    { id: "paid", label: "Paid plans" },
    { id: "request", label: "Ask for a refund" },
] as const;

export default function RefundsPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Credits and Refund Policy"
            description="How credits are used, when we return them, and how paid purchases are handled."
            toc={TOC}
        >
            <section id="credits">
                <h2>1. How credits work</h2>
                <ul>
                    <li>Every new account gets free credits. Processing a video uses credits as shown in the app before you start.</li>
                    <li>Retrying a video that failed uses a credit, like a first run.</li>
                    <li>Free credits have no cash value, cannot be transferred or exchanged for money, and we may change how many new accounts receive.</li>
                </ul>
            </section>

            <section id="refunds">
                <h2>2. Automatic refunds</h2>
                <p>
                    If processing fails on our side or for a reason you could not control, such as a
                    system error or a file we cannot read, the credit is returned to your balance
                    automatically and recorded in your credit history. You do not need to ask.
                </p>
                <p>
                    Credits are not returned when processing succeeds, even if you are unhappy with the
                    clips the automated tools chose, or when a connected platform later rejects or removes
                    a post. Re-running a video uses a new credit.
                </p>
            </section>

            <section id="paid">
                <h2>3. Paid plans and credit packs</h2>
                <p>
                    If and when we sell credits or subscriptions, the price, taxes (including VAT where it
                    applies), what you get, and the billing period will be shown before you pay. Unused
                    paid credits can be refunded within 7 days of purchase if you have not used any of them.
                    Subscriptions renew only if we clearly told you so, and you can cancel before the next
                    renewal. If we cannot deliver what you paid for, we will refund you.
                </p>
                <p>
                    Nothing in this policy takes away the rights you have as a consumer under the Consumer
                    Act of the Philippines (RA 7394), the Internet Transactions Act (RA 11967), or the Civil
                    Code.
                </p>
            </section>

            <section id="request">
                <h2>4. Asking for a refund</h2>
                <p>
                    Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> from your account
                    email with the video or purchase involved and what went wrong. We aim to reply within 5
                    business days, and refunds go back to the original payment method.
                </p>
            </section>
        </LegalPageShell>
    );
}
