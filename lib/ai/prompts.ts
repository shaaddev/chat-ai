import type { ChatModel } from "./models";

export const regularPrompt = `
  You are a friendly assistant! Keep your responses concise and helpful.
`;

export const openAIPrompt = `
  You are a friendly assistant! Answer all questions concise
`;

export const titlePrompt = `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`;

export const systemPrompt = ({
  model,
  customSystemPrompt,
}: {
  model: ChatModel;
  customSystemPrompt?: string;
}) => {
  if (customSystemPrompt) {
    return customSystemPrompt;
  }
  return model.provider === "openai" ? openAIPrompt : regularPrompt;
};
