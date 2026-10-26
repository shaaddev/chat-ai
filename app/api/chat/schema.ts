import { z } from "zod";
import { CHAT_MODEL_IDS } from "@/lib/ai/models";
import type { UserTurn } from "@/lib/db/queries";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MEDIA_TYPES,
} from "@/lib/uploadthing/attachments";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(100_000), // Allow up to ~100k characters for large inputs
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(ATTACHMENT_MEDIA_TYPES),
  filename: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(ATTACHMENT_MAX_BYTES),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const messageIdSchema = z.string().min(1).max(128);

const settingsShape = {
  id: z.string().uuid(),
  selectedChatModel: z.enum(CHAT_MODEL_IDS),
  useSearch: z.boolean().optional().default(false),
  autoDocumentGeneration: z.boolean().optional().default(false),
  customSystemPrompt: z.string().optional(),
};

export const postRequestBodySchema = z.discriminatedUnion("trigger", [
  z.object({
    ...settingsShape,
    trigger: z.literal("submit-message").default("submit-message"),
    messageId: messageIdSchema.optional(),
    message: z.object({
      id: messageIdSchema,
      role: z.enum(["user"]),
      parts: z.array(partSchema),
    }),
  }),
  z.object({
    ...settingsShape,
    trigger: z.literal("regenerate-message"),
    message: z.object({ id: messageIdSchema }),
  }),
]);

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;

export function toUserTurn(body: PostRequestBody): UserTurn {
  if (body.trigger === "regenerate-message") {
    return { type: "regenerate", userMessageId: body.message.id };
  }
  if (body.messageId === undefined) {
    return { type: "append", message: body.message };
  }
  return { type: "edit", userMessageId: body.messageId, message: body.message };
}
