import { ExternalLink } from 'lucide-react';

interface ContentTileProps {
  title: string;
  description: string;
  tags?: string[];
  type: 'project' | 'blog' | 'academic' | 'work';
  date?: string;
  onClick: () => void;
}

export function ContentTile({ title, description, tags, type, date, onClick }: ContentTileProps) {
  return (
    <button
      onClick={onClick}
      className="bg-[#1C1F26] hover:bg-[#252831] border border-[#2F323D] hover:border-[#5560FF] rounded-[16px] p-[20px] transition-all duration-200 text-left w-full group shadow-[0_4px_8px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between mb-[12px]">
        <h3 className="text-[#FAFAFA] pr-[8px]">{title}</h3>
        <ExternalLink size={18} className="text-[#6B7280] group-hover:text-[#5560FF] flex-shrink-0 mt-[4px]" />
      </div>
      
      <p className="text-[#D1D5DB] mb-[16px] line-clamp-2">{description}</p>
      
      {date && (
        <div className="text-[#6B7280] mb-[12px]" style={{ fontSize: '14px' }}>{date}</div>
      )}
      
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-[8px]">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-[12px] py-[4px] rounded-[8px] text-[#D1D5DB] border border-[#2F323D]"
              style={{ 
                fontSize: '14px',
                backgroundColor: 'rgba(45, 58, 238, 0.1)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
