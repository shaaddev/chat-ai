// general prompt
export const regularPrompt = `
  You are a friendly assistant! Keep your responses concise and helpful. Also state your model and type and the company that made you
`;

export const openAIPrompt = `
  You are a friendly assistant! State your model and type and the company that made you
`;

// edit this to suit each model
export const systemPrompt = ({ selectedModel }: { selectedModel: string }) => {
  if (selectedModel === "ChatGPT o1-mini" || "ChatGPT 4o mini") {
    return openAIPrompt;
  } else {
    return regularPrompt;
  }
};
