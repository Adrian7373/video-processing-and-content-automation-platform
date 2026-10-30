import { NextResponse } from "next/server";
import { getOrCreateActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface CreditsStatusResponse {
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    credits: number;
    isAnonymous: boolean;
}

export async function GET() {
    try {
        const actor = await getOrCreateActor();
        return NextResponse.json<CreditsStatusResponse>(actor, { status: 200 });
    } catch (error) {
        console.error("Failed to resolve user credits.", error);
        return NextResponse.json(
            { error: "Unable to load credit balance." },
            { status: 500 },
        );
    }
}