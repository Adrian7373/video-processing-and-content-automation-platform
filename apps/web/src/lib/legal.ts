/**
 * Single place for the facts the legal pages and sign-up consent depend on.
 *
 * TODO before launch: replace every value marked "REPLACE" with your real details.
 * Bump LEGAL_VERSION whenever the Terms or Privacy Policy change materially; it is stored
 * with each user's consent record.
 */
export const LEGAL_VERSION = "2026-11-08";
export const LEGAL_EFFECTIVE_DATE = "November 8, 2026";
export const LEGAL_EFFECTIVE_ISO = "2026-11-08";

export const LEGAL = {
    productName: "Scroll Maestro",
    /** REPLACE: registered business name, or your full name if you operate as a sole proprietor. */
    operatorName: "Scroll Maestro (REPLACE: registered business name)",
    /** REPLACE: registered or principal business address in the Philippines. */
    address: "REPLACE: street, barangay, city or municipality, province, Philippines",
    /** REPLACE: city whose courts hear disputes, usually where the business is based. */
    venueCity: "REPLACE: city",
    /** REPLACE: the inbox you will actually monitor. */
    supportEmail: "support@scrollmaestro.app",
    privacyEmail: "privacy@scrollmaestro.app",
    /** REPLACE: name of the designated Data Protection Officer (can be you). */
    dpoName: "REPLACE: Data Protection Officer",
    dpoEmail: "dpo@scrollmaestro.app",
    copyrightEmail: "copyright@scrollmaestro.app",
    minimumAge: 18,
} as const;

export const LEGAL_LINKS = [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/cookies", label: "Cookie Policy" },
    { href: "/acceptable-use", label: "Acceptable Use" },
    { href: "/refunds", label: "Credits and refunds" },
    { href: "/copyright", label: "Copyright and takedown" },
] as const;

/** Cookie that carries the sign-up consent through the Google OAuth redirect. */
export const TERMS_CONSENT_COOKIE = "vr_terms_accepted";
