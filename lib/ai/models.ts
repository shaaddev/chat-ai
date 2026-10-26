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

export type ModelKind = "text" | "image";

interface ModelSpec {
  readonly capabilities: readonly ModelCapability[];
  readonly contextWindow: string;
  readonly description: string;
  readonly id: string;
  readonly inputPrice: string;
  readonly kind: ModelKind;
  readonly name: string;
  readonly outputPrice: string;
  readonly provider: ModelProvider;
  readonly slug: string;
}

const MODEL_SPECS = [
  {
    id: "google-model-3-1-flash-lite",
    slug: "google/gemini-3.1-flash-lite",
    kind: "text",
    name: "Gemini 3.1 Flash Lite",
    provider: "google",
    description:
      "High-efficiency multimodal model optimized for low-latency, high-volume workloads",
    contextWindow: "1M",
    inputPrice: "$0.25",
    outputPrice: "$1.50",
    capabilities: ["reasoning", "vision", "audio", "video", "tool-use", "code"],
  },
  {
    id: "google-model-2-5-flash-lite",
    slug: "google/gemini-2.5-flash-lite",
    kind: "text",
    name: "Gemini 2.5 Flash Lite",
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
    slug: "openai/gpt-5-mini",
    kind: "text",
    name: "GPT 5 Mini",
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
    slug: "deepseek/deepseek-v3.2",
    kind: "text",
    name: "DeepSeek V3.2",
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
    slug: "qwen/qwen3.5-plus-02-15",
    kind: "text",
    name: "Qwen 3.5 Plus",
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
    slug: "moonshotai/kimi-k2.5",
    kind: "text",
    name: "Kimi K2.5",
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
    slug: "x-ai/grok-4.1-fast",
    kind: "text",
    name: "Grok 4.1 Fast",
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
    slug: "x-ai/grok-4-fast",
    kind: "text",
    name: "Grok 4 Fast",
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
    slug: "meta-llama/llama-4-maverick",
    kind: "text",
    name: "Llama 4 Maverick",
    provider: "meta",
    description:
      "17B active params MoE (400B total) multimodal model supporting 12 languages. Instruction-tuned for assistant behavior, image reasoning, and 1M context.",
    contextWindow: "1M",
    inputPrice: "$0.15",
    outputPrice: "$0.60",
    capabilities: ["vision", "tool-use", "code"],
  },
  {
    id: "chat-image-1-mini",
    slug: "openai/gpt-5-image-mini",
    kind: "image",
    name: "GPT Image 1 Mini",
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
    slug: "google/gemini-2.5-flash-image",
    kind: "image",
    name: "Gemini 2.5 Flash Image",
    provider: "google",
    description:
      'A.k.a. "Nano Banana" — state-of-the-art image generation with contextual understanding and multi-turn editing.',
    contextWindow: "32K",
    inputPrice: "$0.30",
    outputPrice: "$2.50",
    capabilities: ["image-gen", "image-edit", "vision"],
  },
] as const satisfies readonly ModelSpec[];

export type ChatModelId = (typeof MODEL_SPECS)[number]["id"];

export interface ChatModel extends ModelSpec {
  readonly id: ChatModelId;
}

export const CHAT_MODELS: readonly ChatModel[] = MODEL_SPECS;

export const CHAT_MODEL_IDS: ChatModelId[] = CHAT_MODELS.map(
  (model) => model.id
);

export const DEFAULT_CHAT_MODEL: ChatModelId = "google-model-2-5-flash-lite";

export const TITLE_MODEL_SLUG = "google/gemini-2.5-flash-lite";

export function findChatModel(
  id: string | null | undefined
): ChatModel | undefined {
  return CHAT_MODELS.find((model) => model.id === id);
}

export function getChatModel(id: ChatModelId): ChatModel {
  const model = findChatModel(id);
  if (!model) {
    throw new Error(`Chat model ${id} is missing from the registry`);
  }
  return model;
}
