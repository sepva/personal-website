import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useShareableLink } from "../../src/hooks/useShareableLink";
import type { ContentItem } from "../../src/shared";

describe("useShareableLink", () => {
  const mockContentItem: ContentItem = {
    id: "academic-thesis-2023",
    title: "Test Thesis",
    description: "Test thesis description",
    type: "academic",
    tags: ["research", "ai"],
    date: "2023-01-01",
    fullContent: "Full thesis content here",
    shareable_link: "academic-thesis-2023"
  };

  const mockAllItems: ContentItem[] = [
    mockContentItem,
    {
      id: "academic-paper-2022",
      title: "Test Paper",
      description: "Test paper description",
      type: "academic",
      tags: ["research"],
      date: "2022-01-01"
    }
  ];

  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();

    // Mock window.location
    delete (window as any).location;
    window.location = { search: "" } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return default state when no shareable link in URL", async () => {
    window.location.search = "";

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.customMessages).toHaveLength(2);
    expect(result.current.customMessages[0].content).toContain(
      "Hi! I'm the personal AI assistant"
    );
    expect(result.current.customMessages[1].component).toBe("categories");
    expect(result.current.historyMessages).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should parse link parameter from URL and fetch content", async () => {
    window.location.search = "?link=academic-thesis-2023";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    const { result } = renderHook(() => useShareableLink());

    // Should be loading initially
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/content?link=academic-thesis-2023"
      )
    );
    expect(result.current.historyMessages).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should build correct message history from shareable content", async () => {
    window.location.search = "?link=academic-thesis-2023";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const historyMessages = result.current.historyMessages;
    expect(historyMessages).not.toBeNull();

    // Should have user message and bot response with component
    expect(historyMessages).toHaveLength(2);
    expect(historyMessages![0].role).toBe("user");
    const userPart = historyMessages![0].parts[0] as { type: string; text: string };
    expect(userPart.text).toContain("Test Thesis");
    expect(historyMessages![1].role).toBe("assistant");
  });

  it("should include initialEnlargedItemId in component data", async () => {
    window.location.search = "?link=academic-thesis-2023";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const historyMessages = result.current.historyMessages;
    expect(historyMessages).not.toBeNull();

    // Check that the custom messages include the component with enlarged item ID
    const componentMessage = result.current.customMessages.find(
      (msg) => msg.component === "AcademicOverviewPage"
    );
    expect(componentMessage).toBeDefined();
    expect(componentMessage?.data?.data).toEqual(mockAllItems);
    expect(componentMessage?.data?.initialEnlargedItemId).toBe(
      "academic-thesis-2023"
    );
  });

  it("should handle fetch errors gracefully", async () => {
    window.location.search = "?link=invalid-link";

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found"
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain("Failed to fetch content");
  });

  it("should handle network errors", async () => {
    window.location.search = "?link=test-link";

    (global.fetch as any).mockRejectedValueOnce(
      new Error("Network error")
    );

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });

  it("should handle missing contentItem in response", async () => {
    window.location.search = "?link=nonexistent-link";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: null,
        allItems: [],
        dataType: "",
        componentName: ""
      })
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Content not found");
  });

  it("should URL-encode the shareable link parameter", async () => {
    const linkWithSpaces = "academic thesis 2023";
    window.location.search = `?link=${linkWithSpaces}`;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(linkWithSpaces))
    );
  });

  it("should handle malformed JSON response", async () => {
    window.location.search = "?link=test-link";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      }
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });

  it("should preserve custom messages while adding history", async () => {
    window.location.search = "?link=academic-thesis-2023";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Custom messages should be present (4 messages when shareable link is loaded)
    expect(result.current.customMessages).toHaveLength(4);
    expect(result.current.customMessages[0].type).toBe("bot");
    expect(result.current.customMessages[1].component).toBe("categories");
    expect(result.current.customMessages[2].type).toBe("user");
    expect(result.current.customMessages[3].component).toBe("AcademicOverviewPage");

    // History messages should be separate
    expect(result.current.historyMessages).not.toBeNull();
  });

  it("should set loading to false even if there's no link parameter", async () => {
    window.location.search = "";

    const { result } = renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should handle multiple query parameters correctly", async () => {
    window.location.search = "?foo=bar&link=academic-thesis-2023&baz=qux";

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contentItem: mockContentItem,
        allItems: mockAllItems,
        dataType: "academic",
        componentName: "AcademicOverviewPage"
      })
    });

    renderHook(() => useShareableLink());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("link=academic-thesis-2023")
    );
  });
});
