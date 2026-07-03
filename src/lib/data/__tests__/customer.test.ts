import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
  customer: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

// `withAuthRefresh` now injects the Vero JWT into the SDK; the mock stands in for
// that seam by invoking the callback with a fixed token.
vi.mock("@/lib/spree", () => ({
  getClient: () => mockClient,
  withAuthRefresh: vi.fn(
    async (fn: (options: { token: string }) => Promise<unknown>) => {
      return fn({ token: "jwt-token" });
    },
  ),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

import { getCustomer, updateCustomer } from "@/lib/data/customer";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
};

describe("customer server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCustomer", () => {
    it("fetches the current customer via the SDK with the injected token", async () => {
      mockClient.customer.get.mockResolvedValue(mockUser);

      const result = await getCustomer();

      expect(mockClient.customer.get).toHaveBeenCalledWith({
        token: "jwt-token",
      });
      expect(result).toBe(mockUser);
    });

    it("returns null when the request fails (session handling lives in withVeroAuth)", async () => {
      const { withAuthRefresh } = await import("@/lib/spree");
      (withAuthRefresh as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Unauthorized"),
      );

      const result = await getCustomer();

      expect(result).toBeNull();
    });
  });

  describe("updateCustomer", () => {
    it("updates the name and returns the customer", async () => {
      mockClient.customer.update.mockResolvedValue(mockUser);

      const result = await updateCustomer({ first_name: "Updated" });

      expect(mockClient.customer.update).toHaveBeenCalledWith(
        { first_name: "Updated" },
        { token: "jwt-token" },
      );
      expect(result).toEqual({ success: true, customer: mockUser });
    });

    it("returns an error on failure", async () => {
      mockClient.customer.update.mockRejectedValue(new Error("Name too long"));

      const result = await updateCustomer({ last_name: "Test" });

      expect(result).toEqual({ success: false, error: "Name too long" });
    });

    it("returns a fallback message for non-Error throws", async () => {
      mockClient.customer.update.mockRejectedValue("unexpected");

      const result = await updateCustomer({ first_name: "Test" });

      expect(result).toEqual({ success: false, error: "Update failed" });
    });
  });
});
