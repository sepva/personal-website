import { Send } from "lucide-react";
import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask me anything about my work..."
        disabled={disabled}
        className="w-full bg-[#1C1F26] border border-[#2F323D] rounded-[12px] pl-[20px] pr-[56px] py-[16px] text-[#FAFAFA] placeholder-[#6B7280] focus:outline-none focus:border-[#5560FF] transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="absolute right-[8px] top-1/2 -translate-y-1/2 bg-[#2D3AEE] hover:bg-[#3F4BFF] disabled:bg-[#252831] disabled:opacity-50 text-white rounded-[10px] p-[10px] transition-colors"
      >
        <Send size={20} />
      </button>
    </form>
  );
}
