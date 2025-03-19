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
}: {
  selectedChatModel: string;
}) => {
  if (selectedChatModel === "chat-o1-mini" || "chat-4o-mini") {
    return openAIPrompt;
  } else {
    return regularPrompt;
  }
};
