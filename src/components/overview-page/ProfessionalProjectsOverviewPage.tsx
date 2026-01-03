import { OverviewPage } from "./OverviewPage";
import { work } from "@/data/mockData";
import { DetailCard } from "../detail-card/DetailCard";
import { useState } from "react";

export function ProfessionalProjectsOverviewPage() {
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
        title={"Professional Projects Overview"}
        items={
          activeFilter === "all"
            ? work
            : work.filter((item: any) => item.tags?.includes(activeFilter))
        }
        onItemClick={handleItemClick}
        filters={work.reduce<string[]>((acc, item) => {
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
