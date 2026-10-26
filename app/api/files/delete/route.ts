import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { deleteUploads } from "@/lib/db/queries";
import { deleteFilesFromUploadThing } from "@/lib/uploadthing/utils";

const deleteRequestBodySchema = z.object({ url: z.string().url() });

export async function DELETE(req: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = deleteRequestBodySchema.safeParse(
      await req.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Send the url of the file to delete." },
        { status: 400 }
      );
    }

    const fileKeys = await deleteUploads({
      userId: session.user.id,
      urls: [parsed.data.url],
    });

    if (fileKeys.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { success, failed } = await deleteFilesFromUploadThing(fileKeys);

    return NextResponse.json({ ok: true, deleted: success, failed });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
