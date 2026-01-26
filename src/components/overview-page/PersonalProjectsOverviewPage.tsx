import { OverviewPage } from "./OverviewPage";
import { DetailCard } from "../detail-card/DetailCard";
import { useState } from "react";
import type { ContentItem } from "@/shared";

interface PersonalProjectsOverviewPageProps {
  data: ContentItem[];
}

export function PersonalProjectsOverviewPage({ data }: PersonalProjectsOverviewPageProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [enlargedItem, setEnlargedItem] = useState<any>(null);

  const handleItemClick = (item: any) => {
    setEnlargedItem(item);
  };

    if (enlargedItem) {
      return DetailCard({ ...enlargedItem, onBack: () => setEnlargedItem(null) });
    }

  return (
    <div className="flex">
      <OverviewPage
        title={"Personal Projects Overview"}
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
