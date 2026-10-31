import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, SocialPlatform } from "../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ConnectedSocialAccountDTO {
    id: string;
    platform: SocialPlatform;
    accountName: string;
    platformAccountId: string;
    tokenExpiresAt: string | null;
    createdAt: string;
}

export async function GET() {
    try {
        const actor = await getOrCreateActor();

        const accounts = await prisma.socialAccount.findMany({
            where: { userId: actor.userId },
            select: {
                id: true,
                platform: true,
                accountName: true,
                platformAccountId: true,
                tokenExpiresAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const payload: ConnectedSocialAccountDTO[] = accounts.map((acc) => ({
            id: acc.id,
            platform: acc.platform,
            accountName: acc.accountName,
            platformAccountId: acc.platformAccountId,
            tokenExpiresAt: acc.tokenExpiresAt ? acc.tokenExpiresAt.toISOString() : null,
            createdAt: acc.createdAt.toISOString(),
        }));

        return NextResponse.json({ accounts: payload }, { status: 200 });
    } catch (error) {
        console.error("Failed to fetch connected social accounts.", error);
        return NextResponse.json(
            { error: "Unable to load connected social accounts." },
            { status: 500 },
        );
    }
}

const deleteAccountSchema = z.object({
    accountId: z.string().uuid(),
});

export async function DELETE(request: Request) {
    try {
        const actor = await getOrCreateActor();
        const url = new URL(request.url);
        const parsed = deleteAccountSchema.safeParse({
            accountId: url.searchParams.get("accountId"),
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: "A valid accountId query parameter is required." },
                { status: 400 },
            );
        }

        const deleted = await prisma.socialAccount.deleteMany({
            where: {
                id: parsed.data.accountId,
                userId: actor.userId,
            },
        });

        if (deleted.count === 0) {
            return NextResponse.json(
                { error: "Social account not found." },
                { status: 404 },
            );
        }

        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to disconnect social account.", error);
        return NextResponse.json(
            { error: "Unable to disconnect social account." },
            { status: 500 },
        );
    }
}