import { Info, Image, FlaskConical, LucideIcon } from "lucide-react";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { LanguageModelV1, customProvider } from "ai";

interface model_selection {
  model: string;
  icon: LucideIcon;
  image: LucideIcon;
  unstable?: LucideIcon;
  languageModel: LanguageModelV1;
}

export const stable_models: model_selection[] = [
  {
    model: "Gemini 1.5 pro",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
    languageModel: google("gemini-1.5-pro"),
  },
  {
    model: "Gemini 2.0 Flash",
    icon: Info,
    image: Image,
    unstable: FlaskConical,
    languageModel: google("gemini-2.0-flash-exp"),
  },
  {
    model: "ChatGPT o1-mini",
    icon: Info,
    image: Image,
    languageModel: openai("o1-mini"),
  },
];

export const experimental_models = [
  {
    model: "Deekseek r1",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
  {
    model: "Deepseek v3",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
  {
    model: "Deepseek v3 (old)",
    icon: Info,
    unstable: FlaskConical,
    languageModel: "",
  },
];

export const DEFAULT_CHAT_MODEL: string = "Gemini 1.5 pro";

export const myProvider = customProvider({
  languageModels: {
    "Gemini 1.5 pro": google("gemini-1.5-pro-latest"),
    "Gemini 2.0 Flash": google("gemini-2.0-flash-exp"),
    "ChatGPT o1-mini": openai("o1-mini"),
  },
});
