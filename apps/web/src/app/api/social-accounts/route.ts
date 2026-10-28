import { NextResponse } from "next/server";
import { z } from "zod";
import {
    prisma,
    SocialPlatform,
} from "../../../../../../packages/database/index";

export const dynamic = "force-dynamic";

const createSocialAccountSchema = z.object({
    userId: z.string().min(1).default("demo-user"),
    platform: z.nativeEnum(SocialPlatform),
    accountName: z.string().trim().min(1).max(120),
    platformUserId: z.string().trim().min(1).optional(),
    accessToken: z.string().trim().min(1).optional(),
    refreshToken: z.string().trim().optional().nullable(),
    tokenExpiresAt: z.string().datetime().optional().nullable(),
});

const deleteSocialAccountSchema = z.object({
    accountId: z.string().uuid(),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId")?.trim();

        const accounts = await prisma.socialAccount.findMany({
            ...(userId ? { where: { userId } } : {}),
            select: {
                id: true,
                userId: true,
                platform: true,
                accountName: true,
                platformUserId: true,
                tokenExpiresAt: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        return NextResponse.json({ accounts }, { status: 200 });
    } catch (error) {
        console.error("Failed to fetch social accounts.", error);
        return NextResponse.json(
            { error: "Unable to fetch social accounts." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    const parsed = createSocialAccountSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid social account payload.",
                issues: parsed.error.flatten(),
            },
            { status: 400 },
        );
    }

    const data = parsed.data;
    const platformAccountId =
        data.platformUserId ??
        `mock_${data.platform.toLowerCase()}_${data.userId}`;
    const accessToken =
        data.accessToken ??
        `mock_token_${data.platform.toLowerCase()}_${Date.now()}`;

    try {
        const account = await prisma.socialAccount.upsert({
            where: {
                userId_platform_platformAccountId: {
                    userId: data.userId,
                    platform: data.platform,
                    platformAccountId,
                },
            },
            update: {
                accountName: data.accountName,
                accessToken,
                refreshToken: data.refreshToken ?? null,
                tokenExpiresAt: data.tokenExpiresAt
                    ? new Date(data.tokenExpiresAt)
                    : null,
            },
            create: {
                userId: data.userId,
                platform: data.platform,
                platformAccountId,
                accountName: data.accountName,
                accessToken,
                refreshToken: data.refreshToken ?? null,
                tokenExpiresAt: data.tokenExpiresAt
                    ? new Date(data.tokenExpiresAt)
                    : null,
            },
            select: {
                id: true,
                userId: true,
                platform: true,
                accountName: true,
                platformUserId: true,
                tokenExpiresAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ account }, { status: 201 });
    } catch (error) {
        console.error("Failed to save social account.", error);
        return NextResponse.json(
            { error: "Unable to save social account." },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const queryAccountId = searchParams.get("accountId");

    let accountId: string | null = queryAccountId;
    if (!accountId) {
        try {
            const body: unknown = await request.json();
            const parsed = deleteSocialAccountSchema.safeParse(body);
            if (parsed.success) {
                accountId = parsed.data.accountId;
            }
        } catch {
            // Ignore body parse failure if neither query nor body is valid
        }
    }

    if (!accountId) {
        return NextResponse.json(
            { error: "A valid accountId is required." },
            { status: 400 },
        );
    }

    try {
        await prisma.socialAccount.delete({
            where: { id: accountId },
        });
        return NextResponse.json({ deleted: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to delete social account.", error);
        return NextResponse.json(
            { error: "Unable to delete social account." },
            { status: 500 },
        );
    }
}