import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  // Ensure proper spacing for paragraphs
  p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
  
  // Style headings with proper spacing
  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold mb-3 mt-4 first:mt-0">{children}</h3>,
  
  // Style lists with proper spacing and bullets/numbers
  ul: ({ children }) => <ul className="mb-4 space-y-2 pl-6 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 space-y-2 pl-6 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  
  // Style blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-neutral-300 dark:border-neutral-700 pl-4 my-4 italic">
      {children}
    </blockquote>
  ),
  
  // Style code blocks
  pre: ({ children }) => (
    <pre className="bg-neutral-100 dark:bg-neutral-850 rounded-lg p-4 my-4 overflow-x-auto">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isInline = !className?.includes('language-');
    return isInline ? (
      <code className="bg-neutral-100 dark:bg-neutral-850 rounded px-1.5 py-0.5 text-sm">
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  
  // Style strong and emphasis
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  
  // Style links
  a: ({ children, href }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-[#5560FF] hover:text-[#6B7BFF] hover:underline transition-colors"
    >
      {children}
    </a>
  ),
};

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    return (
      <div className="markdown-body prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => 
    prevProps.content === nextProps.content && prevProps.id === nextProps.id
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
