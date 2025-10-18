import { NextResponse } from "next/server";
import { getChatsByUserId } from "@/db/queries";
import { auth } from "@/app/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
