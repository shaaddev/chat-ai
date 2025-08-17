import { Info, Image, FlaskConical, LucideIcon } from "lucide-react";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { customProvider } from "ai";

interface model_selection {
  id: string;
  name: string;
  icon: LucideIcon;
  image: LucideIcon;
  unstable?: LucideIcon;
}

export const stable_models: model_selection[] = [
  {
    id: "google-model-2-0",
    name: "Gemini 2.0 Flash",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
  },
  {
    id: "chat-5-mini",
    name: "GPT-5-mini",
    icon: Info,
    image: Image,
  },
  {
    id: "chat-o3-mini",
    name: "o3-mini",
    icon: Info,
    image: Image,
  },
  {
    id: "chat-4o-mini",
    name: "GPT-4o-mini",
    icon: Info,
    image: Image,
  },
];

export const DEFAULT_CHAT_MODEL: string = "google-model-2-0";

export const myProvider = customProvider({
  languageModels: {
    "google-model-2-0": google("gemini-2.0-flash"),
    "chat-5-mini": openai("gpt-5-mini"),
    "chat-o3-mini": openai("o3-mini"),
    "chat-4o-mini": openai("gpt-4o-mini"),
    "title-model": google("gemini-2.0-flash"),
  },
});
