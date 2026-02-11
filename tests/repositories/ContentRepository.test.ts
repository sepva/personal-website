import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentRepository } from "../../src/repositories/ContentRepository";
import {
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  CONNECTION_HEALTH_CHECK_INTERVAL_MS
} from "../../src/config/constants";

describe("ContentRepository", () => {
  let mockDb: D1Database;
  let mockAi: Ai;
  let mockVectorIndex: VectorizeIndex;
  let repository: ContentRepository;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock D1Database
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "1",
              title: "Test Article",
              description: "Test description",
              type: "blog",
              tags: JSON.stringify(["tag1", "tag2"]),
              date: "2024-01-01",
              fullContent: "Full content here",
              link: "https://example.com",
              shareable_link: "test-link"
            }
          ],
          success: true
        })
      })
    } as unknown as D1Database;

    // Mock Ai service
    mockAi = {
      run: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5])
    } as unknown as Ai;

    // Mock VectorizeIndex
    mockVectorIndex = {
      query: vi.fn().mockResolvedValue({
        matches: [
          {
            id: "1",
            score: 0.95,
            metadata: { data_type: "blog" }
          }
        ]
      })
    } as unknown as VectorizeIndex;

    repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);
  });

  describe("fetchContentByType", () => {
    it("should fetch content by type from database", async () => {
      const result = await repository.fetchContentByType("blog");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM blog");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "1",
        title: "Test Article",
        type: "blog"
      });
    });

    it("should fetch content by type and id", async () => {
      const result = await repository.fetchContentByType("blog", "1");

      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM blog WHERE id = ?");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should cache results after first fetch", async () => {
      // First fetch - should query database
      const result1 = await repository.fetchContentByType("blog");
      expect(mockDb.prepare).toHaveBeenCalledTimes(2); // 1 for health check, 1 for query

      // Clear the mock calls
      vi.clearAllMocks();

      // Second fetch - should use cache
      const result2 = await repository.fetchContentByType("blog");
      expect(result2).toEqual(result1);
      // Should not call database again (no prepare calls)
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should refetch when cache expires", async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      // First fetch
      await repository.fetchContentByType("blog");

      // Advance time beyond cache TTL
      currentTime += CACHE_TTL_MS + 1000;

      // Clear mock calls
      vi.clearAllMocks();

      // Second fetch - cache should be expired
      await repository.fetchContentByType("blog");
      expect(mockDb.prepare).toHaveBeenCalled();

      // Restore Date.now
      Date.now = originalNow;
    });

    it("should evict oldest cache entry when max size reached", async () => {
      // Fill cache to MAX_CACHE_ENTRIES
      for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        await repository.fetchContentByType(`type${i}`);
      }

      // Add one more entry
      await repository.fetchContentByType("newType");

      // First entry should be evicted, so fetching it should hit database again
      vi.clearAllMocks();
      await repository.fetchContentByType("type0");
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it("should return empty array on database error", async () => {
      // Mock database to throw error
      mockDb.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error("Database error"))
      });

      const result = await repository.fetchContentByType("blog");
      expect(result).toEqual([]);
    });

    it("should handle malformed JSON in tags field gracefully", async () => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "1",
                title: "Test Article",
                description: "Test description",
                type: "blog",
                tags: "invalid json", // Malformed JSON
                date: "2024-01-01"
              }
            ],
            success: true
          })
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.fetchContentByType("blog");
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual([]); // Should default to empty array
    });
  });

  describe("queryVectorDatabase", () => {
    it("should generate embedding and query vector index", async () => {
      const query = "test query";
      const result = await repository.queryVectorDatabase(query, 3);

      expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", {
        text: query
      });
      expect(mockVectorIndex.query).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        { topK: 3, returnMetadata: "all" }
      );
      expect(result).toHaveLength(1);
    });

    it("should handle embedding response with data array", async () => {
      mockAi = {
        run: vi.fn().mockResolvedValue({
          data: [[0.1, 0.2, 0.3, 0.4, 0.5]]
        })
      } as unknown as Ai;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.queryVectorDatabase("test query");
      expect(result).toHaveLength(1);
    });

    it("should skip results without data_type metadata", async () => {
      mockVectorIndex = {
        query: vi.fn().mockResolvedValue({
          matches: [
            {
              id: "1",
              score: 0.95,
              metadata: {} // Missing data_type
            }
          ]
        })
      } as unknown as VectorizeIndex;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.queryVectorDatabase("test query");
      expect(result).toEqual([]);
    });

    it("should handle errors when fetching individual records", async () => {
      // First call succeeds for health check, second call fails for actual query
      let callCount = 0;
      mockDb = {
        prepare: vi.fn().mockImplementation((query: string) => {
          callCount++;
          if (query.includes("health_check")) {
            return {
              all: vi.fn().mockResolvedValue({ results: [{ health_check: 1 }] })
            };
          }
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockRejectedValue(new Error("Record fetch error"))
          };
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.queryVectorDatabase("test query");
      // Should continue and return empty array since record fetch failed
      expect(result).toEqual([]);
    });
  });

  describe("fetchContentByShareableLink", () => {
    it("should find content by shareable link", async () => {
      const result = await repository.fetchContentByShareableLink("test-link");

      expect(result.contentItem).not.toBeNull();
      expect(result.contentItem?.id).toBe("1");
      expect(result.dataType).toBe("academic");
      expect(result.componentName).toBe("AcademicOverviewPage");
    });

    it("should return null when shareable link not found", async () => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [],
            success: true
          })
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result =
        await repository.fetchContentByShareableLink("nonexistent-link");

      expect(result.contentItem).toBeNull();
      expect(result.allItems).toEqual([]);
      expect(result.dataType).toBe("");
      expect(result.componentName).toBe("");
    });

    it("should search all data types until finding a match", async () => {
    // Mock to return results only on third call (projects table)
    let callCount = 0;
    mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(() => {
            if (callCount === 1 || callCount === 2) {
              // academic and work searches - no results
              return Promise.resolve({ results: [], success: true });
            } else if (callCount === 3) {
              // projects search - found
              return Promise.resolve({
                results: [
                  {
                    id: "1",
                    title: "Test Project",
                    description: "Test description",
                    type: "project",
                    tags: JSON.stringify(["tag1"]),
                    shareable_link: "test-link"
                  }
                ],
                success: true
              });
            } else if (callCount === 4) {
              // Health check from fetchContentByType
              return Promise.resolve({
                results: [{ health_check: 1 }],
                success: true
              });
            } else {
              // fetchContentByType query for all projects
              return Promise.resolve({
                results: [
                  {
                    id: "1",
                    title: "Test Project",
                    description: "Test description",
                    type: "project",
                    tags: JSON.stringify(["tag1"]),
                    shareable_link: "test-link"
                  }
                ],
                success: true
              });
            }
          })
        };
      })
    } as unknown as D1Database;

    repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

    const result = await repository.fetchContentByShareableLink("test-link");

    expect(result.contentItem).not.toBeNull();
    expect(result.dataType).toBe("projects");
  });
    it("should continue searching if one table throws error", async () => {
      let callCount = 0;
      mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          callCount++;
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(() => {
              if (callCount <= 2) {
                // Health checks
                return Promise.resolve({
                  results: [{ health_check: 1 }],
                  success: true
                });
              } else if (callCount === 3) {
                // First search - error
                return Promise.reject(new Error("Database error"));
              } else {
                // Subsequent searches - success
                return Promise.resolve({
                  results: [
                    {
                      id: "1",
                      title: "Test Article",
                      description: "Test description",
                      type: "blog",
                      tags: JSON.stringify(["tag1"]),
                      shareable_link: "test-link"
                    }
                  ],
                  success: true
                });
              }
            })
          };
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.fetchContentByShareableLink("test-link");

      expect(result.contentItem).not.toBeNull();
    });
  });

  describe("connection health management", () => {
    it("should validate connection on first query", async () => {
      await repository.fetchContentByType("blog");

      // Should have called health check query
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "SELECT 1 as health_check"
      );
    });

    it("should revalidate connection after health check interval", async () => {
    const originalNow = Date.now;
    let currentTime = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    // First query
    await repository.fetchContentByType("blog");

    // Advance time beyond both cache TTL and health check interval
    // This ensures cache expires and health check is needed
    currentTime += Math.max(CACHE_TTL_MS, CONNECTION_HEALTH_CHECK_INTERVAL_MS) + 1000;

    // Clear only the mockDb.prepare calls, not the Date.now spy
    (mockDb.prepare as any).mockClear();

    // Second query should trigger health check since cache is expired
    await repository.fetchContentByType("blog");
    expect(mockDb.prepare).toHaveBeenCalledWith(
      "SELECT 1 as health_check"
    );

    Date.now = originalNow;
  });
    it("should handle connection validation failure gracefully", async () => {
      // Mock health check to fail
      let callCount = 0;
      mockDb = {
        prepare: vi.fn().mockImplementation((query: string) => {
          callCount++;
          if (query.includes("health_check")) {
            return {
              all: vi.fn().mockRejectedValue(new Error("Connection failed"))
            };
          }
          // But actual queries should still work
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: "1",
                  title: "Test",
                  description: "Test",
                  type: "blog",
                  tags: "[]"
                }
              ],
              success: true
            })
          };
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      // Should not throw, should continue with query
      const result = await repository.fetchContentByType("blog");
      expect(result).toHaveLength(1);
    });
  });

  describe("retry logic", () => {
    it("should retry failed queries with exponential backoff", async () => {
      let attemptCount = 0;
      mockDb = {
        prepare: vi.fn().mockImplementation((query: string) => {
          if (query.includes("health_check")) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [{ health_check: 1 }]
              })
            };
          }
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(() => {
              attemptCount++;
              if (attemptCount < 3) {
                return Promise.reject(new Error("Temporary failure"));
              }
              return Promise.resolve({
                results: [
                  {
                    id: "1",
                    title: "Test",
                    description: "Test",
                    type: "blog",
                    tags: "[]"
                  }
                ],
                success: true
              });
            })
          };
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.fetchContentByType("blog");
      expect(attemptCount).toBe(3); // Failed 2 times, succeeded on 3rd
      expect(result).toHaveLength(1);
    });
  });

  describe("data parsing", () => {
    it("should parse valid content items correctly", async () => {
      const result = await repository.fetchContentByType("blog");

      expect(result[0]).toMatchObject({
        id: "1",
        title: "Test Article",
        description: "Test description",
        type: "blog",
        tags: ["tag1", "tag2"],
        date: "2024-01-01",
        fullContent: "Full content here",
        link: "https://example.com",
        shareable_link: "test-link"
      });
    });

    it("should handle null optional fields", async () => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "1",
                title: "Test Article",
                description: "Test description",
                type: "blog",
                tags: "[]",
                date: null,
                fullContent: null,
                link: null,
                shareable_link: null
              }
            ],
            success: true
          })
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.fetchContentByType("blog");
      expect(result[0]).toMatchObject({
        id: "1",
        title: "Test Article",
        description: "Test description",
        type: "blog"
      });
      expect(result[0].date).toBeUndefined();
      expect(result[0].fullContent).toBeUndefined();
      expect(result[0].link).toBeUndefined();
      expect(result[0].shareable_link).toBeUndefined();
    });

    it("should provide fallback for invalid content items", async () => {
      mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                // Missing required fields
                id: "1"
              }
            ],
            success: true
          })
        })
      } as unknown as D1Database;

      repository = new ContentRepository(mockDb, mockAi, mockVectorIndex);

      const result = await repository.fetchContentByType("blog");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "1",
        title: "Untitled",
        description: "",
        type: "blog"
      });
    });
  });
});
