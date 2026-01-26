import { ContentTile } from '../content-tile/ContentTile';
import { FilterBar } from '../filter-bar/FilterBar';
import type { ContentItem } from '@/shared';

interface OverviewPageProps {
  title: string;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  filters?: string[];
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
}

export function OverviewPage({
  title,
  items,
  onItemClick,
  filters,
  onFilterChange,
  activeFilter
}: OverviewPageProps) {
  return (
    <div className="bg-[#16181D] border border-[#2F323D] rounded-[16px] p-[24px] shadow-[0_12px_24px_rgba(0,0,0,0.08)] max-w-[95%] w-full">
      <div className="flex items-center justify-between mb-[24px] flex-wrap gap-[16px]">
        <h2 className="text-[#FAFAFA]">{title}</h2>
        <div className="text-[#6B7280]" style={{ fontSize: '14px' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {filters && onFilterChange && (
        <FilterBar
          filters={filters}
          activeFilter={activeFilter || 'all'}
          onFilterChange={onFilterChange}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] max-h-[600px] overflow-y-auto pr-[8px] custom-scrollbar">
        {items.map((item) => (
          <ContentTile
            key={item.id}
            title={item.title}
            description={item.description}
            tags={item.tags}
            type={item.type}
            date={item.date}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #1C1F26;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #2F323D;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #5560FF;
          }
        `
      }} />
    </div>
  );
}