import { Cloud, Clock, HelpCircle } from 'lucide-react';

interface CategoryTilesProps {
  onSelect: (category: string) => void;
}

export const categories = [
  { id: 'weather', label: 'Weather Info', icon: Cloud, color: '#5560FF', prompt: 'Tell me about weather information' },
  { id: 'time', label: 'Time Zones', icon: Clock, color: '#B8A7FF', prompt: 'What time zone information can you help with?' },
  { id: 'help', label: 'Help', icon: HelpCircle, color: '#A7FFE4', prompt: 'What can you help me with?' }
];

export function CategoryTiles({ onSelect }: CategoryTilesProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-[12px]">
      {categories.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="bg-[#1C1F26] hover:bg-[#252831] border border-[#2F323D] hover:border-[#5560FF] rounded-[16px] p-[20px] transition-all duration-200 text-left group"
          >
            <Icon 
              size={24} 
              style={{ color: cat.color }}
              className="mb-[12px]"
            />
            <div className="text-[#FAFAFA] mb-[8px]">{cat.label}</div>
            <div className="text-[#6B7280]" style={{ fontSize: '14px' }}>{cat.prompt}</div>
          </button>
        );
      })}
    </div>
  );
}
