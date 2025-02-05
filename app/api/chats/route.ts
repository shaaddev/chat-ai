import { NextResponse } from "next/server";
import { getAllChats } from "@/db/queries";

export async function GET() {
  try {
    const chats = await getAllChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats: ", error);
    return NextResponse.json(
      { error: "Faield to fetch chats" },
      { status: 500 }
    );
  }
}
