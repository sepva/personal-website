import { GenericOverviewPage } from "./GenericOverviewPage";
import type { ContentItem } from "@/shared";

interface PersonalProjectsOverviewPageProps {
  data: ContentItem[];
  initialEnlargedItemId?: string;
}

/**
 * Wrapper component for personal projects overview.
 * Uses GenericOverviewPage to eliminate code duplication.
 */
export function PersonalProjectsOverviewPage({ data, initialEnlargedItemId }: PersonalProjectsOverviewPageProps) {
  return (
    <GenericOverviewPage
      title="Personal Projects Overview"
      data={data}
      initialEnlargedItemId={initialEnlargedItemId}
    />
  );
}
