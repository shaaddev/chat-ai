import { z } from "zod";
import { CHAT_MODEL_IDS } from "@/lib/ai/models";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(100_000), // Allow up to ~100k characters for large inputs
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(CHAT_MODEL_IDS),
  useSearch: z.boolean().optional().default(false),
  autoDocumentGeneration: z.boolean().optional().default(false),
  customSystemPrompt: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
