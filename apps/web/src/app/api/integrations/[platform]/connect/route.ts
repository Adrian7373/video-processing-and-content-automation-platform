import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "vr_oauth_state";
export const OAUTH_RETURN_COOKIE = "vr_oauth_return_to";

type RouteContext = { params: Promise<{ platform: string }> };

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
    const returnTo = requestUrl.searchParams.get("returnTo") || "/channels";
    const baseUrl = getBaseUrl(request);

    // Ensure the user or anonymous actor exists before starting OAuth
    await getOrCreateActor();

    const state = crypto.randomUUID();
    const cookieStore = await cookies();

    cookieStore.set(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10, // 10 minutes
    });

    cookieStore.set(OAUTH_RETURN_COOKIE, returnTo, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10,
    });

    if (normalizedPlatform === "youtube") {
        const clientId =
            process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;

        if (!clientId) {
            return NextResponse.redirect(
                `${baseUrl}/channels?error=${encodeURIComponent(
                    "Missing YOUTUBE_CLIENT_ID or GOOGLE_CLIENT_ID in environment variables.",
                )}`,
            );
        }

        const redirectUri = `${baseUrl}/api/integrations/youtube/callback`;
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set(
            "scope",
            [
                "https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.readonly",
            ].join(" "),
        );
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("state", state);

        return NextResponse.redirect(authUrl.toString());
    }

    return NextResponse.redirect(
        `${baseUrl}/channels?error=${encodeURIComponent(
            `OAuth provider "${platform}" is not configured yet.`,
        )}`,
    );
}