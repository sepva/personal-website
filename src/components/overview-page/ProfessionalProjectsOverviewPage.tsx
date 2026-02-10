import { GenericOverviewPage } from "./GenericOverviewPage";
import type { ContentItem } from "@/shared";

interface ProfessionalProjectsOverviewPageProps {
  data: ContentItem[];
  initialEnlargedItemId?: string;
}

/**
 * Wrapper component for professional projects overview.
 * Uses GenericOverviewPage to eliminate code duplication.
 */
export function ProfessionalProjectsOverviewPage({ data, initialEnlargedItemId }: ProfessionalProjectsOverviewPageProps) {
  return (
    <GenericOverviewPage
      title="Professional Projects Overview"
      data={data}
      initialEnlargedItemId={initialEnlargedItemId}
    />
  );
}
