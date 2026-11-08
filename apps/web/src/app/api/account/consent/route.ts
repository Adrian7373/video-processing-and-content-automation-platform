import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../../packages/database/index";
import { getExistingActor } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Whether the signed-in user still has to accept the current Terms and Privacy Policy. */
export async function GET() {
    const actor = await getExistingActor();
    if (!actor || actor.isAnonymous) {
        return NextResponse.json({ needsConsent: false }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { termsVersion: true, termsAcceptedAt: true },
    });

    const needsConsent =
        !user?.termsAcceptedAt || user.termsVersion !== LEGAL_VERSION;
    return NextResponse.json({ needsConsent }, { status: 200 });
}

const consentSchema = z.object({
    acceptedTerms: z.literal(true),
    acceptedPrivacy: z.literal(true),
});

/** Records acceptance of the current version. */
export async function POST(request: Request) {
    const actor = await getExistingActor();
    if (!actor || actor.isAnonymous) {
        return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const parsed = consentSchema.safeParse(
        await request.json().catch(() => null),
    );
    if (!parsed.success) {
        return NextResponse.json(
            { error: "You must accept the Terms of Service and the Privacy Policy." },
            { status: 400 },
        );
    }

    await prisma.user.update({
        where: { id: actor.userId },
        data: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION },
    });

    return NextResponse.json({ accepted: true }, { status: 200 });
}
