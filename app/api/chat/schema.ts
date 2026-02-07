import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(100000), // Allow up to ~100k characters for large inputs
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
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
  selectedChatModel: z.enum([
    "google-model-3-flash",
    "google-model-2-5-flash-lite",
    "chat-5-mini",
    // image models
    "chat-image-1-mini",
    "chat-gemini-2-5-flash-image",
  ]),
  useSearch: z.boolean().optional().default(false),
  customSystemPrompt: z.string().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
