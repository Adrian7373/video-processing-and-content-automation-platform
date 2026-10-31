import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    prisma,
    SocialPlatform,
} from "../../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";
import {
    OAUTH_RETURN_COOKIE,
    OAUTH_STATE_COOKIE,
} from "../connect/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ platform: string }> };

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
}

interface YouTubeChannelsResponse {
    items?: Array<{
        id: string;
        snippet?: {
            title?: string;
            customUrl?: string;
        };
    }>;
}

function getBaseUrl(request: Request): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request, context: RouteContext) {
    const { platform } = await context.params;
    const normalizedPlatform = platform.toLowerCase();
    const requestUrl = new URL(request.url);
    const baseUrl = getBaseUrl(request);

    const cookieStore = await cookies();
    const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    const returnTo = cookieStore.get(OAUTH_RETURN_COOKIE)?.value || "/channels";

    cookieStore.delete(OAUTH_STATE_COOKIE);
    cookieStore.delete(OAUTH_RETURN_COOKIE);

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                `Authorization cancelled or denied: ${oauthError}`,
            )}`,
        );
    }

    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");

    if (!code || !storedState || returnedState !== storedState) {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                "Invalid OAuth state or missing authorization code. Please try again.",
            )}`,
        );
    }

    if (normalizedPlatform !== "youtube") {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                `Unsupported OAuth callback for "${platform}".`,
            )}`,
        );
    }

    const clientId =
        process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
        process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                "Missing Google/YouTube OAuth client credentials on server.",
            )}`,
        );
    }

    try {
        const actor = await getOrCreateActor();
        const redirectUri = `${baseUrl}/api/integrations/youtube/callback`;

        // 1. Exchange authorization code for access + refresh tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            console.error("YouTube token exchange failed:", errorBody);
            throw new Error("Failed to exchange authorization code with Google.");
        }

        const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

        // 2. Fetch the user's YouTube channel metadata
        const channelResponse = await fetch(
            "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                },
            },
        );

        if (!channelResponse.ok) {
            const errorBody = await channelResponse.text();
            console.error("YouTube channel lookup failed:", errorBody);
            throw new Error(
                "Unable to fetch YouTube channel profile. Ensure YouTube Data API v3 is enabled in Google Cloud Console.",
            );
        }

        const channelData =
            (await channelResponse.json()) as YouTubeChannelsResponse;
        const primaryChannel = channelData.items?.[0];

        if (!primaryChannel?.id) {
            return NextResponse.redirect(
                `${baseUrl}/channels?error=${encodeURIComponent(
                    "No YouTube channel was found on this Google account. Create a YouTube channel first and retry.",
                )}`,
            );
        }

        const channelTitle =
            primaryChannel.snippet?.title ||
            primaryChannel.snippet?.customUrl ||
            "YouTube Shorts Channel";

        const tokenExpiresAt = new Date(
            Date.now() + Math.max(60, tokenData.expires_in) * 1000,
        );

        // 3. Upsert into Prisma SocialAccount
        await prisma.socialAccount.upsert({
            where: {
                userId_platform_platformAccountId: {
                    userId: actor.userId,
                    platform: SocialPlatform.YOUTUBE_SHORTS,
                    platformAccountId: primaryChannel.id,
                },
            },
            update: {
                accountName: channelTitle,
                accessToken: tokenData.access_token,
                ...(tokenData.refresh_token
                    ? { refreshToken: tokenData.refresh_token }
                    : {}),
                tokenExpiresAt,
            },
            create: {
                userId: actor.userId,
                platform: SocialPlatform.YOUTUBE_SHORTS,
                accountName: channelTitle,
                platformAccountId: primaryChannel.id,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token ?? null,
                tokenExpiresAt,
            },
        });

        const destination = returnTo.startsWith("/") ? returnTo : "/channels";
        const separator = destination.includes("?") ? "&" : "?";

        return NextResponse.redirect(
            `${baseUrl}${destination}${separator}connected=youtube`,
        );
    } catch (error) {
        console.error("YouTube OAuth callback error:", error);
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                error instanceof Error
                    ? error.message
                    : "Failed to connect YouTube channel.",
            )}`,
        );
    }
}