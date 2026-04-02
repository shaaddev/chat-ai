import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { customProvider } from "ai";
import { FlaskConical, Image, Info, type LucideIcon } from "lucide-react";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export type ModelProvider =
  | "google"
  | "openai"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "xai"
  | "meta";

export const PROVIDER_META: Record<
  ModelProvider,
  { label: string; color: string }
> = {
  google: {
    label: "Google",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  openai: {
    label: "OpenAI",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  deepseek: {
    label: "DeepSeek",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  qwen: {
    label: "Alibaba",
    color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  },
  moonshot: {
    label: "Moonshot",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  },
  xai: {
    label: "xAI",
    color: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  meta: {
    label: "Meta",
    color: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  },
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
  capabilities: ModelCapability[];
  contextWindow: string;
  description: string;
  icon: LucideIcon;
  id: string;
  image?: LucideIcon;
  inputPrice: string;
  name: string;
  outputPrice: string;
  provider: ModelProvider;
  unstable?: LucideIcon;
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
    capabilities: ["reasoning", "vision", "audio", "video", "tool-use", "code"],
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
  {
    id: "deepseek-v3-2",
    name: "DeepSeek V3.2",
    icon: Info,
    provider: "deepseek",
    description:
      "GPT-5 class MoE model with DeepSeek Sparse Attention for efficient long-context reasoning. Gold medalist on 2025 IMO and IOI.",
    contextWindow: "164K",
    inputPrice: "$0.25",
    outputPrice: "$0.40",
    capabilities: ["reasoning", "tool-use", "code"],
  },
  {
    id: "alibaba-qwen-3-5-plus",
    name: "Qwen 3.5 Plus",
    icon: Info,
    provider: "qwen",
    description:
      "Hybrid architecture with linear attention and sparse MoE for high inference efficiency. Native vision-language with text, image, and video input.",
    contextWindow: "1M",
    inputPrice: "$0.40",
    outputPrice: "$2.40",
    capabilities: ["reasoning", "vision", "video", "tool-use", "code"],
  },
  {
    id: "moonshot-kimi-k-2-5",
    name: "Kimi K2.5",
    icon: Info,
    provider: "moonshot",
    description:
      "Native multimodal model with state-of-the-art visual coding and self-directed agent swarm paradigm. Trained on ~15T mixed visual and text tokens.",
    contextWindow: "256K",
    inputPrice: "$0.45",
    outputPrice: "$2.20",
    capabilities: ["reasoning", "vision", "tool-use", "code"],
  },
  {
    id: "xai-grok-4-1",
    name: "Grok 4.1 Fast",
    icon: Info,
    provider: "xai",
    description:
      "xAI's best agentic tool-calling model for customer support and deep research. Optional reasoning with a 2M context window.",
    contextWindow: "2M",
    inputPrice: "$0.20",
    outputPrice: "$0.50",
    capabilities: ["reasoning", "vision", "tool-use", "code"],
  },
  {
    id: "xai-grok-4",
    name: "Grok 4 Fast",
    icon: Info,
    provider: "xai",
    description:
      "Multimodal model with SOTA cost-efficiency and 2M context. Available in reasoning and non-reasoning flavors.",
    contextWindow: "2M",
    inputPrice: "$0.20",
    outputPrice: "$0.50",
    capabilities: ["reasoning", "vision", "tool-use", "code"],
  },
  {
    id: "meta-llama-4-maverick",
    name: "Llama 4 Maverick",
    icon: Info,
    provider: "meta",
    description:
      "17B active params MoE (400B total) multimodal model supporting 12 languages. Instruction-tuned for assistant behavior, image reasoning, and 1M context.",
    contextWindow: "1M",
    inputPrice: "$0.15",
    outputPrice: "$0.60",
    capabilities: ["vision", "tool-use", "code"],
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
    name: "Gemini 2.5 Flash Image",
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
    "deepseek-v3-2": openrouter("deepseek/deepseek-v3.2"),
    "alibaba-qwen-3-5-plus": openrouter("qwen/qwen3.5-plus-02-15"),
    "moonshot-kimi-k-2-5": openrouter("moonshotai/kimi-k2.5"),
    "xai-grok-4-1": openrouter("x-ai/grok-4.1-fast"),
    "xai-grok-4": openrouter("x-ai/grok-4-fast"),
    "meta-llama-4-maverick": openrouter("meta-llama/llama-4-maverick"),
    "title-model": openrouter("google/gemini-2.5-flash-lite"),
  },
  imageModels: {
    // @ts-expect-error - keep as string since we're using the direct API
    "chat-image-1-mini": "openai/gpt-5-image-mini",
    // @ts-expect-error - same as above
    "chat-gemini-2-5-flash-image": "google/gemini-2.5-flash-image",
  },
});
