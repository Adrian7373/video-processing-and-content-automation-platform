import type { Metadata } from "next";
import LegalPageShell from "../components/LegalPageShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
    title: "Cookie Policy",
    description: "The cookies and browser storage Scroll Maestro uses.",
};

const TOC = [
    { id: "what", label: "What we use" },
    { id: "list", label: "The list" },
    { id: "third-parties", label: "Third parties" },
    { id: "control", label: "Your choices" },
] as const;

const COOKIES = [
    ["authjs.session-token (and __Secure- prefix)", "Keeps you signed in", "Essential", "30 days"],
    ["authjs.csrf-token, authjs.callback-url", "Protects sign-in from forged requests and remembers where to return", "Essential", "Session"],
    ["vr_guest_user_id", "Links the uploads you make before you create an account, so you do not lose them when you sign up", "Essential", "30 days"],
    ["vr_oauth_state, vr_oauth_return_to, vr_oauth_pkce", "Secure the YouTube and TikTok connection flow", "Essential", "10 minutes"],
    ["vr_terms_accepted", "Carries your sign-up consent through the Google sign-in redirect so we can record it", "Essential", "10 minutes"],
    ["sm-theme (browser storage)", "Remembers your light, dark, or auto theme", "Preference", "Until you clear it"],
] as const;

export default function CookiePolicyPage() {
    return (
        <LegalPageShell
            eyebrow="Legal"
            title="Cookie Policy"
            description="Which cookies and similar storage we use, and what they do."
            toc={TOC}
        >
            <section id="what">
                <h2>1. What we use</h2>
                <p>
                    Cookies are small files a website stores in your browser. {LEGAL.productName} uses only
                    the cookies and browser storage it needs to work, and one to remember your theme. We
                    do <strong>not</strong> use advertising cookies, and we do not run third-party analytics
                    or tracking tools. Because every item below is strictly needed to give you the service
                    you asked for, or is a setting you chose, we do not show a cookie banner. Any personal
                    data in these cookies is handled under our <a href="/privacy">Privacy Policy</a>.
                </p>
            </section>

            <section id="list">
                <h2>2. The list</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                    <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                        <thead className="bg-surface text-ink">
                            <tr>
                                <th className="px-3 py-2.5 font-medium">Name</th>
                                <th className="px-3 py-2.5 font-medium">Purpose</th>
                                <th className="px-3 py-2.5 font-medium">Type</th>
                                <th className="px-3 py-2.5 font-medium">Lasts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line text-muted">
                            {COOKIES.map(([name, purpose, type, lasts]) => (
                                <tr key={name}>
                                    <td className="px-3 py-2.5 align-top text-ink">{name}</td>
                                    <td className="px-3 py-2.5 align-top">{purpose}</td>
                                    <td className="px-3 py-2.5 align-top">{type}</td>
                                    <td className="px-3 py-2.5 align-top">{lasts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="third-parties">
                <h2>3. Third parties</h2>
                <p>
                    When you sign in with Google, or connect YouTube or TikTok, you are sent to that
                    company&apos;s website, which sets its own cookies under its own policy. We do not
                    control them.
                </p>
            </section>

            <section id="control">
                <h2>4. Your choices</h2>
                <p>
                    You can delete or block cookies in your browser settings. If you block the essential
                    ones you will not be able to sign in or connect accounts. Questions:{" "}
                    <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
                </p>
            </section>
        </LegalPageShell>
    );
}
