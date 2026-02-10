import { GenericOverviewPage } from "./GenericOverviewPage";
import type { ContentItem } from "@/shared";

interface AcademicOverviewPageProps {
  data: ContentItem[];
  initialEnlargedItemId?: string;
}

/**
 * Wrapper component for academic work overview.
 * Uses GenericOverviewPage to eliminate code duplication.
 */
export function AcademicOverviewPage({ data, initialEnlargedItemId }: AcademicOverviewPageProps) {
  return (
    <GenericOverviewPage
      title="Academic Work Overview"
      data={data}
      initialEnlargedItemId={initialEnlargedItemId}
    />
  );
}
