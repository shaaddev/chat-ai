// general prompt
export const regularPrompt = `
  You are a friendly assistant! Keep your responses concise and helpful. 
`;

export const openAIPrompt = `
  You are a friendly assistant! Answer all questions concise
`;

// edit this to suit each model
export const systemPrompt = ({
  selectedChatModel,
  customSystemPrompt,
}: {
  selectedChatModel: string;
  customSystemPrompt?: string;
}) => {
  // If the user has set a custom system prompt for this chat, use it
  if (customSystemPrompt) {
    return customSystemPrompt;
  }

  if (
    selectedChatModel === "chat-o3-mini" ||
    selectedChatModel === "chat-4o-mini" ||
    selectedChatModel === "chat-5-mini"
  ) {
    return openAIPrompt;
  } else {
    return regularPrompt;
  }
};
