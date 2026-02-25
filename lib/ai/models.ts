import { customProvider } from "ai";
import { FlaskConical, Image, Info, type LucideIcon } from "lucide-react";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export type ModelProvider = "google" | "openai";

export const PROVIDER_META: Record<
  ModelProvider,
  { label: string; color: string }
> = {
  google: { label: "Google", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  openai: { label: "OpenAI", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

export type ModelCapability =
  | "reasoning"
  | "vision"
  | "audio"
  | "video"
  | "tool-use"
  | "fast"
  | "image-gen"
  | "image-edit"
  | "code";

export interface model_selection {
  id: string;
  name: string;
  icon: LucideIcon;
  image?: LucideIcon;
  unstable?: LucideIcon;
  provider: ModelProvider;
  description: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  capabilities: ModelCapability[];
}

export const stable_models: model_selection[] = [
  {
    id: "google-model-3-flash",
    name: "Gemini 3 Flash",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
    provider: "google",
    description:
      "High-speed thinking model for agentic workflows, coding, and multi-turn chat with near-Pro reasoning.",
    contextWindow: "1M",
    inputPrice: "$0.50",
    outputPrice: "$3.00",
    capabilities: [
      "reasoning",
      "vision",
      "audio",
      "video",
      "tool-use",
      "code",
    ],
  },
  {
    id: "google-model-2-5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
    provider: "google",
    description:
      "Ultra-low latency and cost-efficient lightweight model with optional reasoning for fast responses.",
    contextWindow: "1M",
    inputPrice: "$0.10",
    outputPrice: "$0.40",
    capabilities: ["fast", "vision", "audio", "tool-use"],
  },
  {
    id: "chat-5-mini",
    name: "GPT 5 Mini",
    icon: Info,
    image: Image,
    provider: "openai",
    description:
      "Compact version of GPT-5 for lighter reasoning tasks with strong instruction following and safety tuning.",
    contextWindow: "400K",
    inputPrice: "$0.25",
    outputPrice: "$2.00",
    capabilities: ["reasoning", "vision", "tool-use", "code"],
  },
];

export const image_models: model_selection[] = [
  {
    id: "chat-image-1-mini",
    name: "GPT Image 1 Mini",
    icon: Info,
    provider: "openai",
    description:
      "Combines GPT-5 Mini with GPT Image 1 for efficient image generation, text rendering, and editing.",
    contextWindow: "400K",
    inputPrice: "$2.50",
    outputPrice: "$2.00",
    capabilities: ["image-gen", "image-edit", "vision"],
  },
  {
    id: "chat-gemini-2-5-flash-image",
    name: "Gemini 2.5 Flash Image (Nano Banana)",
    icon: Info,
    provider: "google",
    description:
      'A.k.a. "Nano Banana" — state-of-the-art image generation with contextual understanding and multi-turn editing.',
    contextWindow: "32K",
    inputPrice: "$0.30",
    outputPrice: "$2.50",
    capabilities: ["image-gen", "image-edit", "vision"],
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
