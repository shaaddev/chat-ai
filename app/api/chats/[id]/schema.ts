import { z } from "zod";

const FRACTIONAL_INDEX_KEY_REGEX = /^[0-9A-Za-z]{1,64}$/;

export const patchRequestBodySchema = z
  .object({
    title: z
      .string()
      .overwrite((title) => title.replaceAll("\u0000", ""))
      .trim()
      .min(1)
      .max(100)
      .optional(),
    systemPrompt: z
      .string()
      .nullable()
      .optional()
      .transform((prompt) => (prompt === "" ? null : prompt)),
    pinnedKey: z
      .string()
      .regex(FRACTIONAL_INDEX_KEY_REGEX)
      .nullable()
      .optional(),
  })
  .refine(
    ({ title, systemPrompt, pinnedKey }) =>
      title !== undefined ||
      systemPrompt !== undefined ||
      pinnedKey !== undefined,
    { message: "Nothing to update" }
  );
