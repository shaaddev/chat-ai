import { z } from "zod";
import { auth } from "@/app/auth";
import { TITLE_WAIT_MS } from "@/lib/ai/providers";
import { isReplyPending, settleTurn } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { pollWhile } from "@/lib/poll";
import { convertToUIMessages } from "@/lib/utils";

// A new chat's reply saves only after its stream has waited for the title.
const REPLY_WAIT_MS = TITLE_WAIT_MS + 2000;

const settleRequestBodySchema = z.object({
  turnId: z.string().uuid(),
  expectReply: z.boolean().optional().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = settleRequestBodySchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!body.success) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();
  if (!session) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const turn = {
    chatId: id,
    userId: session.user.id,
    turnId: body.data.turnId,
  };
  // The client showed reply text, so the turn's own request is saving that
  // reply. Past the deadline that request has likely died.
  if (body.data.expectReply) {
    await pollWhile(() => isReplyPending(turn), Date.now() + REPLY_WAIT_MS);
  }

  const settled = await settleTurn(turn);
  if (!settled) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  return Response.json({
    messages: convertToUIMessages(settled.messages),
    turnSaved: settled.turnSaved,
  });
}
