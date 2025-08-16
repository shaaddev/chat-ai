import { NextResponse } from "next/server";
import { deleteChatById, getChatById } from "@/db/queries";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    const chat = await getChatById({ id });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to fetch chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    await deleteChatById({ id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
