// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PairingGate } from "./PairingGate.tsx";
import { AgentConflictError } from "../client/agent-base-url.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

const mocks = vi.hoisted(() => ({
  client: {
    startPairing: vi.fn(),
    getPairingStatus: vi.fn(),
    submitPairingCode: vi.fn(),
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

const agentKey = { kty: "EC", crv: "P-256", x: "agent-x", y: "agent-y" };

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
    mocks.client.startPairing.mockResolvedValue({ pairId: "pair-1" });
    mocks.client.getPairingStatus.mockResolvedValue({ status: "pending" });
    mocks.client.authenticateSession.mockResolvedValue({ token: "session" });
    mocks.savePairedKeyId.mockResolvedValue(undefined);
  });

  it("shows no code and asks for the one from the agent window", async () => {
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    const input = await screen.findByRole("textbox");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(screen.queryByText(/\d{3}-\d{3}/)).toBeNull();
    expect(screen.queryByText("Protected editor")).toBeNull();
    expect(mocks.client.startPairing).toHaveBeenCalledWith({
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "public-x", y: "public-y" },
      name: expect.any(String),
    });
  });

  it("sends the typed code and then waits for Allow", async () => {
    mocks.client.submitPairingCode.mockResolvedValue({ accepted: true, status: "pending" });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    const input = await screen.findByRole("textbox");
    const submit = screen.getByRole("button");
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "123-456" } });
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.client.submitPairingCode).toHaveBeenCalledWith("pair-1", "123-456"));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/разрешить|allow/i);
  });

  it("says when the code is wrong and keeps the field", async () => {
    mocks.client.submitPairingCode.mockResolvedValue({ accepted: false, status: "pending" });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/не подходит|wrong/i));
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("shows the request as declined after too many wrong codes", async () => {
    mocks.client.submitPairingCode.mockResolvedValue({ accepted: false, status: "denied" });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/отклон|declined/i);
  });

  it("stores the approved key with the agent's key and authenticates before rendering the editor", async () => {
    mocks.client.getPairingStatus.mockResolvedValue({ status: "approved", keyId: "paired-key", agentKey });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByText("Protected editor")).toBeTruthy();
    expect(mocks.savePairedKeyId).toHaveBeenCalledWith("paired-key", agentKey);
    expect(mocks.client.authenticateSession).toHaveBeenCalledWith(identity.privateKey);
    expect(useSessionStore.getState().bearerToken).toBe("session");
  });

  it("does not pair with an agent that has no key of its own", async () => {
    mocks.client.getPairingStatus.mockResolvedValue({ status: "approved", keyId: "paired-key" });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/обновите|update the agent/i));
    expect(mocks.savePairedKeyId).not.toHaveBeenCalled();
    expect(mocks.client.authenticateSession).not.toHaveBeenCalled();
    expect(screen.queryByText("Protected editor")).toBeNull();
  });

  it("does not pair while two programs answer as the agent", async () => {
    mocks.client.startPairing.mockRejectedValue(new AgentConflictError());
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/ещё одна программа|another program/i));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("pairs again when the stored pairing has no agent key", async () => {
    mocks.getOrCreateIdentity
      .mockResolvedValueOnce({ id: "default", keyPair: identity, keyId: "old-key" })
      .mockResolvedValue({ id: "default", keyPair: identity });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByRole("textbox")).toBeTruthy();
    expect(mocks.clearIdentity).toHaveBeenCalled();
    expect(mocks.client.authenticateSession).not.toHaveBeenCalled();
  });

  it("authenticates an already-paired browser without starting a new request", async () => {
    mocks.getOrCreateIdentity.mockResolvedValue({
      id: "default",
      keyPair: identity,
      keyId: "paired-key",
      agentKey,
    });
    render(<PairingGate><p>Protected editor</p></PairingGate>);

    expect(await screen.findByText("Protected editor")).toBeTruthy();
    expect(mocks.client.startPairing).not.toHaveBeenCalled();
    expect(useSessionStore.getState().bearerToken).toBe("session");
  });
});
