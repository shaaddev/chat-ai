import { Info, Image, FlaskConical, LucideIcon } from "lucide-react";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { LanguageModelV1, customProvider } from "ai";

interface model_selection {
  id: string;
  name: string;
  icon: LucideIcon;
  image: LucideIcon;
  unstable?: LucideIcon;
  languageModel: LanguageModelV1;
}

export const stable_models: model_selection[] = [
  {
    id: "google-model-2.0",
    name: "Gemini 2.0 Flash",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
    languageModel: google("gemini-2.0-flash-001"),
  },
  {
    id: "chat-o3-mini",
    name: "o3-mini",
    icon: Info,
    image: Image,
    languageModel: openai("o1-mini"),
  },
  {
    id: "chat-4o-mini",
    name: "GPT-4o-mini",
    icon: Info,
    image: Image,
    languageModel: openai("gpt-4o-mini"),
  },
];

export const DEFAULT_CHAT_MODEL: string = "google-model-2.0";

export const myProvider = customProvider({
  languageModels: {
    "google-model-2.0": google("gemini-2.0-flash-001"),
    "chat-o3-mini": openai("o3-mini-2025-01-31"),
    "chat-4o-mini": openai("gpt-4o-mini"),
  },
});

export const experimental_models = [
  {
    name: "Deekseek r1",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
  {
    name: "Deepseek v3",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
  {
    name: "Deepseek v3 (old)",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
];
