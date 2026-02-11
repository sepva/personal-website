import { Menu, X, MessageSquare, Home, User, Settings } from "lucide-react";
import { useState } from "react";

interface MobileMenuProps {
  onNewChat: () => void;
}

export function MobileMenu({ onNewChat }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-[16px] left-[16px] z-40 bg-[#1C1F26] border border-[#2F323D] rounded-[10px] p-[12px] text-[#FAFAFA] shadow-[0_4px_8px_rgba(0,0,0,0.08)]"
      >
        <Menu size={24} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-[280px] bg-[#16181D] border-r border-[#2F323D] z-50 md:hidden">
            <div className="p-[24px] border-b border-[#2F323D] flex items-center justify-between">
              <h2 className="text-[#FAFAFA]">Portfolio AI</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#D1D5DB]"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 p-[16px] space-y-[8px]">
              <button
                onClick={() => {
                  onNewChat();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] bg-[#2D3AEE] hover:bg-[#3F4BFF] text-white transition-colors"
              >
                <MessageSquare size={20} />
                <span>New Chat</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors"
              >
                <Home size={20} />
                <span>Home</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors"
              >
                <User size={20} />
                <span>About</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors"
              >
                <Settings size={20} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
