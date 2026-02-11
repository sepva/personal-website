// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type {
  UIMessage,
  UIMessageStreamWriter,
  ToolSet,
  ToolCallOptions
} from "ai";
import { convertToModelMessages, isToolUIPart } from "ai";
