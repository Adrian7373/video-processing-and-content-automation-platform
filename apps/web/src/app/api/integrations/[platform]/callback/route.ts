import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    prisma,
    SocialPlatform,
} from "../../../../../../../../packages/database/index";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "vr_oauth_state";
const OAUTH_RETURN_COOKIE = "vr_oauth_return_to";

function getBaseUrl(request: Request): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ platform: string }> },
) {
    const { platform } = await params;
    const requestUrl = new URL(request.url);
    const baseUrl = getBaseUrl(request);

    const cookieStore = await cookies();
    const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    const returnTo = cookieStore.get(OAUTH_RETURN_COOKIE)?.value || "/channels";

    cookieStore.delete(OAUTH_STATE_COOKIE);
    cookieStore.delete(OAUTH_RETURN_COOKIE);

    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const errorMsg =
        requestUrl.searchParams.get("error") ||
        requestUrl.searchParams.get("errTips");

    if (errorMsg) {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(errorMsg)}`,
        );
    }

    if (!code || !storedState || returnedState !== storedState) {
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                `Invalid ${platform} OAuth state or missing authorization code.`,
            )}`,
        );
    }

    try {
        const actor = await getOrCreateActor();

        // --- TIKTOK CALLBACK ---
        if (platform === "tiktok") {
            const clientKey = process.env.TIKTOK_CLIENT_KEY;
            const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

            if (!clientKey || !clientSecret) {
                throw new Error("Missing TikTok client credentials on server.");
            }

            const redirectUri = `${baseUrl}/api/integrations/tiktok/callback`;

            // 1. Exchange code for Access Token
            const tokenRes = await fetch(
                "https://open.tiktokapis.com/v2/oauth/token/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        client_key: clientKey,
                        client_secret: clientSecret,
                        code,
                        grant_type: "authorization_code",
                        redirect_uri: redirectUri,
                    }),
                },
            );

            const tokenData = await tokenRes.json();
            if (tokenData.error || !tokenData.access_token) {
                throw new Error(
                    tokenData.error_description ||
                    "Failed to exchange TikTok authorization code.",
                );
            }

            const {
                access_token,
                refresh_token,
                expires_in,
                open_id: tokenOpenId,
            } = tokenData;

            // 2. Fetch User's TikTok Handle (falls back to open_id from token response if user.info.basic isn't enabled)
            let openId = tokenOpenId as string;
            let displayName = "TikTok Creator";

            try {
                const userRes = await fetch(
                    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
                    {
                        method: "GET",
                        headers: { Authorization: `Bearer ${access_token}` },
                    },
                );
                const userData = await userRes.json();
                if (userData?.data?.user) {
                    openId = userData.data.user.open_id || openId;
                    displayName =
                        userData.data.user.display_name || displayName;
                }
            } catch {
                // Fallback to tokenOpenId and default displayName if user.info.basic is not yet granted
            }

            const expiresAt = expires_in
                ? new Date(Date.now() + Number(expires_in) * 1000)
                : null;

            await prisma.socialAccount.upsert({
                where: {
                    userId_platform_platformAccountId: {
                        userId: actor.userId,
                        platform: SocialPlatform.TIKTOK,
                        platformAccountId: openId,
                    },
                },
                update: {
                    accountName: displayName,
                    accessToken: access_token,
                    refreshToken: refresh_token ?? null,
                    tokenExpiresAt: expiresAt,
                },
                create: {
                    userId: actor.userId,
                    platform: SocialPlatform.TIKTOK,
                    accountName: displayName,
                    platformAccountId: openId,
                    accessToken: access_token,
                    refreshToken: refresh_token ?? null,
                    tokenExpiresAt: expiresAt,
                },
            });

            const destination = returnTo.startsWith("/") ? returnTo : "/channels";
            const separator = destination.includes("?") ? "&" : "?";

            return NextResponse.redirect(
                `${baseUrl}${destination}${separator}connected=tiktok`,
            );
        }

        // --- YOUTUBE CALLBACK (Keep your existing YouTube block right here) ---
        if (platform === "youtube") {
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error("Missing Google OAuth credentials on server.");
            }

            const redirectUri = `${baseUrl}/api/integrations/youtube/callback`;

            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token) {
                throw new Error(
                    tokenData.error_description ||
                    "Failed to exchange Google OAuth code.",
                );
            }

            const channelRes = await fetch(
                "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
                {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                },
            );

            const channelData = await channelRes.json();
            const primaryChannel = channelData?.items?.[0];

            if (!primaryChannel?.id) {
                throw new Error(
                    "No YouTube channel found on this Google account.",
                );
            }

            const channelTitle =
                primaryChannel.snippet?.title || "YouTube Channel";
            const expiresAt = tokenData.expires_in
                ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
                : null;

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
                    tokenExpiresAt: expiresAt,
                },
                create: {
                    userId: actor.userId,
                    platform: SocialPlatform.YOUTUBE_SHORTS,
                    accountName: channelTitle,
                    platformAccountId: primaryChannel.id,
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token ?? null,
                    tokenExpiresAt: expiresAt,
                },
            });

            const destination = returnTo.startsWith("/") ? returnTo : "/channels";
            const separator = destination.includes("?") ? "&" : "?";

            return NextResponse.redirect(
                `${baseUrl}${destination}${separator}connected=youtube`,
            );
        }

        throw new Error(`Unsupported platform: ${platform}`);
    } catch (error) {
        console.error(`${platform} OAuth callback error:`, error);
        return NextResponse.redirect(
            `${baseUrl}/channels?error=${encodeURIComponent(
                error instanceof Error
                    ? error.message
                    : `Failed to connect ${platform} account.`,
            )}`,
        );
    }
}