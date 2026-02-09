import { OverviewPage } from "./OverviewPage";
import { DetailCard } from "../detail-card/DetailCard";
import { Modal } from "../modal/Modal";
import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ContentItem } from "@/shared";

interface AcademicOverviewPageProps {
  data: ContentItem[];
}

export function AcademicOverviewPage({ data }: AcademicOverviewPageProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [enlargedItem, setEnlargedItem] = useState<any>(null);
  const isMobile = useIsMobile();

  const handleItemClick = (item: any) => {
    setEnlargedItem(item);
  };

  const handleClose = () => setEnlargedItem(null);

  // Mobile: Render DetailCard in full-screen Modal
  if (enlargedItem && isMobile) {
    return (
      <Modal isOpen={true} onClose={handleClose} fullScreen={true}>
        <DetailCard {...enlargedItem} onBack={handleClose} />
      </Modal>
    );
  }

  // Desktop: Render DetailCard inline (current behavior)
  if (enlargedItem) {
    return <DetailCard {...enlargedItem} onBack={handleClose} />;
  }

  return (
    <div className="flex">
      <OverviewPage
        title={"Academic Work Overview"}
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
