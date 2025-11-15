---
description: Personal website project coding standards and best practices
applyTo: 'src/**/*.{ts,tsx}'
---

# Personal Website Project Guidelines

This project is a Cloudflare Agents-powered chat application built with React 19, TypeScript, Vite, and Tailwind CSS v4. Follow these guidelines to maintain consistency and quality.

## Technology Stack

- **Runtime**: Cloudflare Workers with Agents SDK
- **Frontend**: React 19, TypeScript 5.9+
- **Build Tool**: Vite 7+
- **Styling**: Tailwind CSS 4 (native CSS with `@theme` and custom variants)
- **AI SDK**: Vercel AI SDK with OpenAI provider
- **Design**: Figma (source of truth for UI components)
- **Linting**: Biome (NOT ESLint/Prettier for code - Prettier only for non-code files)
- **Package Manager**: npm
- **Module System**: ES Modules (ES2022)

## TypeScript Standards

### Strict Type Safety

- Enable all strict TypeScript checks (`strict: true`)
- Use `noUnusedLocals: true` to catch unused variables
- Never use `any` - use `unknown` or proper types instead
- Use type imports with `type` keyword when importing only types:

```typescript
import type { UIMessage } from "@ai-sdk/react";
import type { ToolSet } from "ai";
```

### Type Definitions

- Define interfaces for component props with explicit types:

```typescript
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: React.ElementType;
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "tertiary";
  size?: "sm" | "md" | "lg" | "base";
  loading?: boolean;
};
```

- Use `satisfies` operator for type checking without widening:

```typescript
export const tools = {
  getWeatherInformation,
  getLocalTime,
} satisfies ToolSet;

export default {
  async fetch(request, env, ctx) {
    // ...
  }
} satisfies ExportedHandler<Env>;
```

- Use generic constraints for flexible, type-safe components:

```typescript
export const Slot = <T extends React.ElementType>({
  as,
  children,
  ...props
}: SlotProps<T>) => {
  const Component = as;
  return <Component {...props}>{children}</Component>;
};
```

### Module Resolution

- Use `@/` path alias for absolute imports from `src/`:

```typescript
import { Button } from "@/components/button/Button";
import { cn } from "@/lib/utils";
```

- Group imports logically:
  1. External dependencies (React, third-party)
  2. Internal utilities and types
  3. Components (organized by feature)
  4. Icons
  5. Styles

```typescript
import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import type { UIMessage } from "@ai-sdk/react";

import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";

import { Moon, Sun } from "@phosphor-icons/react";
```

## React Patterns

### Component Structure

- Use **named exports** for components (NOT default exports):

```typescript
export const Button = ({ ...props }: ButtonProps) => {
  // ...
};
```

- Implement conditional wrapper pattern for optional features:

```typescript
export const Button = ({ ...props }: ButtonProps) => {
  return props.tooltip ? (
    <Tooltip content={props.tooltip}>
      <ButtonComponent {...props} className={undefined} />
    </Tooltip>
  ) : (
    <ButtonComponent {...props} />
  );
};
```

- Separate internal component logic from external API:

```typescript
// Internal component with full logic
const AvatarComponent = ({ ... }: AvatarProps) => {
  // implementation
};

// Public API with wrapper features
export const Avatar = ({ ...props }: AvatarProps) => {
  return props.tooltip ? (
    <Tooltip content={props.tooltip}>
      <AvatarComponent {...props} className={undefined} />
    </Tooltip>
  ) : (
    <AvatarComponent {...props} />
  );
};
```

### Hooks Usage

- Custom hooks should start with `use` prefix:

```typescript
const useTheme = (theme?: "dark" | "light") => {
  useEffect(() => {
    // implementation
  }, [theme]);
};

export default useTheme;
```

- Use `useCallback` for stable function references in dependencies:

```typescript
const scrollToBottom = useCallback(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []);
```

- Use `useMemo` for expensive computations:

```typescript
const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
```

- Prefer `useRef` for DOM references and mutable values that don't trigger re-renders:

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLInputElement | null>(null);
```

### State Management

- Use `useState` with functional updates for computed initial state:

```typescript
const [theme, setTheme] = useState<"dark" | "light">(() => {
  const savedTheme = localStorage.getItem("theme");
  return (savedTheme as "dark" | "light") || "dark";
});
```

- Toggle state with functional updates:

```typescript
setShowDebug((prev) => !prev);
```

### Event Handlers

- Name handlers with `handle` prefix:

```typescript
const handleAgentSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
};

