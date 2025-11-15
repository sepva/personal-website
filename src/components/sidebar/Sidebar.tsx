import { Home, MessageSquare, Settings, User } from 'lucide-react';

interface SidebarProps {
  onNewChat: () => void;
}

export function Sidebar({ onNewChat }: SidebarProps) {
  return (
    <div className="hidden md:flex flex-col w-[240px] bg-[#16181D] border-r border-[#2F323D] h-screen sticky top-0">
      <div className="p-[24px] border-b border-[#2F323D]">
        <h2 className="text-[#FAFAFA]">Portfolio AI</h2>
      </div>

      <div className="flex-1 p-[16px] space-y-[8px]">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] bg-[#2D3AEE] hover:bg-[#3F4BFF] text-white transition-colors"
        >
          <MessageSquare size={20} />
          <span>New Chat</span>
        </button>

        <button className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors">
          <Home size={20} />
          <span>Home</span>
        </button>

        <button className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors">
          <User size={20} />
          <span>About</span>
        </button>
      </div>

      <div className="p-[16px] border-t border-[#2F323D]">
        <button className="w-full flex items-center gap-[12px] px-[16px] py-[12px] rounded-[10px] text-[#D1D5DB] hover:bg-[#1C1F26] transition-colors">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
