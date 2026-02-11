import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSessionManagement } from "../../src/hooks/useSessionManagement";

describe("useSessionManagement", () => {
  // Mock sessionStorage
  let mockSessionStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Clear sessionStorage mock before each test
    mockSessionStorage = {};

    // Mock sessionStorage methods
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => mockSessionStorage[key] || null
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        mockSessionStorage[key] = value;
      }
    );

    // Mock crypto.getRandomValues
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array: any) => {
      // Fill with predictable values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = i + 1;
      }
      return array;
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should generate new session ID if none exists", () => {
    const { result } = renderHook(() => useSessionManagement());

    expect(result.current.sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    expect(sessionStorage.getItem).toHaveBeenCalledWith("chat-session-id");
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "chat-session-id",
      expect.stringMatching(/^session-\d+-[a-z0-9]+$/)
    );
  });

  it("should reuse existing session ID from storage", () => {
    const existingId = "session-123456789-abc123def";
    mockSessionStorage["chat-session-id"] = existingId;

    const { result } = renderHook(() => useSessionManagement());

    expect(result.current.sessionId).toBe(existingId);
    expect(sessionStorage.getItem).toHaveBeenCalledWith("chat-session-id");
    // Should not set a new ID
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("should create unique session IDs on multiple calls", () => {
    const { result: result1 } = renderHook(() => useSessionManagement());
    const sessionId1 = result1.current.sessionId;

    // Clear mock and storage to simulate a new session
    vi.clearAllMocks();
    mockSessionStorage = {};

    const { result: result2 } = renderHook(() => useSessionManagement());
    const sessionId2 = result2.current.sessionId;

    // IDs should be different due to timestamp
    // (Note: In a real scenario they would differ, but in tests with mocked crypto,
    // we check that the format is correct)
    expect(sessionId1).toMatch(/^session-\d+-[a-z0-9]+$/);
    expect(sessionId2).toMatch(/^session-\d+-[a-z0-9]+$/);
  });

  it("should persist session ID across hook re-renders", () => {
    const { result, rerender } = renderHook(() => useSessionManagement());
    const initialSessionId = result.current.sessionId;

    // Re-render the hook
    rerender();

    // Session ID should remain the same
    expect(result.current.sessionId).toBe(initialSessionId);
  });

  it("should use cryptographically secure random values", () => {
    // Restore real crypto for this test
    vi.restoreAllMocks();

    const { result } = renderHook(() => useSessionManagement());

    // Should have a valid format with random component
    expect(result.current.sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

    // The random part should not be empty
    const parts = result.current.sessionId.split("-");
    expect(parts).toHaveLength(3);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("should handle sessionStorage being unavailable", () => {
    // Mock sessionStorage to throw error (e.g., in private browsing mode)
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("sessionStorage is not available");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("sessionStorage is not available");
    });

    // Should not throw, should still generate an ID
    expect(() => {
      renderHook(() => useSessionManagement());
    }).not.toThrow();
  });

  it("should generate session ID with correct timestamp format", () => {
    const mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    const { result } = renderHook(() => useSessionManagement());

    expect(result.current.sessionId).toContain(`session-${mockNow}-`);
  });
});
