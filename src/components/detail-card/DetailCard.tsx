import { ExternalLink, MessageCircle, Calendar, Tag, X } from 'lucide-react';

interface DetailCardProps {
  title: string;
  description: string;
  fullContent: string;
  tags?: string[];
  date?: string;
  link?: string;
  link_to_article?: string;
  onBack?: () => void;
}

export function DetailCard({
  title,
  description,
  fullContent,
  tags,
  date,
  link,
  link_to_article,
  onBack
}: DetailCardProps) {
  return (
    <div className="bg-[#1C1F26] border border-[#2F323D] rounded-[16px] p-[24px] shadow-[0_12px_24px_rgba(0,0,0,0.08)] max-w-[90%] relative">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-[20px] right-[20px] text-[#6B7280] hover:text-[#FAFAFA] transition-colors p-[8px] rounded-[8px] hover:bg-[#2F323D]"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}
      <h2 className="text-[#FAFAFA] mb-[16px]">{title}</h2>
      
      <div className="flex flex-wrap gap-[16px] mb-[20px] text-[#6B7280]" style={{ fontSize: '14px' }}>
        {date && (
          <div className="flex items-center gap-[8px]">
            <Calendar size={16} />
            <span>{date}</span>
          </div>
        )}
        {link && (
          <a 
            href={link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-[8px] hover:text-[#5560FF] transition-colors"
          >
            <ExternalLink size={16} />
            <span>View Live</span>
          </a>
        )}
      </div>

      <p className="text-[#D1D5DB] mb-[20px] leading-relaxed">{description}</p>

      <div className="bg-[#16181D] rounded-[12px] p-[16px] mb-[20px] border border-[#252831]">
        <p className="text-[#D1D5DB] whitespace-pre-line">{fullContent}</p>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex items-center gap-[8px] mb-[24px] flex-wrap">
          <Tag size={16} className="text-[#6B7280]" />
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-[12px] py-[6px] rounded-[8px] text-[#D1D5DB] border border-[#2F323D]"
              style={{ 
                fontSize: '14px',
                backgroundColor: 'rgba(85, 96, 255, 0.1)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-[12px] flex-wrap">
        <button
          onClick={link_to_article ? () => window.open(link_to_article, '_blank') : undefined}
          className="bg-[#2D3AEE] hover:bg-[#3F4BFF] text-white rounded-[10px] px-[20px] py-[12px] transition-colors flex items-center gap-[8px]"
        >
          <ExternalLink size={18} />
          <span>Open full write-up</span>
        </button>
      </div>
    </div>
  );
}
