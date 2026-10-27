import { z } from "zod";
import { auth } from "@/app/auth";
import { TITLE_WAIT_MS } from "@/lib/ai/providers";
import { isReplyPending, settleTurn } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages } from "@/lib/utils";

// A new chat's reply saves only after its stream has waited for the title.
const REPLY_WAIT_MS = TITLE_WAIT_MS + 2000;
const FIRST_POLL_MS = 50;
const MAX_POLL_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const waitForReply = async (
    deadline: number,
    pollMs: number
  ): Promise<void> => {
    if (Date.now() >= deadline || !(await isReplyPending(turn))) {
      return;
    }
    await sleep(Math.min(pollMs, deadline - Date.now()));
    await waitForReply(deadline, Math.min(pollMs * 2, MAX_POLL_MS));
  };
  if (body.data.expectReply) {
    await waitForReply(Date.now() + REPLY_WAIT_MS, FIRST_POLL_MS);
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
