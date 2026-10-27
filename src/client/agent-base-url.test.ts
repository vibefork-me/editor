import { describe, expect, it, vi } from "vitest";
import {
  resolveAgentBaseUrlFromLocation,
  fetchAgentHello,
  probeAgentBaseUrl,
} from "./agent-base-url.ts";

describe("resolveAgentBaseUrlFromLocation", () => {
  it("should return origin for /ui", () => {
    const location = { origin: "http://example.com", pathname: "/ui" };
    expect(resolveAgentBaseUrlFromLocation(location)).toBe("http://example.com");
  });

  it("should return origin for /ui/x", () => {
    const location = { origin: "http://example.com", pathname: "/ui/x" };
    expect(resolveAgentBaseUrlFromLocation(location)).toBe("http://example.com");
  });

  it("should return null for /other", () => {
    const location = { origin: "http://example.com", pathname: "/other" };
    expect(resolveAgentBaseUrlFromLocation(location)).toBeNull();
  });

  it("should handle origin with trailing slash", () => {
    const location = { origin: "http://127.0.0.1:47801/", pathname: "/ui" };
    expect(resolveAgentBaseUrlFromLocation(location)).toBe("http://127.0.0.1:47801");
  });
});

describe("fetchAgentHello", () => {
  it("should return null for non-ok response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false });
    const result = await fetchAgentHello(fetchFn, "http://example.com");
    expect(result).toBeNull();
  });

  it("should return null for invalid JSON response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    const result = await fetchAgentHello(fetchFn, "http://example.com");
    expect(result).toBeNull();
  });

  it("should return null for fetch error", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Fetch error"));
    const result = await fetchAgentHello(fetchFn, "http://example.com");
    expect(result).toBeNull();
  });

  it("should return valid response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        agent: "test-agent",
        version: "1.0.0",
        platform: "test-platform",
      }),
    });
    const result = await fetchAgentHello(fetchFn, "http://example.com");
    expect(result).toEqual({
      agent: "test-agent",
      version: "1.0.0",
      platform: "test-platform",
    });
  });

  it("should call fetch with correct parameters", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    await fetchAgentHello(fetchFn, "http://example.com");
    expect(fetchFn).toHaveBeenCalledWith("http://example.com/v1/hello", {
      method: "GET",
      headers: { "x-vibefork": "1" },
    });
  });
});

describe("probeAgentBaseUrl", () => {
  it("should return true for valid response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        agent: "test-agent",
        version: "1.0.0",
        platform: "test-platform",
      }),
    });
    const result = await probeAgentBaseUrl(fetchFn, "http://example.com");
    expect(result).toBe(true);
  });

  it("should return false for non-ok response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false });
    const result = await probeAgentBaseUrl(fetchFn, "http://example.com");
    expect(result).toBe(false);
  });
});
