import { describe, expect, it, vi } from "vitest";
import {
  classifyAgentProbeError,
  probeAgentReachability,
} from "./probe-agent-reachability.ts";

describe("probeAgentReachability", () => {
  it("returns online when hello succeeds on a loopback port", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes(":47802/v1/hello")) {
        return new Response(JSON.stringify({ agent: "vf", platform: "t", version: "0" }), {
          status: 200,
        });
      }
      throw new TypeError("Failed to fetch");
    });

    const result = await probeAgentReachability(fetchMock as typeof fetch);
    expect(result).toEqual({ status: "online" });
  });

  it("classifies NotAllowedError as local-network-blocked", () => {
    expect(classifyAgentProbeError(new DOMException("denied", "NotAllowedError"))).toBe(
      "local-network-blocked",
    );
  });

  it("defaults to agent-not-running when ports are closed", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await probeAgentReachability(fetchMock as typeof fetch);
    expect(result).toEqual({ status: "offline", reason: "agent-not-running" });
  });
});
