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
    id: "google-model-2-5-flash",
    name: "Gemini 2.5 Flash",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
  },
  {
    id: "google-model-2-5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
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

export const DEFAULT_CHAT_MODEL: string = "google-model-2-5-flash";

export const myProvider = customProvider({
  languageModels: {
    "google-model-2-5-flash": google("gemini-2.5-flash"),
    "google-model-2-5-flash-lite": google("gemini-2.5-flash-lite"),
    "chat-5-mini": openai("gpt-5-mini"),
    "chat-o3-mini": openai("o3-mini"),
    "chat-4o-mini": openai("gpt-4o-mini"),
    "title-model": google("gemini-2.5-flash"),
  },
});
