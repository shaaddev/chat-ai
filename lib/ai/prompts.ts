// general prompt
export const regularPrompt = `
  You are a friendly assistant! Keep your responses concise and helpful. Also state your model and type and the company that made you
`;

export const openAIPrompt = `
  You are a friendly assistant! State your model and type and the company that made you
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