const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setAgentInput(e.target.value);
};
```

- Use type-safe event handlers:

```typescript
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    handleAgentSubmit(e as unknown as React.FormEvent);
  }
}}
```

### Memoization

- Use `memo` for expensive components that re-render frequently:

```typescript
const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <div className="markdown-body">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";
```

- Always set `displayName` for memoized components for better debugging:

```typescript
MemoizedMarkdown.displayName = "MemoizedMarkdown";
```

## Styling Standards

### Tailwind CSS v4 Conventions

This project uses **Tailwind CSS v4** with native CSS features. Key differences from v3:

- Use `@import "tailwindcss"` instead of `@tailwind` directives
- Use `@theme` for design tokens (NOT `theme()` function)
- Use `@custom-variant` for custom modifiers
- Use `@variant` for applying variants within CSS

### Design Token Pattern

Define reusable design tokens in CSS using `@theme`:

```css
@theme {
  /* Custom text sizes */
  --text-xs: 10px;
  --text-xs--line-height: calc(1 / 0.5);
  
  /* Custom colors */
  --color-neutral-850: oklch(0.23 0 0);
  
  /* Custom easing */
  --ease-bounce: cubic-bezier(0.2, 0, 0, 1.5);
  
  /* Custom animations */
  --animate-refresh: refresh 0.5s ease-in-out infinite;
}
```

### Custom Variant Pattern

Create reusable modifier classes with `@custom-variant`:

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant interactive (&:where(.interactive, .interactive *));
@custom-variant toggle (&:where(.toggle, .toggle *));
@custom-variant square (&:where(.square, .square *));
```

Apply them using `@variant`:

```css
.btn {
  @apply border-ob-btn-secondary-border bg-ob-btn-secondary-bg;
  
  @variant interactive {
    @apply not-disabled:hover:bg-ob-btn-secondary-bg-hover;
    
    @variant toggle {
      @apply not-disabled:bg-ob-btn-secondary-bg-hover;
    }
  }
}
```

### Component-Specific CSS Classes

Use semantic naming for component base classes:

```css
.btn { /* base button styles */ }
.add-focus { /* reusable focus styles */ }
.add-disable { /* reusable disabled styles */ }
.add-size-sm { /* small size variant */ }
.add-size-md { /* medium size variant */ }
.add-size-base { /* base/default size variant */ }
```

### className Utility Pattern

Always use `cn()` utility from `@/lib/utils` for conditional classes:

```typescript
import { cn } from "@/lib/utils";

<button
  className={cn(
    "btn add-focus group interactive flex w-max",
    {
      "btn-primary": variant === "primary",
      "btn-secondary": variant === "secondary",
      "add-size-sm gap-1": size === "sm",
      "add-size-md gap-1.5": size === "md",
      "square": shape === "square",
      "circular": shape === "circular",
      "add-disable": disabled,
      "toggle": toggled,
    },
    className
  )}
/>
```

### Dark Mode Pattern

- Use `.dark` class on `<html>` for dark mode
- Override theme variables within `.dark` scope:

```css
.dark {
  --color-ob-base-100: var(--color-neutral-950);
  --color-ob-base-300: var(--color-neutral-50);
}
```

- Toggle dark mode by adding/removing class:

```typescript
useEffect(() => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  }
  localStorage.setItem("theme", theme);
}, [theme]);
```

### Component Styling Principles

1. **Base styles** in CSS files (`.btn`, `.add-focus`, etc.)
2. **Modifiers** via className props with `cn()`
3. **Variants** using object syntax for conditional application
4. **User overrides** always accept `className` prop as last argument

```typescript
<Slot
  className={cn(
    "base-classes",
    { "conditional-class": condition },
    className // User override
  )}
/>
```

## Component Architecture

### Front-End Component Development Process

**Always consult Figma designs before implementing or modifying front-end components.**

1. **Retrieve Figma Design**:
   - Use Figma MCP server to access component designs
   - Use `get_design_context` for detailed component specifications
   - Use `get_screenshot` to visualize the design element

2. **Save Figma Reference**:
   - Place Figma-generated code in `figma/` directory
   - Use the same component name: `figma/ComponentName.tsx`
   - Keep as reference for styling and structure

