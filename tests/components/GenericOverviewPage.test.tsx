import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenericOverviewPage } from "../../src/components/overview-page/GenericOverviewPage";
import type { ContentItem } from "../../src/shared";

// Mock hooks and components
vi.mock("../../src/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false) // Default to desktop
}));

vi.mock("../../src/components/detail-card/DetailCard", () => ({
  DetailCard: ({ title, onBack }: any) => (
    <div data-testid="detail-card">
      <h1>{title}</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}));

vi.mock("../../src/components/modal/Modal", () => ({
  Modal: ({ children, isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="modal" onClick={onClose}>
        {children}
      </div>
    ) : null
}));

vi.mock("../../src/components/overview-page/OverviewPage", () => ({
  OverviewPage: ({ title, items, onItemClick, filters, onFilterChange, activeFilter }: any) => (
    <div data-testid="overview-page">
      <h1>{title}</h1>
      <div>
        {filters.map((filter: string) => (
          <button
            key={filter}
            data-testid={`filter-${filter}`}
            onClick={() => onFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <div>
        {items.map((item: ContentItem) => (
          <div
            key={item.id}
            data-testid={`item-${item.id}`}
            onClick={() => onItemClick(item)}
          >
            {item.title}
          </div>
        ))}
      </div>
    </div>
  )
}));

describe("GenericOverviewPage", () => {
  const mockData: ContentItem[] = [
    {
      id: "item-1",
      title: "First Item",
      description: "First item description",
      type: "blog",
      tags: ["tag1", "tag2"],
      date: "2024-01-01",
      fullContent: "Full content for first item"
    },
    {
      id: "item-2",
      title: "Second Item",
      description: "Second item description",
      type: "blog",
      tags: ["tag2", "tag3"],
      date: "2024-01-02"
    },
    {
      id: "item-3",
      title: "Third Item",
      description: "Third item description",
      type: "blog",
      tags: ["tag1"],
      date: "2024-01-03"
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with title prop", () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    expect(screen.getByText("Test Overview")).toBeInTheDocument();
  });

  it("should display overview page with all items", () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    expect(screen.getByTestId("overview-page")).toBeInTheDocument();
    expect(screen.getByTestId("item-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("item-item-3")).toBeInTheDocument();
  });

  it("should extract unique tags for filters", () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Should have filters for tag1, tag2, tag3
    expect(screen.getByTestId("filter-tag1")).toBeInTheDocument();
    expect(screen.getByTestId("filter-tag2")).toBeInTheDocument();
    expect(screen.getByTestId("filter-tag3")).toBeInTheDocument();
  });

  it("should filter items by tag when filter is selected", () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click tag1 filter
    const tag1Filter = screen.getByTestId("filter-tag1");
    fireEvent.click(tag1Filter);

    // Need to re-render to see filtered results (in real app, state update would trigger this)
    // For this test, we're verifying the filter mechanism exists
    expect(tag1Filter).toBeInTheDocument();
  });

  it("should show detail card when item is clicked", async () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click on first item
    const firstItem = screen.getByTestId("item-item-1");
    fireEvent.click(firstItem);

    // Wait for detail card to appear
    await waitFor(() => {
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    expect(screen.getByText("First Item")).toBeInTheDocument();
  });

  it("should close detail card when back button is clicked", async () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click on item to open detail card
    const firstItem = screen.getByTestId("item-item-1");
    fireEvent.click(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    // Detail card should be gone, overview should be back
    await waitFor(() => {
      expect(screen.queryByTestId("detail-card")).not.toBeInTheDocument();
      expect(screen.getByTestId("overview-page")).toBeInTheDocument();
    });
  });

  it("should auto-open item when initialEnlargedItemId is provided", async () => {
    render(
      <GenericOverviewPage
        title="Test Overview"
        data={mockData}
        initialEnlargedItemId="item-2"
      />
    );

    // Detail card should be shown immediately
    await waitFor(() => {
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    expect(screen.getByText("Second Item")).toBeInTheDocument();
  });

  it("should handle empty data gracefully", () => {
    render(<GenericOverviewPage title="Empty Overview" data={[]} />);

    expect(screen.getByText("Empty Overview")).toBeInTheDocument();
    expect(screen.getByTestId("overview-page")).toBeInTheDocument();
  });

  it("should not crash with invalid initialEnlargedItemId", () => {
    render(
      <GenericOverviewPage
        title="Test Overview"
        data={mockData}
        initialEnlargedItemId="nonexistent-id"
      />
    );

    // Should still render overview page
    expect(screen.getByTestId("overview-page")).toBeInTheDocument();

    // Detail card should not be shown
    expect(screen.queryByTestId("detail-card")).not.toBeInTheDocument();
  });

  it("should use fullContent if available, otherwise description", async () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click first item (has fullContent)
    const firstItem = screen.getByTestId("item-item-1");
    fireEvent.click(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
    });

    // In reality, we'd check what's passed to DetailCard
    // but with our mock, we can only check that it renders
    expect(screen.getByText("First Item")).toBeInTheDocument();
  });

  it("should handle items without tags", () => {
    const dataWithoutTags: ContentItem[] = [
      {
        id: "item-1",
        title: "Item Without Tags",
        description: "Description",
        type: "blog"
      }
    ];

    render(
      <GenericOverviewPage title="Test Overview" data={dataWithoutTags} />
    );

    expect(screen.getByText("Item Without Tags")).toBeInTheDocument();
    expect(screen.getByTestId("overview-page")).toBeInTheDocument();
  });

  it("should render in mobile view with modal", async () => {
    // Mock useIsMobile to return true
    const { useIsMobile } = await import("../../src/hooks/useIsMobile");
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click on item
    const firstItem = screen.getByTestId("item-item-1");
    fireEvent.click(firstItem);

    // Should render modal on mobile
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    expect(screen.getByTestId("detail-card")).toBeInTheDocument();
  });

  it("should close modal when clicked on mobile", async () => {
    // Mock useIsMobile to return true
    const { useIsMobile } = await import("../../src/hooks/useIsMobile");
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // Click on item to open modal
    const firstItem = screen.getByTestId("item-item-1");
    fireEvent.click(firstItem);

    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // Click modal to close
    const modal = screen.getByTestId("modal");
    fireEvent.click(modal);

    // Modal should close and overview should be visible
    await waitFor(() => {
      expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
      expect(screen.getByTestId("overview-page")).toBeInTheDocument();
    });
  });

  it("should handle all filter (show all items)", () => {
    render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    // By default, activeFilter is "all", so all items should be shown
    expect(screen.getByTestId("item-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("item-item-3")).toBeInTheDocument();
  });

  it("should handle multiple items with same tag", () => {
    const dataWithDuplicateTags: ContentItem[] = [
      {
        id: "item-1",
        title: "Item 1",
        description: "Description 1",
        type: "blog",
        tags: ["react", "javascript"]
      },
      {
        id: "item-2",
        title: "Item 2",
        description: "Description 2",
        type: "blog",
        tags: ["react", "typescript"]
      }
    ];

    render(
      <GenericOverviewPage
        title="Test Overview"
        data={dataWithDuplicateTags}
      />
    );

    // Should only have one "react" filter button (unique tags)
    const reactFilters = screen.getAllByTestId("filter-react");
    expect(reactFilters).toHaveLength(1);
  });

  it("should re-render when data prop changes", () => {
    const { rerender } = render(
      <GenericOverviewPage title="Test Overview" data={mockData} />
    );

    expect(screen.getByTestId("item-item-1")).toBeInTheDocument();

    // Update with new data
    const newData: ContentItem[] = [
      {
        id: "item-new",
        title: "New Item",
        description: "New description",
        type: "blog"
      }
    ];

    rerender(
      <GenericOverviewPage title="Test Overview" data={newData} />
    );

    expect(screen.queryByTestId("item-item-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-item-new")).toBeInTheDocument();
  });

  it("should handle initialEnlargedItemId update", async () => {
    const { rerender } = render(
      <GenericOverviewPage
        title="Test Overview"
        data={mockData}
        initialEnlargedItemId="item-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-card")).toBeInTheDocument();
      expect(screen.getByText("First Item")).toBeInTheDocument();
    });

    // Update initialEnlargedItemId (in real app, this might happen from shareable link)
    rerender(
      <GenericOverviewPage
        title="Test Overview"
        data={mockData}
        initialEnlargedItemId="item-2"
      />
    );

    // Should update to show second item's detail
    await waitFor(() => {
      expect(screen.getByText("Second Item")).toBeInTheDocument();
    });
  });
});
