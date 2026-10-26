import { after, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import {
  canReadChat,
  deleteChat,
  getChatById,
  getMessagesByChatId,
  updateChat,
} from "@/lib/db/queries";
import { deleteFilesFromUploadThing } from "@/lib/uploadthing/utils";
import { convertToUIMessages } from "@/lib/utils";
import { patchRequestBodySchema } from "./schema";

interface Params {
  params: Promise<{ id: string }>;
}

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () =>
  NextResponse.json({ error: "Chat not found" }, { status: 404 });

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const chat = await getChatById(id);

  if (!(chat && canReadChat(chat, session?.user.id))) {
    return notFound();
  }

  const messages = convertToUIMessages(await getMessagesByChatId(id));
  return NextResponse.json({ ...chat, messages });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return unauthorized();
  }

  const parsed = patchRequestBodySchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Send a title of 1 to 100 characters, a system prompt, or a pinned key of 1 to 64 letters and digits.",
      },
      { status: 400 }
    );
  }

  const updated = await updateChat({
    id,
    userId: session.user.id,
    changes: parsed.data,
  });

  return updated ? NextResponse.json({ success: true }) : notFound();
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return unauthorized();
  }

  const deleted = await deleteChat({ id, userId: session.user.id });
  if (!deleted) {
    return notFound();
  }

  const { uploadKeys } = deleted;
  if (uploadKeys.length > 0) {
    after(deleteFilesFromUploadThing(uploadKeys));
  }

  return NextResponse.json({ success: true, deletedFiles: uploadKeys.length });
}
