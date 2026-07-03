import { beforeEach, describe, expect, it, vi } from "vitest";

// Outer state referenced inside vi.mock factories must be `mock`-prefixed so
// Vitest allows it past the hoisting guard.
const mockPeekVeroAccessToken = vi.fn();
const mockWithVeroAuth = vi.fn();

vi.mock("@/lib/vero/session", () => ({
  peekVeroAccessToken: () => mockPeekVeroAccessToken(),
  withVeroAuth: (fn: (token: string) => Promise<unknown>) =>
    mockWithVeroAuth(fn),
}));

import { getAccessToken, withAuthRefresh } from "../auth-helpers";

describe("Vero-backed Spree auth seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the SDK bearer token from the Vero access cookie", async () => {
    mockPeekVeroAccessToken.mockResolvedValue("vero-jwt");

    await expect(getAccessToken()).resolves.toBe("vero-jwt");
  });

  it("returns no token for guests", async () => {
    mockPeekVeroAccessToken.mockResolvedValue(undefined);

    await expect(getAccessToken()).resolves.toBeUndefined();
  });

  it("injects the (possibly rotated) Vero JWT as the SDK request token", async () => {
    mockWithVeroAuth.mockImplementation((fn) => fn("rotated-jwt"));
    const call = vi.fn().mockResolvedValue("customer");

    await expect(withAuthRefresh(call)).resolves.toBe("customer");
    expect(call).toHaveBeenCalledWith({ token: "rotated-jwt" });
  });

  it("propagates auth failures from the Vero session", async () => {
    const error = Object.assign(new Error("Not authenticated"), {
      status: 401,
    });
    mockWithVeroAuth.mockRejectedValue(error);

    await expect(withAuthRefresh(vi.fn())).rejects.toBe(error);
  });
});
