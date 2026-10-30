import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma, CreditReason } from "@/../../packages/database/index";

export const GUEST_COOKIE_NAME = "vr_guest_user_id";
export const INITIAL_TRIAL_CREDITS = 3;
export const INITIAL_AUTH_CREDITS = 10;

export interface ResolvedActor {
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    credits: number;
    isAnonymous: boolean;
}

const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves the current authenticated user OR provisions an anonymous trial user
 * backed by an HTTP-only cookie. Safe to call in Route Handlers and Server Actions.
 */
export async function getOrCreateActor(): Promise<ResolvedActor> {
    const session = await auth();

    // 1. Authenticated NextAuth User
    if (session?.user?.id && uuidRegex.test(session.user.id)) {
        const existingUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                credits: true,
                isAnonymous: true,
            },
        });

        if (existingUser) {
            return {
                userId: existingUser.id,
                name: existingUser.name,
                email: existingUser.email,
                image: existingUser.image,
                credits: existingUser.credits,
                isAnonymous: existingUser.isAnonymous,
            };
        }
    }

    // 2. Anonymous Trial User via HTTP-Only Cookie
    const cookieStore = await cookies();
    const guestCookieId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

    if (guestCookieId && uuidRegex.test(guestCookieId)) {
        const guestUser = await prisma.user.findUnique({
            where: { id: guestCookieId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                credits: true,
                isAnonymous: true,
            },
        });

        if (guestUser) {
            return {
                userId: guestUser.id,
                name: guestUser.name,
                email: guestUser.email,
                image: guestUser.image,
                credits: guestUser.credits,
                isAnonymous: guestUser.isAnonymous,
            };
        }
    }

    // 3. Provision a fresh Anonymous Trial User (3 trial credits)
    const createdGuest = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                name: "Guest Creator",
                isAnonymous: true,
                credits: INITIAL_TRIAL_CREDITS,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                credits: true,
                isAnonymous: true,
            },
        });

        await tx.creditTransaction.create({
            data: {
                userId: user.id,
                amount: INITIAL_TRIAL_CREDITS,
                reason: CreditReason.TRIAL_GRANT,
            },
        });

        return user;
    });

    cookieStore.set(GUEST_COOKIE_NAME, createdGuest.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return {
        userId: createdGuest.id,
        name: createdGuest.name,
        email: createdGuest.email,
        image: createdGuest.image,
        credits: createdGuest.credits,
        isAnonymous: createdGuest.isAnonymous,
    };
}

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            credits: number;
            isAnonymous: boolean;
        } & DefaultSession["user"];
    }
}

const credentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

/**
 * Transfers any videos & social accounts created during an anonymous trial session
 * to the newly authenticated user account.
 */
export async function mergeGuestIntoUser(guestUserId: string, targetUserId: string) {
    if (!guestUserId || guestUserId === targetUserId) return;

    try {
        const guest = await prisma.user.findUnique({
            where: { id: guestUserId },
            select: { id: true, isAnonymous: true },
        });

        if (!guest || !guest.isAnonymous) return;

        await prisma.$transaction(async (tx) => {
            await tx.video.updateMany({
                where: { userId: guestUserId },
                data: { userId: targetUserId },
            });

            // Move non-conflicting social accounts
            const guestAccounts = await tx.socialAccount.findMany({
                where: { userId: guestUserId },
            });

            for (const acc of guestAccounts) {
                const exists = await tx.socialAccount.findUnique({
                    where: {
                        userId_platform_platformAccountId: {
                            userId: targetUserId,
                            platform: acc.platform,
                            platformAccountId: acc.platformAccountId,
                        },
                    },
                });
                if (!exists) {
                    await tx.socialAccount.update({
                        where: { id: acc.id },
                        data: { userId: targetUserId },
                    });
                }
            }

            await tx.user.delete({
                where: { id: guestUserId },
            });
        });
    } catch (error) {
        console.error("Failed to merge guest session into authenticated user:", error);
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            allowDangerousEmailAccountLinking: true,
        }),
        Credentials({
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(rawCredentials) {
                const parsed = credentialsSchema.safeParse(rawCredentials);
                if (!parsed.success) return null;

                const email = parsed.data.email.toLowerCase().trim();
                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.passwordHash) return null;

                const isValid = await bcrypt.compare(
                    parsed.data.password,
                    user.passwordHash,
                );
                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                };
            },
        }),
    ],
    events: {
        async createUser({ user }) {
            if (!user.id) return;
            await prisma.creditTransaction.create({
                data: {
                    userId: user.id,
                    amount: INITIAL_AUTH_CREDITS,
                    reason: CreditReason.SIGNUP_BONUS,
                },
            });
        },
        async signIn({ user }) {
            if (!user.id) return;
            try {
                const cookieStore = await cookies();
                const guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;
                if (guestId && guestId !== user.id) {
                    await mergeGuestIntoUser(guestId, user.id);
                    cookieStore.delete(GUEST_COOKIE_NAME);
                }
            } catch {
                // Ignore if cookies() is called outside request context
            }
        },
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user?.id) {
                token.sub = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;

                const dbUser = await prisma.user.findUnique({
                    where: { id: token.sub },
                    select: { credits: true, isAnonymous: true, name: true, image: true },
                });

                session.user.credits = dbUser?.credits ?? 0;
                session.user.isAnonymous = dbUser?.isAnonymous ?? false;
                if (dbUser?.name) session.user.name = dbUser.name;
                if (dbUser?.image) session.user.image = dbUser.image;
            }
            return session;
        },
    },
});