3. **Implement Component**:
   - Create actual component in `src/components/component-name/ComponentName.tsx`
   - Follow project patterns (polymorphic components, named exports, etc.)
   - Match Figma specifications for colors, spacing, typography, and layout
   - Adapt Figma code to project conventions (use `cn()`, Tailwind classes, etc.)

4. **Cross-Reference**:
   - Verify implementation matches Figma design specifications
   - Ensure all variants and states from Figma are implemented
   - Check responsive behavior matches design system

**If Figma URL or node ID is unknown, ask the user to provide it before proceeding.**

### Polymorphic Component Pattern

Use the `as` prop pattern for flexible component composition:

```typescript
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: React.ElementType;
  href?: string;
};

<Slot
  as={as ?? "button"} // Default to button, allow override
  href={href}
/>
```

Enables usage like:

```typescript
<Button as="a" href="/link">Link Button</Button>
<Button as="div">Div Button</Button>
```

### Slot Pattern for Polymorphism

Create a reusable `Slot` component for rendering as different elements:

```typescript
type SlotProps<T extends React.ElementType> = {
  as: T;
  children?: React.ReactNode;
} & React.ComponentPropsWithRef<T>;

export const Slot = <T extends React.ElementType>({
  as,
  children,
  ...props
}: SlotProps<T>) => {
  const Component = as;
  return <Component {...props}>{children}</Component>;
};
```

### Compound Component Pattern

For optional wrapper features (tooltips, modals):

```typescript
// Pattern: Separate internal and external components
const InternalComponent = (props) => {
  // Core implementation
};

export const PublicComponent = ({ tooltip, ...props }) => {
  return tooltip ? (
    <Tooltip content={tooltip}>
      <InternalComponent {...props} className={undefined} />
    </Tooltip>
  ) : (
    <InternalComponent {...props} />
  );
};
```

**Important**: Set `className={undefined}` on wrapped component to prevent duplicate class application!

### Size Variant Pattern

Standardize size props across components:

```typescript
type ComponentProps = {
  size?: "sm" | "md" | "base" | "lg";
};

// Apply consistently:
{
  "add-size-sm": size === "sm",
  "add-size-md": size === "md",
  "add-size-base": size === "base",
  "add-size-lg": size === "lg",
}
```

### Shape Variant Pattern

For components with shape variations:

```typescript
type ComponentProps = {
  shape?: "base" | "square" | "circular";
};

// Maps to CSS variants:
{
  "square": shape === "square",
  "circular": shape === "circular",
}
```

## Cloudflare Agents Patterns

### Agent Class Structure

Extend `Agent` or specialized classes with proper typing:

```typescript
import { AIChatAgent } from "agents/ai-chat-agent";
import type { StreamTextOnFinishCallback, ToolSet } from "ai";

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Implementation
  }
  
  async executeTask(description: string, _task: Schedule<string>) {
    // Scheduled task implementation
  }
}
```

### Worker Entry Point

Use `satisfies ExportedHandler` for type-safe exports:

```typescript
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    // Routing logic
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
```

### Tool Definition Pattern

Define tools with explicit schemas and execution logic:

```typescript
import { tool } from "ai";
import { z } from "zod/v3"; // Import from zod/v3

// Auto-executing tool (includes execute function)
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    return new Date().toLocaleTimeString();
  }
});

// Human-in-the-loop tool (no execute function)
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omit execute - requires manual confirmation
});

export const tools = {
  getLocalTime,
  getWeatherInformation
} satisfies ToolSet;

// Separate execution handlers for confirmation-required tools
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    return `The weather in ${city} is sunny`;
  }
};
```

### UI Message Stream Pattern

Use Vercel AI SDK patterns for streaming:

```typescript
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  streamText
} from "ai";

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    const result = streamText({
      model,
      messages: convertToModelMessages(processedMessages),
      tools: allTools,
      onFinish: onFinish as unknown as StreamTextOnFinishCallback<typeof allTools>
    });
    
    writer.merge(result.toUIMessageStream());
  }
});

return createUIMessageStreamResponse({ stream });
```

### Agent React Hooks

Use the `useAgent` and `useAgentChat` hooks for client-side interaction:

```typescript
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

const agent = useAgent({
  agent: "chat" // matches Durable Object binding name
});

const {
  messages,
  addToolResult,
  clearHistory,
  status,
  sendMessage,
  stop
} = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
  agent
});
```

## Code Organization

### File Structure

