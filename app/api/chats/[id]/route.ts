import { NextResponse } from "next/server";
import { z } from "zod";
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

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    systemPrompt: z
      .string()
      .nullable()
      .optional()
      .transform((prompt) => (prompt === "" ? null : prompt)),
  })
  .refine(
    ({ title, systemPrompt }) =>
      title !== undefined || systemPrompt !== undefined,
    { message: "Nothing to update" }
  );

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

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a title of 1 to 100 characters or a system prompt." },
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
