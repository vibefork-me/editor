// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PairingGate } from "./PairingGate.tsx";
import { useSessionStore } from "../stores/sessionStore.ts";

const mocks = vi.hoisted(() => ({
  client: {
    startPairing: vi.fn(),
    getPairingStatus: vi.fn(),
    authenticateSession: vi.fn(),
  },
  getOrCreateIdentity: vi.fn(),
  exportPublicKeyJwk: vi.fn(),
  savePairedKeyId: vi.fn(),
  clearIdentity: vi.fn(),
}));

vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => mocks.client,
}));

vi.mock("../security/browserKeyStore.ts", () => ({
  getOrCreateIdentity: mocks.getOrCreateIdentity,
  exportPublicKeyJwk: mocks.exportPublicKeyJwk,
  savePairedKeyId: mocks.savePairedKeyId,
  clearIdentity: mocks.clearIdentity,
}));

const identity = {
  id: "default",
  keyPair: { privateKey: { key: "private" }, publicKey: { key: "public" } },
} as unknown as CryptoKeyPair;

describe("PairingGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({ bearerToken: null });
    mocks.getOrCreateIdentity.mockResolvedValue({ id: "default", keyPair: identity });
    mocks.exportPublicKeyJwk.mockResolvedValue({
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
      d: "must-not-be-sent",
    });
    mocks.client.startPairing.mockResolvedValue({ pairId: "pair-1", code: "123-456" });
    mocks.client.getPairingStatus.mockResolvedValue({ status: "pending" });
    mocks.client.authenticateSession.mockResolvedValue({ token: "session" });
    mocks.savePairedKeyId.mockResolvedValue(undefined);
  });

  it("shows the six-digit code and waits for native approval", async () => {
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByText("123-456")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/ожидаем|waiting/i);
    expect(screen.queryByText("Protected editor")).toBeNull();
    expect(mocks.client.startPairing).toHaveBeenCalledWith({
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "public-x", y: "public-y" },
      name: expect.any(String),
    });
  });

  it("stores the approved key and authenticates before rendering the editor", async () => {
    mocks.client.getPairingStatus.mockResolvedValue({ status: "approved", keyId: "paired-key" });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByText("Protected editor")).toBeTruthy();
    expect(mocks.savePairedKeyId).toHaveBeenCalledWith("paired-key");
    expect(mocks.client.authenticateSession).toHaveBeenCalledWith(identity.privateKey);
    expect(useSessionStore.getState().bearerToken).toBe("session");
  });

  it("authenticates an already-paired browser without starting a new request", async () => {
    mocks.getOrCreateIdentity.mockResolvedValue({
      id: "default",
      keyPair: identity,
      keyId: "paired-key",
    });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByText("Protected editor")).toBeTruthy();
    expect(mocks.client.startPairing).not.toHaveBeenCalled();
    expect(useSessionStore.getState().bearerToken).toBe("session");
  });
});
