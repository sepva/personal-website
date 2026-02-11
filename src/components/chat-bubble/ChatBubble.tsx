interface ChatBubbleProps {
  type: "bot" | "user" | "system";
  children: React.ReactNode;
}

export function ChatBubble({ type, children }: ChatBubbleProps) {
  const styles = {
    bot: "bg-[#1C1F26] text-[#FAFAFA] border border-[#2F323D]",
    user: "bg-[#2D3AEE] text-white ml-auto",
    system:
      "bg-[#252831] text-[#D1D5DB] border border-[#2F323D] italic text-center"
  };

  const widthStyles = {
    bot: "max-w-[85%]",
    user: "max-w-[75%]",
    system: "max-w-full"
  };

  return (
    <div className={`${widthStyles[type]} ${type === "user" ? "ml-auto" : ""}`}>
      <div
        className={`${styles[type]} rounded-[18px] px-[20px] py-[16px] shadow-[0_4px_8px_rgba(0,0,0,0.04)]`}
      >
        {children}
      </div>
    </div>
  );
}
