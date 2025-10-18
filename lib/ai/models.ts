import { fal } from "@ai-sdk/fal";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { FlaskConical, Image, Info, type LucideIcon } from "lucide-react";

interface model_selection {
  id: string;
  name: string;
  icon: LucideIcon;
  image?: LucideIcon;
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
    name: "GPT 5 mini",
    icon: Info,
    image: Image,
  },
];

export const image_models: model_selection[] = [
  {
    id: "chat-image-1-mini",
    name: "GPT Image 1 mini",
    icon: Info,
  },
  {
    id: "chat-dall-e-3",
    name: "Dall-E 3",
    icon: Info,
  },
  {
    id: "fal-ai-image",
    name: "Fal AI Image",
    icon: Info,
  },
];

export const DEFAULT_CHAT_MODEL: string = "google-model-2-5-flash";

export const myProvider = customProvider({
  languageModels: {
    "google-model-2-5-flash": google("gemini-2.5-flash"),
    "google-model-2-5-flash-lite": google("gemini-2.5-flash-lite"),
    "chat-5-mini": openai("gpt-5-mini"),
    "title-model": google("gemini-2.5-flash-lite"),
  },
  imageModels: {
    "chat-image-1-mini": openai.image("gpt-image-1"),
    "chat-dall-e-3": openai.image("dall-e-3"),
    "fal-ai-image": fal.image("fal-ai/flux/dev"),
  },
});
