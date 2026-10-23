/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "../stores/sessionStore.ts";

const { getModels } = vi.hoisted(() => ({ getModels: vi.fn() }));
vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => ({ getModels }),
}));

import { useModelLabel } from "./useModelLabel.ts";

describe("useModelLabel", () => {
  beforeEach(() => {
    getModels.mockReset();
    getModels.mockResolvedValue([{ id: "model", label: "Model", tier: 0 }]);
    useSessionStore.setState({ bearerToken: null });
  });

  it("does not request protected models until a session exists", async () => {
    const { result } = renderHook(() => useModelLabel());
    expect(getModels).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    act(() => useSessionStore.getState().setBearerToken("session"));
    await waitFor(() => expect(getModels).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toBe("Model"));
  });
});
