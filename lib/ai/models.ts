import { customProvider } from "ai";
import { FlaskConical, Image, Info, type LucideIcon } from "lucide-react";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface model_selection {
  id: string;
  name: string;
  icon: LucideIcon;
  image?: LucideIcon;
  unstable?: LucideIcon;
}

export const stable_models: model_selection[] = [
  {
    id: "google-model-3-flash",
    name: "Gemini 3 Flash",
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
    id: "chat-gemini-2-5-flash-image",
    name: "Gemini 2.5 Flash Image (Nano Banana)",
    icon: Info,
  },
];

export const DEFAULT_CHAT_MODEL: string = "google-model-3-flash";

export const myProvider = customProvider({
  languageModels: {
    "google-model-3-flash": openrouter("google/gemini-3-flash-preview"),
    "google-model-2-5-flash-lite": openrouter("google/gemini-2.5-flash-lite"),
    "chat-5-mini": openrouter("openai/gpt-5-mini"),
    "title-model": openrouter("google/gemini-2.5-flash-lite"),
  },
  imageModels: {
    // @ts-expect-error - keep as string since we're using the direct API
    "chat-image-1-mini": "openai/gpt-5-image-mini",
    // @ts-expect-error - same as above
    "chat-gemini-2-5-flash-image": "google/gemini-2.5-flash-image",
  },
});
