import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import {
  canReadChat,
  deleteChat,
  getChatById,
  getMessagesByChatId,
  updateChat,
} from "@/lib/db/queries";
import {
  deleteFilesFromUploadThing,
  extractFileKeysFromMessages,
} from "@/lib/uploadthing/utils";
import { convertToUIMessages } from "@/lib/utils";

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

  const { systemPrompt } = (await req.json()) as { systemPrompt?: string };
  const updated = await updateChat({
    id,
    userId: session.user.id,
    changes: { systemPrompt: systemPrompt || null },
  });

  return updated ? NextResponse.json({ success: true }) : notFound();
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return unauthorized();
  }

  const messages = await deleteChat({ id, userId: session.user.id });
  if (!messages) {
    return notFound();
  }

  const fileKeys = extractFileKeysFromMessages(messages);
  if (fileKeys.length > 0) {
    deleteFilesFromUploadThing(fileKeys).catch((error) => {
      console.error("Background file deletion failed:", error);
    });
  }

  return NextResponse.json({ success: true, deletedFiles: fileKeys.length });
}
