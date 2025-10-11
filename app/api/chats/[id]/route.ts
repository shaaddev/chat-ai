import { NextResponse } from "next/server";
import { deleteChatById, getChatById } from "@/db/queries";
import {
  extractFileKeysFromMessages,
  deleteFilesFromUploadThing,
} from "@/lib/uploadthing/utils";

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

    // Delete chat and get messages to extract file attachments
    const { messages } = await deleteChatById({ id });

    // Extract file keys from all messages
    const fileKeys = extractFileKeysFromMessages(messages);

    // Delete files from UploadThing asynchronously (don't block the response)
    if (fileKeys.length > 0) {
      // Fire and forget - delete files in the background
      deleteFilesFromUploadThing(fileKeys).catch((error) => {
        console.error("Background file deletion failed:", error);
      });

      console.log(
        `Queued ${fileKeys.length} files for deletion from UploadThing`,
      );
    }

    return NextResponse.json({
      success: true,
      deletedFiles: fileKeys.length,
    });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