```
src/
├── app.tsx              # Main app component
├── client.tsx           # Client entry point
├── server.ts            # Worker/Agent implementation
├── shared.ts            # Shared constants between frontend/backend
├── tools.ts             # AI tool definitions
├── utils.ts             # Helper functions
├── styles.css           # Global styles and Tailwind config
├── components/
│   ├── button/
│   │   ├── Button.tsx
│   │   └── RefreshButton.tsx
│   ├── card/
│   │   └── Card.tsx
│   └── ...
├── hooks/
│   ├── useClickOutside.tsx
│   ├── useTheme.ts
│   └── ...
├── lib/
│   └── utils.ts         # Utility functions (cn, etc.)
└── providers/
    ├── index.tsx        # Export all providers
    ├── ModalProvider.tsx
    └── TooltipProvider.tsx

figma/                   # Figma-generated reference files
├── button.tsx           # Design reference for Button component
├── card.tsx             # Design reference for Card component
├── Guidelines.md        # Figma design system documentation
└── ...                  # Other component references from Figma
```

### Naming Conventions

- **Components**: PascalCase, named exports - `export const Button`
- **Files**: PascalCase for components - `Button.tsx`
- **Hooks**: camelCase with `use` prefix - `useClickOutside`
- **Utilities**: camelCase - `cn`, `cleanupMessages`
- **Types**: PascalCase with descriptive suffix - `ButtonProps`, `AvatarProps`
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for objects:

```typescript
// Object constants
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;

// Array of tools requiring confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation"
];
```

### Shared Constants Pattern

Define shared values once in `shared.ts`:

```typescript
// shared.ts
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;
```

Use in both frontend and backend:

```typescript
import { APPROVAL } from "./shared";

if (part.output === APPROVAL.YES) {
  // Execute tool
}
```

## Error Handling

### Type-Safe Error Handling

Avoid catching errors as `any`:

```typescript
try {
  await agent.schedule(input, "executeTask", description);
} catch (error) {
  console.error("error scheduling task", error);
  return `Error scheduling task: ${error}`;
}
```

### Type Narrowing

Use type guards and narrowing:

```typescript
function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T
): key is K & keyof T {
  return key in obj;
}

if (!isValidToolName(toolName, executions)) {
  return part;
}
```

### Async Error Boundaries

Handle async errors in components properly:

```typescript
const handleAgentSubmit = async (e: React.FormEvent) => {
  try {
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  } catch (error) {
    console.error("Failed to send message:", error);
  }
};
```

## Performance Optimizations

### Message Cleanup

Remove incomplete tool calls before API requests:

```typescript
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    if (!message.parts) return true;
    
    const hasIncompleteToolCall = message.parts.some((part) => {
      if (!isToolUIPart(part)) return false;
      return (
        part.state === "input-streaming" ||
        (part.state === "input-available" && !part.output && !part.errorText)
      );
    });
    
    return !hasIncompleteToolCall;
  });
}
```

### Lazy Evaluation

Use functional updates and lazy initialization:

```typescript
// Lazy initialization
const [theme, setTheme] = useState<"dark" | "light">(() => {
  return localStorage.getItem("theme") as "dark" | "light" || "dark";
});

// Functional updates
setShowDebug((prev) => !prev);
```

### Conditional Rendering

Avoid unnecessary renders with early returns:

```typescript
if (showDebug) return null;

return (
  <ToolInvocationCard />
);
```

## Testing Standards

### Vitest + Cloudflare Workers

Use the Cloudflare Workers Vitest integration:

```typescript
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/server";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

describe("Worker", () => {
  it("responds correctly", async () => {
    const request = new Request("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
```

## Code Quality Tools

### Biome Configuration

