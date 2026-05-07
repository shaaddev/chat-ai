import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import {
  deleteFilesFromUploadThing,
  extractFileKey,
} from "@/lib/uploadthing/utils";

export async function DELETE(req: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = (await req.json()) as { url?: string };

    if (!url) {
      return NextResponse.json({ error: "Missing file url" }, { status: 400 });
    }

    const fileKey = extractFileKey(url);

    if (!fileKey) {
      return NextResponse.json({ error: "Invalid file url" }, { status: 400 });
    }

    const { success, failed } = await deleteFilesFromUploadThing([fileKey]);

    return NextResponse.json({ ok: true, deleted: success, failed });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
