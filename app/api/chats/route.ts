import { NextResponse } from "next/server";
import { getChatsByUserId } from "@/db/queries";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      // Return an empty list for unauthenticated users to avoid client errors
      return NextResponse.json([]);
    }
    const chats = await getChatsByUserId({ id: session.user.id });
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats: ", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
