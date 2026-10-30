import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma, CreditReason } from "../../../../../../../packages/database/index";
import {
    GUEST_COOKIE_NAME,
    INITIAL_AUTH_CREDITS,
    mergeGuestIntoUser,
} from "@/lib/auth";

const registerSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
    email: z.string().trim().email("Please enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
});

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

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: parsed.error.issues[0]?.message ?? "Invalid registration details.",
            },
            { status: 400 },
        );
    }

    const email = parsed.data.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existingUser) {
        return NextResponse.json(
            { error: "An account with this email already exists." },
            { status: 409 },
        );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const cookieStore = await cookies();
    const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

    const newUser = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                name: parsed.data.name,
                email,
                passwordHash,
                isAnonymous: false,
                credits: INITIAL_AUTH_CREDITS,
            },
            select: {
                id: true,
                name: true,
                email: true,
                credits: true,
            },
        });

        await tx.creditTransaction.create({
            data: {
                userId: created.id,
                amount: INITIAL_AUTH_CREDITS,
                reason: CreditReason.SIGNUP_BONUS,
            },
        });

        return created;
    });

    if (guestUserId) {
        await mergeGuestIntoUser(guestUserId, newUser.id);
        cookieStore.delete(GUEST_COOKIE_NAME);
    }

    return NextResponse.json({ user: newUser }, { status: 201 });
}