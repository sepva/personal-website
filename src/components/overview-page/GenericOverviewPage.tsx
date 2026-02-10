import { OverviewPage } from "./OverviewPage";
import { DetailCard } from "../detail-card/DetailCard";
import { Modal } from "../modal/Modal";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ContentItem } from "@/shared";

interface GenericOverviewPageProps {
  title: string;
  data: ContentItem[];
  initialEnlargedItemId?: string;
}

/**
 * Generic overview page component that handles displaying content items
 * with filtering, detail view, and mobile/desktop responsive layouts.
 * Eliminates code duplication across Academic, Personal, and Professional overview pages.
 */
export function GenericOverviewPage({ title, data, initialEnlargedItemId }: GenericOverviewPageProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [enlargedItem, setEnlargedItem] = useState<ContentItem | null>(null);
  const isMobile = useIsMobile();

  // Auto-open content item if initialEnlargedItemId is provided
  useEffect(() => {
    if (initialEnlargedItemId && data.length > 0) {
      const item = data.find(item => item.id === initialEnlargedItemId);
      if (item) {
        setEnlargedItem(item);
      }
    }
  }, [initialEnlargedItemId, data]);

  const handleItemClick = (item: ContentItem) => {
    setEnlargedItem(item);
  };

  const handleClose = () => setEnlargedItem(null);

  // Mobile: Render DetailCard in full-screen Modal
  if (enlargedItem && isMobile) {
    return (
      <Modal isOpen={true} onClose={handleClose} fullScreen={true}>
        <DetailCard 
          {...enlargedItem} 
          fullContent={enlargedItem.fullContent || enlargedItem.description}
          onBack={handleClose} 
        />
      </Modal>
    );
  }

  // Desktop: Render DetailCard inline (current behavior)
  if (enlargedItem) {
    return (
      <DetailCard 
        {...enlargedItem} 
        fullContent={enlargedItem.fullContent || enlargedItem.description}
        onBack={handleClose} 
      />
    );
  }

  return (
    <div className="flex">
      <OverviewPage
        title={title}
        items={
          activeFilter === "all"
            ? data
            : data.filter((item) => item.tags?.includes(activeFilter))
        }
        onItemClick={handleItemClick}
        filters={data.reduce<string[]>((acc, item) => {
          item.tags?.forEach((tag) => {
            if (!acc.includes(tag)) {
              acc.push(tag);
            }
          });
          return acc;
        }, [])}
        onFilterChange={setActiveFilter}
        activeFilter={activeFilter}
      />
    </div>
  );
}