This project uses **Biome** for linting (NOT ESLint):

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "off"
      }
    }
  },
  "formatter": {
    "enabled": false // Use Prettier for non-code files only
  }
}
```

### Biome Ignore Comments

Use Biome-specific ignore comments when necessary:

```typescript
// biome-ignore lint/correctness/useUniqueElementIds: it's alright
// biome-ignore lint/suspicious/noArrayIndexKey: immutable index
// biome-ignore lint/a11y/useKeyWithClickEvents: todo
```

### Scripts

```json
{
  "check": "prettier . --check && biome lint && tsc",
  "format": "prettier --write ."
}
```

## Documentation Standards

### JSDoc Comments

Add JSDoc for exported functions and complex logic:

```typescript
/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 */
export async function processToolCalls<Tools extends ToolSet>({
  dataStream,
  messages,
  executions
}: {
  tools: Tools;
  dataStream: UIMessageStreamWriter;
  messages: UIMessage[];
  executions: Record<string, (args: any, context: ToolCallOptions) => Promise<unknown>>;
}): Promise<UIMessage[]> {
  // Implementation
}
```

### Inline Comments

Explain non-obvious code:

```typescript
// Type boundary: streamText expects specific tool types, but base class uses ToolSet
// This is safe because our tools satisfy ToolSet interface
onFinish: onFinish as unknown as StreamTextOnFinishCallback<typeof allTools>
```

## Common Patterns Summary

### 1. Component Props Pattern

```typescript
export type ComponentProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "base";
  className?: string;
};
```

### 2. Conditional Wrapper Pattern

```typescript
export const Component = ({ tooltip, ...props }) => {
  return tooltip ? (
    <Wrapper>
      <InternalComponent {...props} className={undefined} />
    </Wrapper>
  ) : (
    <InternalComponent {...props} />
  );
};
```

### 3. Type-Safe Event Handler Pattern

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};
```

### 4. Memoization Pattern

```typescript
const MemoizedComponent = memo(
  ({ data }: Props) => <div>{data}</div>,
  (prev, next) => prev.data === next.data
);

MemoizedComponent.displayName = "MemoizedComponent";
```

### 5. Custom Hook Pattern

```typescript
const useCustomHook = (dependency: string) => {
  const [state, setState] = useState();
  
  useEffect(() => {
    // Side effect
  }, [dependency]);
  
  return state;
};

export default useCustomHook;
```

### 6. Tool Definition Pattern

```typescript
// Auto-execute tool
const toolName = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (args) => { ... }
});

// Human-confirmation tool
const confirmTool = tool({
  description: "...",
  inputSchema: z.object({ ... })
  // No execute function
});

export const tools = { toolName, confirmTool } satisfies ToolSet;
export const executions = {
  confirmTool: async (args) => { ... }
};
```

## Anti-Patterns to Avoid

### ❌ Don't: Use default exports for components

```typescript
// Bad
export default function Button() {}

// Good
export const Button = () => {};
```

### ❌ Don't: Use `any` type

```typescript
// Bad
const data: any = ...

// Good
const data: unknown = ...
const data: Record<string, unknown> = ...
```

### ❌ Don't: Forget to cleanup className in wrappers

```typescript
// Bad - className gets duplicated
<Tooltip>
  <Component {...props} />
</Tooltip>

// Good - prevent duplicate classes
<Tooltip>
  <Component {...props} className={undefined} />
</Tooltip>
```

### ❌ Don't: Use array index as key for dynamic lists

```typescript
// Bad
{items.map((item, i) => <div key={i}>{item}</div>)}

// Good
{items.map((item) => <div key={item.id}>{item}</div>)}

// Acceptable with biome-ignore for truly immutable arrays
{blocks.map((block, index) => (
  // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
  <Block key={index} content={block} />
))}
```

### ❌ Don't: Mutate state directly

```typescript
// Bad
state.value = newValue;

// Good
setState({ ...state, value: newValue });
```

### ❌ Don't: Use inline styles (use Tailwind classes)

```typescript
// Bad
<div style={{ color: 'red' }}>

// Good
<div className="text-red-600">
```

---

## Quick Reference Checklist

When creating new code:

- [ ] **Consult Figma designs first** for front-end components
- [ ] **Save Figma references** to `figma/` directory
- [ ] Use TypeScript with strict types
- [ ] Import types with `type` keyword
- [ ] Use named exports for components
- [ ] Apply `cn()` for className composition
- [ ] Define props types explicitly
- [ ] Use `@/` path alias for imports
- [ ] Add JSDoc comments for exported functions
- [ ] Use Biome ignore comments when needed
- [ ] Implement polymorphic `as` prop pattern where appropriate
- [ ] Set `displayName` for memoized components
- [ ] Use `satisfies` for type checking
- [ ] Handle errors with proper typing
- [ ] Use functional state updates
- [ ] Clean up tool calls before API requests
- [ ] Memoize expensive computations
- [ ] Follow Tailwind CSS v4 patterns (`@theme`, `@variant`)
- [ ] **Verify implementation matches Figma specifications**
