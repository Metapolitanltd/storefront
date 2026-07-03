import { cookies } from "next/headers";
import { getAccessToken } from "./auth-helpers";
import { getConfig } from "./config";

const DEFAULT_CART_COOKIE = "_spree_cart_token";
const CART_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getCartCookieName(): string {
  try {
    return getConfig().cartCookieName ?? DEFAULT_CART_COOKIE;
  } catch {
    return DEFAULT_CART_COOKIE;
  }
}

function getCartIdCookieName(): string {
  return `${getCartCookieName()}_id`;
}

// --- Cart Cookies (token + ID always managed together) ---

export async function getCartToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(getCartCookieName())?.value;
}

export async function getCartId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(getCartIdCookieName())?.value;
}

export async function setCartCookies(
  id: string,
  token?: string,
): Promise<void> {
  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CART_TOKEN_MAX_AGE,
  };

  cookieStore.set(getCartIdCookieName(), id, opts);
  if (token) {
    cookieStore.set(getCartCookieName(), token, opts);
  }
}

export async function clearCartCookies(): Promise<void> {
  const cookieStore = await cookies();
  const opts = { maxAge: -1, path: "/" };
  cookieStore.set(getCartCookieName(), "", opts);
  cookieStore.set(getCartIdCookieName(), "", opts);
}

// --- Cart Options (combined cart + user tokens for cart/checkout/payment actions) ---

export async function getCartOptions(): Promise<{
  spreeToken: string | undefined;
  token: string | undefined;
}> {
  const spreeToken = await getCartToken();
  const token = await getAccessToken();
  return { spreeToken, token };
}

// --- Cart ID (required) ---

export async function requireCartId(): Promise<string> {
  const cartId = await getCartId();
  if (cartId) return cartId;

  // Authenticated user without cart ID cookie — resolve via carts.list()
  const token = await getAccessToken();
  if (token) {
    const { getClient } = await import("./config");
    const response = await getClient().carts.list({ token });
    if (response.data.length > 0) {
      const cart = response.data[0];
      await setCartCookies(cart.id, cart.token);
      return cart.id;
    }
  }

  throw new Error("No cart found");
}
