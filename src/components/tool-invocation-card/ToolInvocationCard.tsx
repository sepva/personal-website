import { useState } from "react";
import type { ToolUIPart } from "ai";

export function ToolInvocationCard({
  toolUIPart,
  toolCallId
}: {
  toolUIPart: ToolUIPart;
  toolCallId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Inline helper for result content
  function renderResultContent(result: unknown) {
    if (
      typeof result === "object" &&
      result !== null &&
      "content" in result &&
      Array.isArray((result as any).content)
    ) {
      return (result as any).content
        .map((item: { type: string; text: string }) => {
          if (item.type === "text" && item.text.startsWith("\n~ Page URL:")) {
            const lines = item.text.split("\n").filter(Boolean);
            return lines
              .map((line: string) => `- ${line.replace("\n~ ", "")}`)
              .join("\n");
          }
          return item.text;
        })
        .join("\n");
    }
    return JSON.stringify(result, null, 2);
  }

  return (
    <div className="p-4 my-3 w-full max-w-[500px] rounded-md bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <span className="bg-[#F48120]/5 p-1.5 rounded-full flex-shrink-0">
          {/* Icon placeholder */}
          <span className="inline-block w-4 h-4 bg-[#F48120] rounded-full" />
        </span>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {toolUIPart.type}
          {toolUIPart.state === "output-available" && (
            <span className="text-xs text-[#F48120]/70">✓ Completed</span>
          )}
        </h4>
        <span
          className={`inline-block w-4 h-4 border-b-2 border-r-2 border-muted-foreground rotate-45 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "180px" : "0px" }}
        >
          <div className="mb-3">
            <h5 className="text-xs font-medium mb-1 text-muted-foreground">
              Arguments:
            </h5>
            <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
              {JSON.stringify(toolUIPart.input, null, 2)}
            </pre>
          </div>

          {/* Tool approval UI removed: tools now execute automatically */}

          {toolUIPart.state === "output-available" && (
            <div className="mt-3 border-t border-[#F48120]/10 pt-3">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
                {renderResultContent(toolUIPart.output)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
